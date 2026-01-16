"""
Notification models for SMS/WhatsApp messaging.

Features:
- Configurable notification templates
- Message logging with status tracking
- Support for SMS and WhatsApp
"""

from django.db import models
from core.models import TimeStampedModel, Branch, User
import uuid


class NotificationType(models.TextChoices):
    """Types of notifications."""
    JOB_CREATED = 'JOB_CREATED', 'Job Created'
    JOB_DIAGNOSED = 'JOB_DIAGNOSED', 'Job Diagnosed'
    ESTIMATE_SHARED = 'ESTIMATE_SHARED', 'Estimate Shared'
    JOB_READY = 'JOB_READY', 'Job Ready for Pickup'
    DELIVERY_OTP = 'DELIVERY_OTP', 'Delivery OTP'
    JOB_DELIVERED = 'JOB_DELIVERED', 'Job Delivered'
    PAYMENT_RECEIVED = 'PAYMENT_RECEIVED', 'Payment Received'
    PAYMENT_REMINDER = 'PAYMENT_REMINDER', 'Payment Reminder'
    LOW_STOCK_ALERT = 'LOW_STOCK_ALERT', 'Low Stock Alert'
    CUSTOM = 'CUSTOM', 'Custom Message'


class NotificationChannel(models.TextChoices):
    """Notification delivery channels."""
    SMS = 'SMS', 'SMS'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    EMAIL = 'EMAIL', 'Email'
    INTERNAL = 'INTERNAL', 'Internal Alert'


class NotificationTemplate(TimeStampedModel):
    """
    Configurable notification templates per branch.
    Supports placeholders for dynamic content.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='notification_templates'
    )
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices
    )
    channel = models.CharField(
        max_length=20,
        choices=NotificationChannel.choices
    )
    
    # Template content
    subject = models.CharField(
        max_length=255,
        blank=True,
        help_text="Subject line (for email)"
    )
    template_text = models.TextField(
        help_text=(
            "Template text with placeholders. Available: "
            "{customer_name}, {job_number}, {branch_name}, {device}, "
            "{status}, {amount}, {otp}, {invoice_number}"
        )
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ['branch', 'notification_type', 'channel']
        ordering = ['notification_type', 'channel']

    def __str__(self):
        return f"{self.branch.name} - {self.notification_type} ({self.channel})"

    def render(self, context: dict) -> str:
        """Render template with provided context."""
        text = self.template_text
        for key, value in context.items():
            text = text.replace(f'{{{key}}}', str(value))
        return text


class NotificationLog(TimeStampedModel):
    """
    Log of all notifications sent.
    Tracks delivery status and failures.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='notification_logs'
    )
    
    # Notification Details
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices
    )
    channel = models.CharField(
        max_length=20,
        choices=NotificationChannel.choices
    )
    
    # Recipient
    recipient_mobile = models.CharField(max_length=15, blank=True)
    recipient_email = models.EmailField(blank=True)
    recipient_name = models.CharField(max_length=255, blank=True)
    
    # Message
    subject = models.CharField(max_length=255, blank=True)
    message = models.TextField()
    
    # Related Objects
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    invoice = models.ForeignKey(
        'billing.Invoice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='notifications'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('SENT', 'Sent'),
            ('DELIVERED', 'Delivered'),
            ('FAILED', 'Failed'),
        ],
        default='PENDING'
    )
    provider_response = models.JSONField(
        null=True,
        blank=True,
        help_text="Response from SMS/WhatsApp provider"
    )
    error_message = models.TextField(blank=True)
    
    # Retry
    retry_count = models.PositiveIntegerField(default=0)
    last_retry_at = models.DateTimeField(null=True, blank=True)
    
    # Sent By (for manual notifications)
    sent_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sent_notifications'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['branch', 'notification_type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.notification_type} to {self.recipient_mobile or self.recipient_email}"

    def mark_sent(self, provider_response=None):
        """Mark notification as sent."""
        self.status = 'SENT'
        self.provider_response = provider_response
        self.save(update_fields=['status', 'provider_response', 'updated_at'])

    def mark_failed(self, error_message, provider_response=None):
        """Mark notification as failed."""
        self.status = 'FAILED'
        self.error_message = error_message
        self.provider_response = provider_response
        self.retry_count += 1
        self.save(update_fields=[
            'status', 'error_message', 'provider_response',
            'retry_count', 'updated_at'
        ])


class InternalAlert(TimeStampedModel):
    """
    Internal alerts for staff (low stock, pending actions, etc.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='internal_alerts'
    )
    alert_type = models.CharField(
        max_length=30,
        choices=[
            ('LOW_STOCK', 'Low Stock'),
            ('OVERDUE_JOB', 'Overdue Job'),
            ('PENDING_PAYMENT', 'Pending Payment'),
            ('PENDING_APPROVAL', 'Pending Approval'),
            ('SYSTEM', 'System Alert'),
        ]
    )
    message = models.TextField()
    priority = models.CharField(
        max_length=10,
        choices=[
            ('LOW', 'Low'),
            ('MEDIUM', 'Medium'),
            ('HIGH', 'High'),
            ('CRITICAL', 'Critical'),
        ],
        default='MEDIUM'
    )
    
    # Related object
    related_model = models.CharField(max_length=50, blank=True)
    related_object_id = models.UUIDField(null=True, blank=True)
    
    # Status
    is_read = models.BooleanField(default=False)
    is_dismissed = models.BooleanField(default=False)
    read_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='read_alerts'
    )
    read_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.alert_type}: {self.message[:50]}"

    def mark_read(self, user):
        """Mark alert as read."""
        from django.utils import timezone
        self.is_read = True
        self.read_by = user
        self.read_at = timezone.now()
        self.save(update_fields=['is_read', 'read_by', 'read_at', 'updated_at'])
