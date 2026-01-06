"""
Inventory serializers.
"""

from rest_framework import serializers
from inventory.models import (
    InventoryItem, InventoryCategory, InventoryAdjustment,
    JobPartUsage, StockTransfer, StockTransferItem
)
from decimal import Decimal


class InventoryCategorySerializer(serializers.ModelSerializer):
    """Serializer for inventory categories."""
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryCategory
        fields = ['id', 'branch', 'name', 'description', 'items_count', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_items_count(self, obj):
        return obj.items.filter(is_active=True).count()


class InventoryItemSerializer(serializers.ModelSerializer):
    """Serializer for inventory items."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    price_with_gst = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'branch', 'branch_name', 'name', 'sku',
            'category', 'category_name', 'description',
            'cost_price', 'selling_price', 'gst_rate', 'hsn_code',
            'quantity', 'low_stock_threshold', 'is_low_stock',
            'unit', 'location', 'vendor_name', 'vendor_contact',
            'warranty_period_months', 'is_active',
            'price_with_gst', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'quantity', 'created_at', 'updated_at']

    def get_price_with_gst(self, obj):
        gst_calc = obj.get_price_with_gst(is_interstate=False)
        return {
            'base_price': str(obj.selling_price),
            'cgst_rate': str(gst_calc['cgst_rate']),
            'cgst_amount': str(gst_calc['cgst_amount']),
            'sgst_rate': str(gst_calc['sgst_rate']),
            'sgst_amount': str(gst_calc['sgst_amount']),
            'total_with_gst': str(gst_calc['total_amount']),
        }

    def validate_branch(self, value):
        """Ensure user has access to branch."""
        request = self.context.get('request')
        if request and not request.user.has_branch_access(value):
            raise serializers.ValidationError("You do not have access to this branch.")
        return value


class InventoryItemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for inventory listings."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'sku', 'category_name', 'selling_price',
            'quantity', 'is_low_stock', 'unit'
        ]


class InventoryAdjustmentSerializer(serializers.ModelSerializer):
    """Serializer for inventory adjustments (read-only)."""
    item_name = serializers.CharField(source='item.name', read_only=True)
    adjusted_by_name = serializers.CharField(
        source='adjusted_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = InventoryAdjustment
        fields = [
            'id', 'item', 'item_name', 'adjustment_type',
            'quantity', 'old_quantity', 'new_quantity',
            'reason', 'adjusted_by', 'adjusted_by_name',
            'is_manual_adjustment', 'created_at'
        ]
        read_only_fields = fields


class StockAddSerializer(serializers.Serializer):
    """Serializer for adding stock."""
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(
        help_text="Reason for adding stock (e.g., Purchase order #123)"
    )


class StockDeductSerializer(serializers.Serializer):
    """Serializer for deducting stock."""
    quantity = serializers.IntegerField(min_value=1)
    reason = serializers.CharField()
    job_id = serializers.UUIDField(required=False)


class StockAdjustSerializer(serializers.Serializer):
    """Serializer for manual stock adjustment."""
    new_quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(
        min_length=10,
        help_text="Detailed reason for manual adjustment (min 10 chars)"
    )


class JobPartUsageSerializer(serializers.ModelSerializer):
    """Serializer for job part usage."""
    item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    job_number = serializers.CharField(source='job.job_number', read_only=True)
    warranty_expiry = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = JobPartUsage
        fields = [
            'id', 'job', 'job_number', 'inventory_item', 'item_name',
            'quantity', 'unit_price', 'total_price', 'notes',
            'warranty_expiry', 'created_at'
        ]
        read_only_fields = ['id', 'unit_price', 'total_price', 'created_at']


class StockTransferItemSerializer(serializers.ModelSerializer):
    """Serializer for stock transfer items."""
    item_name = serializers.CharField(source='inventory_item.name', read_only=True)
    
    class Meta:
        model = StockTransferItem
        fields = ['id', 'inventory_item', 'item_name', 'quantity']
        read_only_fields = ['id']


class StockTransferSerializer(serializers.ModelSerializer):
    """Serializer for stock transfers."""
    from_branch_name = serializers.CharField(source='from_branch.name', read_only=True)
    to_branch_name = serializers.CharField(source='to_branch.name', read_only=True)
    initiated_by_name = serializers.CharField(
        source='initiated_by.get_full_name', read_only=True
    )
    items = StockTransferItemSerializer(many=True, read_only=True)
    
    class Meta:
        model = StockTransfer
        fields = [
            'id', 'from_branch', 'from_branch_name',
            'to_branch', 'to_branch_name', 'status',
            'initiated_by', 'initiated_by_name',
            'completed_by', 'notes', 'items',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'status', 'initiated_by', 'completed_by', 'created_at', 'updated_at']


class LowStockAlertSerializer(serializers.ModelSerializer):
    """Serializer for low stock alerts."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    shortage = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = [
            'id', 'branch', 'branch_name', 'name', 'sku',
            'quantity', 'low_stock_threshold', 'shortage'
        ]

    def get_shortage(self, obj):
        return max(0, obj.low_stock_threshold - obj.quantity)
