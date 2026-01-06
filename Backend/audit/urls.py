"""
Audit URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from audit.views import (
    AuditLogViewSet, DevicePasswordAccessLogViewSet,
    LoginLogViewSet, DataExportLogViewSet
)

app_name = 'audit'

router = DefaultRouter()
router.register(r'logs', AuditLogViewSet, basename='audit-log')
router.register(r'password-access', DevicePasswordAccessLogViewSet, basename='password-access')
router.register(r'logins', LoginLogViewSet, basename='login-log')
router.register(r'exports', DataExportLogViewSet, basename='export-log')

urlpatterns = [
    path('', include(router.urls)),
]
