"""
Enquiries URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from enquiries.views import EnquiryViewSet

app_name = 'enquiries'

router = DefaultRouter()
router.register(r'', EnquiryViewSet, basename='enquiry')

urlpatterns = [
    path('', include(router.urls)),
]
