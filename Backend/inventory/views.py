"""
Inventory ViewSets with branch-scoped access and stock management.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models
from django.db.models.functions import Coalesce

from inventory.models import (
    InventoryItem, InventoryCategory, InventoryAdjustment,
    JobPartUsage, StockTransfer
)
from inventory.serializers import (
    InventoryItemSerializer, InventoryItemListSerializer,
    InventoryCategorySerializer, InventoryAdjustmentSerializer,
    StockAddSerializer, StockDeductSerializer, StockAdjustSerializer,
    JobPartUsageSerializer, StockTransferSerializer,
    LowStockAlertSerializer
)
from core.permissions import (
    IsBranchMember, CanManageInventory, BranchScopedMixin,
    IsOwnerOrManager
)
from core.models import Role
from core.exceptions import InsufficientInventory, ProtectedResourceError


class InventoryCategoryViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for inventory categories."""
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageInventory]
    branch_field = 'branch'
    queryset = InventoryCategory.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        
        return queryset


class InventoryItemViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for inventory items.
    
    Features:
    - Branch-scoped access
    - Stock management (add, deduct, adjust)
    - Low stock alerts
    - Full audit trail
    """
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageInventory]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_active']
    search_fields = ['name', 'sku', 'description', 'vendor_name']
    ordering_fields = ['name', 'quantity', 'selling_price', 'created_at']
    ordering = ['name']
    branch_field = 'branch'
    queryset = InventoryItem.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        
        queryset = queryset.select_related('branch', 'category')
            
            
        # Filter by low stock if specified
        low_stock = self.request.query_params.get('low_stock')
        if low_stock and low_stock.lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(quantity__lte=models.F('low_stock_threshold'))
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryItemListSerializer
        return InventoryItemSerializer

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        try:
            instance.delete()
        except ProtectedError:
            raise ProtectedResourceError(
                "Cannot delete item: it is referenced by job part usage records. "
                "Deactivate it instead."
            )

    @action(detail=True, methods=['post'])
    def add_stock(self, request, pk=None):
        """Add stock to an item."""
        item = self.get_object()
        
        serializer = StockAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        item.add_stock(
            quantity=serializer.validated_data['quantity'],
            reason=serializer.validated_data['reason'],
            user=request.user
        )
        
        return Response({
            'message': f"Added {serializer.validated_data['quantity']} to stock.",
            'new_quantity': item.quantity
        })

    @action(detail=True, methods=['post'])
    def deduct_stock(self, request, pk=None):
        """Deduct stock from an item."""
        item = self.get_object()
        
        serializer = StockDeductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        job = None
        if 'job_id' in serializer.validated_data:
            from jobs.models import JobCard
            try:
                job = JobCard.objects.get(pk=serializer.validated_data['job_id'])
            except JobCard.DoesNotExist:
                pass
        
        try:
            item.deduct_stock(
                quantity=serializer.validated_data['quantity'],
                reason=serializer.validated_data['reason'],
                user=request.user,
                job=job
            )
            
            return Response({
                'message': f"Deducted {serializer.validated_data['quantity']} from stock.",
                'new_quantity': item.quantity
            })
        except InsufficientInventory as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrManager])
    def adjust_stock(self, request, pk=None):
        """
        Manually adjust stock quantity.
        Only Owners and Managers can perform manual adjustments.
        Requires detailed reason.
        """
        item = self.get_object()
        
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        old_quantity = item.quantity
        
        item.adjust_stock(
            new_quantity=serializer.validated_data['new_quantity'],
            reason=serializer.validated_data['reason'],
            user=request.user
        )
        
        # Log to audit
        from audit.services import AuditLogService
        AuditLogService.log(
            user=request.user,
            action='MANUAL_STOCK_ADJUSTMENT',
            model_name='InventoryItem',
            object_id=str(item.pk),
            details={
                'item_name': item.name,
                'old_quantity': old_quantity,
                'new_quantity': item.quantity,
                'reason': serializer.validated_data['reason']
            }
        )
        
        return Response({
            'message': f"Stock adjusted from {old_quantity} to {item.quantity}.",
            'old_quantity': old_quantity,
            'new_quantity': item.quantity
        })

    @action(detail=True, methods=['get'])
    def adjustments(self, request, pk=None):
        """Get adjustment history for an item."""
        item = self.get_object()
        adjustments = item.adjustments.all()
        
        page = self.paginate_queryset(adjustments)
        if page is not None:
            serializer = InventoryAdjustmentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = InventoryAdjustmentSerializer(adjustments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def usage_history(self, request, pk=None):
        """Get job usage history for an item."""
        item = self.get_object()
        usages = item.job_usages.all()
        
        page = self.paginate_queryset(usages)
        if page is not None:
            serializer = JobPartUsageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = JobPartUsageSerializer(usages, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get all items below low stock threshold."""
        queryset = self.get_queryset().filter(
            is_active=True
        ).annotate(
            is_low=models.Case(
                models.When(quantity__lte=models.F('low_stock_threshold'), then=True),
                default=False,
                output_field=models.BooleanField()
            )
        ).filter(is_low=True)
        
        serializer = LowStockAlertSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def out_of_stock(self, request):
        """Get all items with zero stock."""
        queryset = self.get_queryset().filter(quantity=0, is_active=True)
        serializer = InventoryItemListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get inventory statistics for user's branches."""
        queryset = self.get_queryset().filter(is_active=True)
        
        stats = {
            'total_items': queryset.count(),
            'total_quantity': queryset.aggregate(
                total=models.Sum('quantity')
            )['total'] or 0,
            'low_stock_count': queryset.filter(
                quantity__lte=models.F('low_stock_threshold')
            ).count(),
            'out_of_stock_count': queryset.filter(quantity=0).count(),
            'total_value': queryset.aggregate(
                total=models.Sum(
                    models.F('quantity') * models.F('cost_price')
                )
            )['total'] or 0,
        }
        
        return Response(stats)

    @action(detail=False, methods=['get'])
    def category_stats(self, request):
        """Get item counts grouped by category for the current branch."""
        branch_id = request.query_params.get('branch')
        if not branch_id:
            return Response([])

        categories = InventoryCategory.objects.filter(
            branch_id=branch_id
        ).annotate(
            item_count=models.Count(
                'items',
                filter=models.Q(items__is_active=True)
            ),
            total_quantity=Coalesce(
                models.Sum(
                    'items__quantity',
                    filter=models.Q(items__is_active=True)
                ),
                0,
            ),
        ).order_by('name')

        data = [
            {
                'id': str(cat.id),
                'name': cat.name,
                'description': cat.description,
                'item_count': cat.item_count,
                'total_quantity': cat.total_quantity,
            }
            for cat in categories
        ]
        return Response(data)


class InventoryAdjustmentViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for inventory adjustments."""
    serializer_class = InventoryAdjustmentSerializer
    permission_classes = [IsAuthenticated, CanManageInventory]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['item', 'adjustment_type', 'is_manual_adjustment']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return InventoryAdjustment.objects.none()
        
        queryset = InventoryAdjustment.objects.select_related('item', 'adjusted_by')
        
        branch_id = self.request.query_params.get('branch') or self.request.headers.get('X-Branch-ID')
        if branch_id:
            queryset = queryset.filter(item__branch_id=branch_id)
        else:
            queryset = queryset.filter(item__branch__in=user.get_accessible_branches())
            
        return queryset


class JobPartUsageViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for job part usage records."""
    serializer_class = JobPartUsageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['job', 'inventory_item']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return JobPartUsage.objects.none()
        
        queryset = JobPartUsage.objects.select_related('job', 'inventory_item')
        
        branch_id = self.request.query_params.get('branch') or self.request.headers.get('X-Branch-ID')
        if branch_id:
            queryset = queryset.filter(job__branch_id=branch_id)
        else:
            queryset = queryset.filter(job__branch__in=user.get_accessible_branches())
            
        return queryset


class StockTransferViewSet(viewsets.ModelViewSet):
    """ViewSet for stock transfers between branches."""
    serializer_class = StockTransferSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'from_branch', 'to_branch']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return StockTransfer.objects.none()
        
        queryset = StockTransfer.objects.select_related('from_branch', 'to_branch', 'initiated_by')
        
        branch_id = self.request.query_params.get('branch') or self.request.headers.get('X-Branch-ID')
        
        if branch_id:
            queryset = queryset.filter(
                models.Q(from_branch_id=branch_id) |
                models.Q(to_branch_id=branch_id)
            )
        else:
            accessible = user.get_accessible_branches()
            queryset = queryset.filter(
                models.Q(from_branch__in=accessible) |
                models.Q(to_branch__in=accessible)
            )
            
        return queryset

    def perform_create(self, serializer):
        serializer.save(initiated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete a stock transfer."""
        transfer = self.get_object()
        
        if transfer.status != 'IN_TRANSIT':
            return Response(
                {'error': 'Transfer must be in transit to complete.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process all transfer items
        from django.db import transaction
        
        with transaction.atomic():
            for item in transfer.items.all():
                # Create corresponding item in destination branch or add to existing
                dest_item, created = InventoryItem.objects.get_or_create(
                    branch=transfer.to_branch,
                    name=item.inventory_item.name,
                    defaults={
                        'sku': item.inventory_item.sku,
                        'cost_price': item.inventory_item.cost_price,
                        'selling_price': item.inventory_item.selling_price,
                        'gst_rate': item.inventory_item.gst_rate,
                        'hsn_code': item.inventory_item.hsn_code,
                        'unit': item.inventory_item.unit,
                    }
                )
                
                dest_item.add_stock(
                    item.quantity,
                    f"Transfer from {transfer.from_branch.name}",
                    request.user
                )
            
            transfer.status = 'COMPLETED'
            transfer.completed_by = request.user
            transfer.save()
        
        return Response({'message': 'Transfer completed successfully.'})

import pandas as pd
from rest_framework.parsers import MultiPartParser, FormParser
from django.db import transaction
from drf_spectacular.utils import extend_schema
from inventory.models import Purchase, PurchaseItem
from inventory.serializers import PurchaseSerializer, ExcelImportSerializer

class PurchaseViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for managing Purchases and importing via Excel."""
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageInventory]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields = ['vendor_name', 'invoice_number']
    ordering_fields = ['purchase_date', 'total_amount', 'created_at']
    filterset_fields = ['status']
    ordering = ['-purchase_date']
    branch_field = 'branch'
    queryset = Purchase.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        return queryset.prefetch_related('items__inventory_item', 'payments')

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against a purchase."""
        purchase = self.get_object()
        from inventory.serializers import RecordPurchasePaymentSerializer
        from inventory.models import PurchasePayment
        from decimal import Decimal
        
        serializer = RecordPurchasePaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        amount = serializer.validated_data['amount']
        if purchase.status == 'CANCELLED':
            return Response({'error': 'Cannot pay cancelled purchase'}, status=status.HTTP_400_BAD_REQUEST)
            
        with transaction.atomic():
            payment = PurchasePayment.objects.create(
                purchase=purchase,
                amount=amount,
                payment_method=serializer.validated_data['payment_method'],
                reference=serializer.validated_data.get('reference', ''),
                notes=serializer.validated_data.get('notes', ''),
                paid_by=request.user
            )
            purchase.paid_amount += Decimal(str(amount))
            purchase.save() # will trigger _update_payment_status
            
        # Refetch to get updated status
        purchase.refresh_from_db()
        return Response({
            'message': 'Payment recorded successfully',
            'paid_amount': str(purchase.paid_amount),
            'balance_due': str(purchase.balance_due),
            'status': purchase.status
        })

    @transaction.atomic
    def perform_create(self, serializer):
        from rest_framework.exceptions import ValidationError
        from django.shortcuts import get_object_or_404
        
        super().perform_create(serializer)
        purchase = serializer.instance
        
        items_data = self.request.data.get('items', [])
        if isinstance(items_data, str):
            import json
            try:
                items_data = json.loads(items_data)
            except:
                items_data = []

        total_amount = 0
        
        for item_data in items_data:
            inventory_item_id = item_data.get('inventory_item')
            try:
                quantity = int(item_data.get('quantity', 0))
                unit_price = float(item_data.get('unit_price', 0))
            except (ValueError, TypeError):
                continue
                
            if quantity <= 0 or unit_price < 0 or not inventory_item_id:
                continue
                
            inventory_item = get_object_or_404(InventoryItem, id=inventory_item_id)
            
            if inventory_item.branch_id and purchase.branch_id and inventory_item.branch_id != purchase.branch_id:
                raise ValidationError(f"Item {inventory_item.name} does not belong to the selected branch")
                
            total_price = quantity * unit_price
            
            PurchaseItem.objects.create(
                purchase=purchase,
                inventory_item=inventory_item,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price
            )
            
            inventory_item.add_stock(
                quantity, 
                reason=f"Manual Purchase Entry from {purchase.vendor_name} (Invoice: {purchase.invoice_number})", 
                user=self.request.user
            )
            
            total_amount += total_price
            
        purchase.total_amount = total_amount

        # Auto-calculate GST totals if taxable_amount was provided at header level
        if purchase.taxable_amount:
            try:
                gst_rate = float(self.request.data.get('gst_rate', 18))
            except (ValueError, TypeError):
                gst_rate = 18
            from decimal import Decimal
            half = (purchase.taxable_amount * Decimal(str(gst_rate)) / 100 / 2).quantize(Decimal('0.01'))
            purchase.cgst_amount = half
            purchase.sgst_amount = half
            purchase.total_gst = half * 2

        # Record Initial Payment
        from decimal import Decimal, InvalidOperation
        paid_amount_raw = self.request.data.get('paid_amount', 0)
        try:
            if not paid_amount_raw:
                paid_amount = Decimal('0')
            else:
                paid_amount = Decimal(str(paid_amount_raw))
        except (ValueError, TypeError, InvalidOperation):
            paid_amount = Decimal('0')


        if paid_amount > 0:
            payment_method = self.request.data.get('payment_method', 'CASH')
            from inventory.models import PurchasePayment
            PurchasePayment.objects.create(
                purchase=purchase,
                amount=paid_amount,
                payment_method=payment_method,
                paid_by=self.request.user,
                notes="Initial payment upon purchase"
            )
            purchase.paid_amount = paid_amount

        purchase.save()


    @extend_schema(request=ExcelImportSerializer)
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def import_excel(self, request):
        """
        Import purchases from an Excel file.
        Expects a file upload and parameters for vendor_name, invoice_number, purchase_date.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)

        vendor_name = request.data.get('vendor_name')
        if not vendor_name:
            return Response({'error': 'vendor_name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_number = request.data.get('invoice_number', '')
        purchase_date = request.data.get('purchase_date')
        if not purchase_date:
            return Response({'error': 'purchase_date is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if file_obj.name.lower().endswith('.csv'):
                df = pd.read_csv(file_obj)
            else:
                df = pd.read_excel(file_obj)
        except Exception as e:
            return Response({'error': f'Failed to parse upload file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        required_cols = ['Quantity', 'Unit Price']
        
        if 'SKU' in df.columns:
            lookup_col = 'SKU'
        elif 'Name' in df.columns:
            lookup_col = 'Name'
        else:
            return Response({'error': 'Excel must contain either a "SKU" or "Name" column to identify items.'}, status=status.HTTP_400_BAD_REQUEST)

        for col in required_cols:
            if col not in df.columns:
                return Response({'error': f'Missing required column: {col}'}, status=status.HTTP_400_BAD_REQUEST)

        branch_id = request.headers.get('X-Branch-ID') or (request.user.get_accessible_branches().first().id if request.user.get_accessible_branches().exists() else None)

        try:
            with transaction.atomic():
                purchase = Purchase.objects.create(
                    branch_id=branch_id,
                    vendor_name=vendor_name,
                    invoice_number=invoice_number,
                    purchase_date=purchase_date,
                    total_amount=0
                )
                
                total_amount = 0
                errors = []

                for index, row in df.iterrows():
                    identifier = str(row[lookup_col]).strip()
                    if not identifier or pd.isna(row[lookup_col]) or identifier.lower() == 'nan':
                        continue
                        
                    try:
                        quantity = int(row['Quantity'])
                        unit_price = float(row['Unit Price'])
                    except (ValueError, TypeError):
                        errors.append(f"Row {index+2}: Invalid quantity or price for {identifier}")
                        continue
                        
                    if quantity <= 0 or unit_price < 0:
                        errors.append(f"Row {index+2}: Quantity and price must be positive for {identifier}")
                        continue

                    # Find inventory item
                    item_query = InventoryItem.objects.filter(branch_id=branch_id) if branch_id else InventoryItem.objects.all()
                    if lookup_col == 'SKU':
                        item = item_query.filter(sku=identifier).first()
                    else:
                        item = item_query.filter(name__iexact=identifier).first()

                    if not item:
                        try:
                            item = InventoryItem.objects.create(
                                branch_id=branch_id,
                                name=identifier if lookup_col == 'Name' else f"Imported SKU {identifier}",
                                sku=identifier if lookup_col == 'SKU' else '',
                                cost_price=unit_price,
                                selling_price=unit_price,
                                quantity=0
                            )
                        except Exception as e:
                            errors.append(f"Row {index+2}: Failed to auto-create item {identifier}: {str(e)}")
                            continue

                    total_price = quantity * unit_price

                    PurchaseItem.objects.create(
                        purchase=purchase,
                        inventory_item=item,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=total_price
                    )
                    
                    item.add_stock(quantity, reason=f"Purchase from {vendor_name} (Invoice: {invoice_number})", user=request.user)
                    
                    total_amount += total_price

                if errors:
                    raise ValueError("Errors during import:\\n" + "\\n".join(errors))
                
                purchase.total_amount = total_amount
                purchase.save()

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f"An unexpected error occurred: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            'message': 'Purchase imported successfully',
            'purchase_id': purchase.id,
            'total_amount': total_amount
        }, status=status.HTTP_201_CREATED)
