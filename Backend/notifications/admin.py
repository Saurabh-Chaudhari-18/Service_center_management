"""
Notifications admin configuration.
"""

from django.contrib import admin
from notifications.models import NotificationTemplate, NotificationLog, InternalAlert


@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ['branch', 'notification_type', 'channel', 'is_active', 'created_at']
    list_filter = ['notification_type', 'channel', 'branch', 'is_active']
    search_fields = ['template_text']


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ['notification_type', 'channel', 'recipient_mobile', 'status', 'created_at']
    list_filter = ['notification_type', 'channel', 'status', 'branch']
    search_fields = ['recipient_mobile', 'recipient_email', 'message']
    ordering = ['-created_at']
    readonly_fields = ['branch', 'notification_type', 'channel', 'recipient_mobile', 'recipient_email', 'message', 'status', 'created_at']


@admin.register(InternalAlert)
class InternalAlertAdmin(admin.ModelAdmin):
    list_display = ['alert_type', 'priority', 'message', 'is_read', 'branch', 'created_at']
    list_filter = ['alert_type', 'priority', 'is_read', 'is_dismissed', 'branch']
    search_fields = ['message']
    ordering = ['-created_at']
