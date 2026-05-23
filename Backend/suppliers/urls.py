"""
Suppliers URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import SimpleRouter
from suppliers.views import SupplierViewSet, PurchaseOrderViewSet

app_name = 'suppliers'

# SimpleRouter with specific prefixes before r'' to prevent shadowing.
router = SimpleRouter()
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'', SupplierViewSet, basename='supplier')

urlpatterns = [
    path('', include(router.urls)),
]
