"""
Notification serializers.
"""

from rest_framework import serializers
from notifications.models import (
    NotificationLog, NotificationTemplate, InternalAlert,
    NotificationType, NotificationChannel
)


class NotificationTemplateSerializer(serializers.ModelSerializer):
    """Serializer for notification templates."""
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )
    channel_display = serializers.CharField(
        source='get_channel_display', read_only=True
    )
    
    class Meta:
        model = NotificationTemplate
        fields = [
            'id', 'branch', 'notification_type', 'notification_type_display',
            'channel', 'channel_display', 'subject', 'template_text',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class NotificationLogSerializer(serializers.ModelSerializer):
    """Serializer for notification logs."""
    notification_type_display = serializers.CharField(
        source='get_notification_type_display', read_only=True
    )
    channel_display = serializers.CharField(
        source='get_channel_display', read_only=True
    )
    job_number = serializers.CharField(source='job.job_number', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    
    class Meta:
        model = NotificationLog
        fields = [
            'id', 'branch', 'notification_type', 'notification_type_display',
            'channel', 'channel_display',
            'recipient_mobile', 'recipient_email', 'recipient_name',
            'subject', 'message',
            'job', 'job_number', 'invoice', 'invoice_number',
            'status', 'error_message', 'retry_count',
            'created_at'
        ]
        read_only_fields = fields


class InternalAlertSerializer(serializers.ModelSerializer):
    """Serializer for internal alerts."""
    read_by_name = serializers.CharField(
        source='read_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = InternalAlert
        fields = [
            'id', 'branch', 'alert_type', 'message', 'priority',
            'related_model', 'related_object_id',
            'is_read', 'is_dismissed', 'read_by', 'read_by_name', 'read_at',
            'created_at'
        ]
        read_only_fields = [
            'id', 'alert_type', 'message', 'priority',
            'related_model', 'related_object_id',
            'read_by', 'read_at', 'created_at'
        ]


class SendNotificationSerializer(serializers.Serializer):
    """Serializer for sending custom notifications."""
    channel = serializers.ChoiceField(choices=NotificationChannel.choices)
    recipient_mobile = serializers.CharField(required=False, allow_blank=True)
    recipient_email = serializers.EmailField(required=False, allow_blank=True)
    recipient_name = serializers.CharField(required=False, allow_blank=True)
    subject = serializers.CharField(required=False, allow_blank=True)
    message = serializers.CharField()
    job_id = serializers.UUIDField(required=False)

    def validate(self, data):
        channel = data.get('channel')
        
        if channel in [NotificationChannel.SMS, NotificationChannel.WHATSAPP]:
            if not data.get('recipient_mobile'):
                raise serializers.ValidationError({
                    'recipient_mobile': 'Mobile number is required for SMS/WhatsApp.'
                })
        
        if channel == NotificationChannel.EMAIL:
            if not data.get('recipient_email'):
                raise serializers.ValidationError({
                    'recipient_email': 'Email is required for email notifications.'
                })
        
        return data


class NotificationTypeSerializer(serializers.Serializer):
    """Serializer for notification types list."""
    value = serializers.CharField()
    label = serializers.CharField()


class NotificationChannelSerializer(serializers.Serializer):
    """Serializer for notification channels list."""
    value = serializers.CharField()
    label = serializers.CharField()
