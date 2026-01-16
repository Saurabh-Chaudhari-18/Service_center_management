"""
Inventory URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from inventory.views import (
    InventoryItemViewSet, InventoryCategoryViewSet,
    InventoryAdjustmentViewSet, JobPartUsageViewSet,
    StockTransferViewSet
)

app_name = 'inventory'

router = DefaultRouter()
router.register(r'items', InventoryItemViewSet, basename='inventory-item')
router.register(r'categories', InventoryCategoryViewSet, basename='inventory-category')
router.register(r'adjustments', InventoryAdjustmentViewSet, basename='inventory-adjustment')
router.register(r'part-usage', JobPartUsageViewSet, basename='part-usage')
router.register(r'transfers', StockTransferViewSet, basename='stock-transfer')

urlpatterns = [
    path('', include(router.urls)),
]
