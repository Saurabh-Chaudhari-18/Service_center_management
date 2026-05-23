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
    IsBranchMember, BranchScopedMixin, IsOwnerOrManager
)


class SupplierViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for supplier management."""
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
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

    @transaction.atomic
    def perform_create(self, serializer):
        """Create PO with auto-generated PO number."""
        branch_id = self.request.data.get('branch') or self.request.headers.get('X-Branch-ID')

        from core.models import Branch
        branch = None
        if branch_id:
            try:
                branch = Branch.objects.get(pk=branch_id)
            except Branch.DoesNotExist:
                pass

        # Generate PO number
        prefix = "PO"
        fy = branch.get_current_financial_year() if branch else str(timezone.now().year)
        code = branch.code if branch else "GEN"
        last_po = PurchaseOrder.objects.filter(
            po_number__startswith=f"{prefix}/{fy}/{code}/"
        ).order_by('-po_number').first()
        
        if last_po:
            try:
                seq = int(last_po.po_number.split('/')[-1]) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1
        
        po_number = f"{prefix}/{fy}/{code}/{str(seq).zfill(5)}"

        po = serializer.save(
            created_by=self.request.user,
            branch=branch,
            po_number=po_number
        )

        # Create line items
        items_data = self.request.data.get('items', [])
        subtotal = Decimal('0')
        for item_data in items_data:
            quantity = int(item_data.get('quantity', 0))
            unit_price = Decimal(str(item_data.get('unit_price', 0)))
            total_price = quantity * unit_price

            PurchaseOrderItem.objects.create(
                purchase_order=po,
                inventory_item_id=item_data.get('inventory_item'),
                description=item_data.get('description', ''),
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price
            )
            subtotal += total_price

        po.subtotal = subtotal
        po.total_amount = subtotal + po.tax_amount
        po.save()

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark items as received and add to inventory."""
        po = self.get_object()

        if po.status in ['CANCELLED', 'RECEIVED']:
            raise ValidationError(f'Cannot receive items for {po.get_status_display()} PO.')

        items_received = request.data.get('items', [])
        
        with transaction.atomic():
            all_received = True
            for item_data in items_received:
                try:
                    po_item = po.items.get(pk=item_data['id'])
                    qty = int(item_data.get('quantity', 0))
                    po_item.received_quantity += qty
                    po_item.save()

                    # Add to inventory
                    if po_item.inventory_item:
                        po_item.inventory_item.add_stock(
                            quantity=qty,
                            reason=f"Received from PO {po.po_number} ({po.supplier.name})",
                            user=request.user
                        )

                    if po_item.received_quantity < po_item.quantity:
                        all_received = False
                except PurchaseOrderItem.DoesNotExist:
                    continue

            po.status = 'RECEIVED' if all_received else 'PARTIAL'
            po.save()

        return Response({'message': 'Items received and stock updated.'})
