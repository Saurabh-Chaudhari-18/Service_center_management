"""
Jobs URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from jobs.views import JobCardViewSet, PartRequestViewSet, JobEnumsView, PickupRequestViewSet, DropdownOptionViewSet, PublicTrackingView

app_name = 'jobs'

router = DefaultRouter()
router.register(r'jobs', JobCardViewSet, basename='job')
router.register(r'part-requests', PartRequestViewSet, basename='part-request')
router.register(r'enums', JobEnumsView, basename='job-enum')
router.register(r'pickups', PickupRequestViewSet, basename='pickup')
router.register(r'dropdown-options', DropdownOptionViewSet, basename='dropdown-option')

urlpatterns = [
    path('public/track/<str:job_number>/', PublicTrackingView.as_view(), name='public-track'),
    path('', include(router.urls)),
]
