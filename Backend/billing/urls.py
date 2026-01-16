"""
Billing URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from billing.views import (
    InvoiceViewSet, PaymentViewSet, CreditNoteViewSet, PaymentMethodsView
)

app_name = 'billing'

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet, basename='invoice')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'credit-notes', CreditNoteViewSet, basename='credit-note')
router.register(r'payment-methods', PaymentMethodsView, basename='payment-method')

urlpatterns = [
    path('', include(router.urls)),
]
