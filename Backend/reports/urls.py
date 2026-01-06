"""
Reports URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from reports.views import ReportsViewSet

app_name = 'reports'

router = DefaultRouter()
router.register(r'', ReportsViewSet, basename='report')

urlpatterns = [
    path('', include(router.urls)),
]
