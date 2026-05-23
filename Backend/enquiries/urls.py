"""
Enquiries URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import SimpleRouter
from enquiries.views import EnquiryViewSet

app_name = 'enquiries'

router = SimpleRouter()
router.register(r'', EnquiryViewSet, basename='enquiry')

urlpatterns = [
    path('', include(router.urls)),
]
