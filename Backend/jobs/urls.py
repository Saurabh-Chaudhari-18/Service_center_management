"""
Jobs URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from jobs.views import JobCardViewSet, PartRequestViewSet, JobEnumsView

app_name = 'jobs'

router = DefaultRouter()
router.register(r'jobs', JobCardViewSet, basename='job')
router.register(r'part-requests', PartRequestViewSet, basename='part-request')
router.register(r'enums', JobEnumsView, basename='job-enum')

urlpatterns = [
    path('', include(router.urls)),
]
