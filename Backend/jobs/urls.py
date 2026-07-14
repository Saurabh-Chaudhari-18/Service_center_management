"""
Jobs URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import SimpleRouter
from jobs.views import (
    JobCardViewSet, PartRequestViewSet, JobEnumsView,
    PickupRequestViewSet, DropdownOptionViewSet, PublicTrackingView,
    OutsourceVendorViewSet, JobOutsourceView, JobOutsourceReturnView
)

app_name = 'jobs'

# SimpleRouter (no API-root view) with specific prefixes registered BEFORE r''
# so that e.g. "part-requests/" matches before the generic "<pk>/" catch-all.
router = SimpleRouter()
router.register(r'part-requests', PartRequestViewSet, basename='part-request')
router.register(r'enums', JobEnumsView, basename='job-enum')
router.register(r'pickups', PickupRequestViewSet, basename='pickup')
router.register(r'dropdown-options', DropdownOptionViewSet, basename='dropdown-option')
router.register(r'outsource-vendors', OutsourceVendorViewSet, basename='outsource-vendor')
router.register(r'', JobCardViewSet, basename='job')

urlpatterns = [
    path('public/track/<str:job_number>/', PublicTrackingView.as_view(), name='public-track'),
    # Outsource actions (before router.urls so they don't clash with <pk>)
    path('<uuid:job_id>/outsource/', JobOutsourceView.as_view(), name='job-outsource'),
    path('<uuid:job_id>/outsource/<uuid:outsource_id>/return/', JobOutsourceReturnView.as_view(), name='job-outsource-return'),
    path('', include(router.urls)),
]
