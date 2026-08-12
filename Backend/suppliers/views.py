"""
Supplier ViewSets with branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models, transaction
from django.utils import timezone
from decimal import Decimal

from suppliers.models import Supplier, PurchaseOrder, PurchaseOrderItem
from suppliers.serializers import (
    SupplierSerializer, SupplierListSerializer,
    PurchaseOrderSerializer, PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer
)
from core.permissions import (
    IsBranchMember, BranchScopedMixin, IsOwnerOrManager,
    get_requested_branch_id, require_accessible_branch,
)


class SupplierViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for supplier management."""
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'contact_person', 'phone', 'categories', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    branch_field = 'branch'
    queryset = Supplier.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer


class PurchaseOrderViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for purchase order management."""
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'supplier']
    search_fields = ['po_number', 'supplier__name']
    ordering_fields = ['order_date', 'total_amount', 'created_at']
    ordering = ['-order_date']
    branch_field = 'branch'
    queryset = PurchaseOrder.objects.all()

    def perform_destroy(self, instance):
        raise ValidationError('Purchase orders are permanent procurement records. Cancel the order instead.')

    def perform_update(self, serializer):
        if serializer.instance.status != 'DRAFT':
            raise ValidationError('Only draft purchase orders can be edited.')
        serializer.save()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        return queryset.select_related('supplier', 'created_by').prefetch_related('items')

    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer

    def _transition(self, request, allowed_statuses, new_status, message):
        with transaction.atomic():
            po = PurchaseOrder.objects.select_for_update().get(pk=self.get_object().pk)
            if po.status not in allowed_statuses:
                raise ValidationError(
                    f'Cannot {message.lower()} a purchase order that is {po.get_status_display()}.'
                )
            po.status = new_status
            po.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(po).data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        return self._transition(request, ['DRAFT'], 'SENT', 'Send')

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        return self._transition(request, ['SENT'], 'CONFIRMED', 'Confirm')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self._transition(request, ['DRAFT', 'SENT', 'CONFIRMED'], 'CANCELLED', 'Cancel')

    @transaction.atomic
    def perform_create(self, serializer):
        """Create a branch-safe PO with an atomic sequence number."""
        branch_id = get_requested_branch_id(self.request, self)
        if not branch_id or str(branch_id).lower() == 'universal':
            raise ValidationError({'branch': 'A branch is required for a purchase order.'})
        branch = require_accessible_branch(self.request.user, branch_id)

        supplier = serializer.validated_data.get('supplier')
        if supplier and supplier.branch_id not in (None, branch.id):
            raise ValidationError({'supplier': 'Supplier does not belong to this branch.'})

        po = serializer.save(
            created_by=self.request.user,
            branch=branch,
            po_number=branch.get_next_purchase_order_number(),
        )

        from inventory.models import InventoryItem

        items_data = self.request.data.get('items', [])
        if not items_data:
            raise ValidationError({'items': 'Add at least one item to the purchase order.'})
        subtotal = Decimal('0')
        for item_data in items_data:
            quantity = int(item_data.get('quantity', 0))
            unit_price = Decimal(str(item_data.get('unit_price', 0)))
            if quantity <= 0 or unit_price < 0:
                raise ValidationError({'items': 'Quantity must be positive and price cannot be negative.'})

            inventory_item = None
            inventory_item_id = item_data.get('inventory_item')
            if inventory_item_id:
                inventory_item = InventoryItem.objects.filter(pk=inventory_item_id).first()
                if not inventory_item or inventory_item.branch_id not in (None, branch.id):
                    raise ValidationError({'items': 'Inventory item does not belong to this branch.'})

            total_price = quantity * unit_price
            PurchaseOrderItem.objects.create(
                purchase_order=po,
                inventory_item=inventory_item,
                description=item_data.get('description', ''),
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
            )
            subtotal += total_price

        po.subtotal = subtotal
        po.total_amount = subtotal + po.tax_amount
        po.save(update_fields=['subtotal', 'total_amount', 'updated_at'])
        self._audit_create(po)
    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark items as received and add to inventory."""
        items_received = request.data.get('items', [])
        if not items_received:
            raise ValidationError({'items': 'Select at least one item to receive.'})
        
        with transaction.atomic():
            po = PurchaseOrder.objects.select_for_update().get(pk=pk)
            if po.status not in ['SENT', 'CONFIRMED', 'PARTIAL']:
                raise ValidationError(f'Cannot receive items for {po.get_status_display()} PO.')

            requested_ids = {str(item.get('id')) for item in items_received}
            po_items = {str(item.id): item for item in po.items.select_for_update()}
            unknown_ids = requested_ids - set(po_items)
            if unknown_ids:
                raise ValidationError({'items': 'One or more purchase-order items are invalid.'})

            for item_data in items_received:
                po_item = po_items[str(item_data['id'])]
                qty = int(item_data.get('quantity', 0))
                outstanding = po_item.quantity - po_item.received_quantity
                if qty <= 0 or qty > outstanding:
                    raise ValidationError({
                        'items': f'{po_item.description}: quantity must be between 1 and {outstanding}.'
                    })

                inventory_item = po_item.inventory_item
                if inventory_item is None:
                    from inventory.models import InventoryItem
                    inventory_item, _ = InventoryItem.objects.get_or_create(
                        branch=po.branch,
                        name=po_item.description,
                        defaults={
                            'cost_price': po_item.unit_price,
                            'selling_price': po_item.unit_price,
                            'gst_rate': Decimal('18.00'),
                            'quantity': 0,
                        },
                    )
                    po_item.inventory_item = inventory_item

                inventory_item.add_stock(
                    quantity=qty,
                    reason=f"Received from PO {po.po_number} ({po.supplier.name})",
                    user=request.user,
                )
                po_item.received_quantity += qty
                po_item.save(update_fields=['inventory_item', 'received_quantity', 'updated_at'])

            all_received = all(item.received_quantity >= item.quantity for item in po.items.all())
            po.status = 'RECEIVED' if all_received else 'PARTIAL'
            po.save(update_fields=['status', 'updated_at'])

        return Response(self.get_serializer(po).data)
