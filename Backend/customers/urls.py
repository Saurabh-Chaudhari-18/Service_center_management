"""
Customer URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from customers.views import CustomerViewSet, CustomerDocumentViewSet

app_name = 'customers'

router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'documents', CustomerDocumentViewSet, basename='customer-document')

urlpatterns = [
    path('', include(router.urls)),
]
