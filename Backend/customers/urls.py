"""
Customer URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import SimpleRouter
from customers.views import CustomerViewSet, CustomerDocumentViewSet
from marketing.views import CustomerLedgerViewSet

app_name = 'customers'

# SimpleRouter with specific prefixes before r'' to prevent the generic
# "<pk>/" detail pattern from shadowing "documents/" and "ledger/".
router = SimpleRouter()
router.register(r'documents', CustomerDocumentViewSet, basename='customer-document')
router.register(r'ledger', CustomerLedgerViewSet, basename='customer-ledger')
router.register(r'', CustomerViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]
