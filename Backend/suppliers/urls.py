"""
Suppliers URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from suppliers.views import SupplierViewSet, PurchaseOrderViewSet

app_name = 'suppliers'

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')

urlpatterns = [
    path('', include(router.urls)),
]
