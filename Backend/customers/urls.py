"""
Customer URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from customers.views import CustomerViewSet, CustomerDocumentViewSet
from marketing.views import CustomerLedgerViewSet

app_name = 'customers'

router = DefaultRouter()
router.register(r'', CustomerViewSet, basename='customer')
router.register(r'documents', CustomerDocumentViewSet, basename='customer-document')
router.register(r'ledger', CustomerLedgerViewSet, basename='customer-ledger')

urlpatterns = [
    path('', include(router.urls)),
]
