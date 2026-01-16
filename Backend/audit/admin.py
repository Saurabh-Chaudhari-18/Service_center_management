"""
Audit admin configuration.
"""

from django.contrib import admin
from audit.models import AuditLog, DevicePasswordAccessLog, LoginLog, DataExportLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['action', 'model_name', 'object_id', 'user', 'timestamp']
    list_filter = ['action', 'model_name']
    search_fields = ['object_id', 'user__email']
    ordering = ['-timestamp']
    readonly_fields = ['user', 'action', 'model_name', 'object_id', 'details', 'old_values', 'new_values', 'ip_address', 'user_agent', 'request_path', 'timestamp']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(DevicePasswordAccessLog)
class DevicePasswordAccessLogAdmin(admin.ModelAdmin):
    list_display = ['job', 'accessed_by', 'reason', 'accessed_at']
    list_filter = ['accessed_by']
    search_fields = ['job__job_number', 'accessed_by__email', 'reason']
    ordering = ['-accessed_at']
    readonly_fields = ['job', 'accessed_by', 'reason', 'ip_address', 'accessed_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LoginLog)
class LoginLogAdmin(admin.ModelAdmin):
    list_display = ['email', 'success', 'ip_address', 'created_at']
    list_filter = ['success']
    search_fields = ['email']
    ordering = ['-created_at']


@admin.register(DataExportLog)
class DataExportLogAdmin(admin.ModelAdmin):
    list_display = ['report_name', 'export_type', 'user', 'record_count', 'created_at']
    list_filter = ['export_type']
    search_fields = ['report_name', 'user__email']
    ordering = ['-created_at']
