"""
Audit serializers.
"""

from rest_framework import serializers
from audit.models import AuditLog, DevicePasswordAccessLog, LoginLog, DataExportLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit logs (read-only)."""
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'user_name',
            'action', 'model_name', 'object_id',
            'details', 'old_values', 'new_values',
            'ip_address', 'request_path', 'request_method',
            'timestamp'
        ]
        read_only_fields = fields


class DevicePasswordAccessLogSerializer(serializers.ModelSerializer):
    """Serializer for device password access logs (read-only)."""
    job_number = serializers.CharField(source='job.job_number', read_only=True)
    accessed_by_name = serializers.CharField(
        source='accessed_by.get_full_name', read_only=True
    )
    accessed_by_email = serializers.CharField(
        source='accessed_by.email', read_only=True
    )
    
    class Meta:
        model = DevicePasswordAccessLog
        fields = [
            'id', 'job', 'job_number',
            'accessed_by', 'accessed_by_name', 'accessed_by_email',
            'reason', 'ip_address', 'accessed_at'
        ]
        read_only_fields = fields


class LoginLogSerializer(serializers.ModelSerializer):
    """Serializer for login logs (read-only)."""
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = LoginLog
        fields = [
            'id', 'user', 'user_name', 'email',
            'success', 'failure_reason',
            'ip_address', 'created_at'
        ]
        read_only_fields = fields


class DataExportLogSerializer(serializers.ModelSerializer):
    """Serializer for data export logs (read-only)."""
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = DataExportLog
        fields = [
            'id', 'user', 'user_name', 'user_email',
            'export_type', 'report_name', 'parameters',
            'record_count', 'file_size', 'created_at'
        ]
        read_only_fields = fields
