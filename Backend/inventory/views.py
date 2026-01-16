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
from core.exceptions import InsufficientInventory


class InventoryCategoryViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for inventory categories."""
    serializer_class = InventoryCategorySerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageInventory]
    branch_field = 'branch'

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return InventoryCategory.objects.none()
        
        return InventoryCategory.objects.filter(
            branch__in=user.get_accessible_branches()
        )


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
    filterset_fields = ['category', 'is_active', 'is_low_stock']
    search_fields = ['name', 'sku', 'description', 'vendor_name']
    ordering_fields = ['name', 'quantity', 'selling_price', 'created_at']
    ordering = ['name']
    branch_field = 'branch'

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return InventoryItem.objects.none()
        
        queryset = InventoryItem.objects.select_related(
            'branch', 'category'
        ).filter(
            branch__in=user.get_accessible_branches()
        )
        
        # Filter by branch if specified
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryItemListSerializer
        return InventoryItemSerializer

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
        
        return InventoryAdjustment.objects.filter(
            item__branch__in=user.get_accessible_branches()
        ).select_related('item', 'adjusted_by')


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
        
        return JobPartUsage.objects.filter(
            job__branch__in=user.get_accessible_branches()
        ).select_related('job', 'inventory_item')


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
        
        accessible = user.get_accessible_branches()
        return StockTransfer.objects.filter(
            models.Q(from_branch__in=accessible) |
            models.Q(to_branch__in=accessible)
        ).select_related('from_branch', 'to_branch', 'initiated_by')

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
