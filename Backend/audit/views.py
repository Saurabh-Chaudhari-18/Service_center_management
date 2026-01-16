"""
Audit ViewSets - read-only access to audit logs.
"""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter

from audit.models import AuditLog, DevicePasswordAccessLog, LoginLog, DataExportLog
from audit.serializers import (
    AuditLogSerializer, DevicePasswordAccessLogSerializer,
    LoginLogSerializer, DataExportLogSerializer
)
from core.permissions import IsOwner, IsOwnerOrManager


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for audit logs.
    Only Owners can view audit logs.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['action', 'model_name', 'user']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return AuditLog.objects.none()
        
        # Filter by organization
        # Since AuditLog doesn't have direct branch reference,
        # filter by users in the same organization
        org_users = user.organization.users.values_list('id', flat=True)
        return AuditLog.objects.filter(user__in=org_users)

    @action(detail=False, methods=['get'])
    def for_object(self, request):
        """Get audit logs for a specific object."""
        model_name = request.query_params.get('model')
        object_id = request.query_params.get('id')
        
        if not model_name or not object_id:
            return Response({'error': 'model and id parameters required'}, status=400)
        
        logs = self.get_queryset().filter(
            model_name=model_name,
            object_id=object_id
        )
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class DevicePasswordAccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for device password access logs.
    Only Owners and Managers can view.
    """
    serializer_class = DevicePasswordAccessLogSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['job', 'accessed_by']
    ordering = ['-accessed_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return DevicePasswordAccessLog.objects.none()
        
        return DevicePasswordAccessLog.objects.filter(
            job__branch__in=user.get_accessible_branches()
        ).select_related('job', 'accessed_by')

    @action(detail=False, methods=['get'])
    def for_job(self, request):
        """Get password access logs for a specific job."""
        job_id = request.query_params.get('job_id')
        
        if not job_id:
            return Response({'error': 'job_id parameter required'}, status=400)
        
        logs = self.get_queryset().filter(job_id=job_id)
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)


class LoginLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for login logs.
    Only Owners can view.
    """
    serializer_class = LoginLogSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['success', 'user']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return LoginLog.objects.none()
        
        # Show login logs for users in the same organization
        org_users = user.organization.users.values_list('email', flat=True)
        return LoginLog.objects.filter(email__in=org_users)


class DataExportLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for data export logs.
    Only Owners can view.
    """
    serializer_class = DataExportLogSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['export_type', 'user']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return DataExportLog.objects.none()
        
        # Show export logs for users in the same organization
        org_users = user.organization.users.values_list('id', flat=True)
        return DataExportLog.objects.filter(user__in=org_users)
