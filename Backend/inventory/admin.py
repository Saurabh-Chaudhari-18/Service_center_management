"""
Inventory admin configuration.
"""

from django.contrib import admin
from inventory.models import (
    InventoryItem, InventoryCategory, InventoryAdjustment,
    JobPartUsage, StockTransfer, StockTransferItem
)


@admin.register(InventoryCategory)
class InventoryCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'branch', 'created_at']
    list_filter = ['branch']
    search_fields = ['name']


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'branch', 'category', 'quantity', 'selling_price', 'is_active']
    list_filter = ['branch', 'category', 'is_active']
    search_fields = ['name', 'sku', 'description']
    ordering = ['name']


@admin.register(InventoryAdjustment)
class InventoryAdjustmentAdmin(admin.ModelAdmin):
    list_display = ['item', 'adjustment_type', 'quantity', 'old_quantity', 'new_quantity', 'adjusted_by', 'created_at']
    list_filter = ['adjustment_type', 'is_manual_adjustment']
    search_fields = ['item__name', 'reason']
    ordering = ['-created_at']
    readonly_fields = ['item', 'adjustment_type', 'quantity', 'old_quantity', 'new_quantity', 'reason', 'adjusted_by', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(JobPartUsage)
class JobPartUsageAdmin(admin.ModelAdmin):
    list_display = ['job', 'inventory_item', 'quantity', 'total_price', 'created_at']
    list_filter = ['inventory_item__branch']
    search_fields = ['job__job_number', 'inventory_item__name']
    ordering = ['-created_at']


@admin.register(StockTransfer)
class StockTransferAdmin(admin.ModelAdmin):
    list_display = ['from_branch', 'to_branch', 'status', 'initiated_by', 'created_at']
    list_filter = ['status', 'from_branch', 'to_branch']
    ordering = ['-created_at']
