"""
Audit models for comprehensive logging and security tracking.

Features:
- Generic immutable audit logs
- Device password access logging
- User action tracking
"""

from django.db import models
from core.models import TimeStampedModel, User
import uuid


class AuditLog(TimeStampedModel):
    """
    Generic immutable audit log for all sensitive operations.
    Records are created automatically and cannot be modified or deleted.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # User who performed the action
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='audit_logs',
        null=True  # Allow null for system actions
    )
    
    # Action Details
    action = models.CharField(
        max_length=50,
        db_index=True,
        help_text="Action type (e.g., CREATE, UPDATE, DELETE, STATUS_CHANGE)"
    )
    
    # What was affected
    model_name = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Name of the model/table affected"
    )
    object_id = models.CharField(
        max_length=50,
        db_index=True,
        help_text="ID of the affected object"
    )
    
    # Change Details
    details = models.JSONField(
        default=dict,
        help_text="Additional details about the action"
    )
    old_values = models.JSONField(
        default=dict,
        blank=True,
        help_text="Previous values (for updates)"
    )
    new_values = models.JSONField(
        default=dict,
        blank=True,
        help_text="New values (for updates)"
    )
    
    # Request Context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    request_path = models.CharField(max_length=500, blank=True)
    request_method = models.CharField(max_length=10, blank=True)
    
    # Timestamp is from parent, but add explicit one for immutability
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'action']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['timestamp']),
        ]

    def __str__(self):
        return f"{self.action} on {self.model_name} by {self.user}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("AuditLog records are immutable and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("AuditLog records cannot be deleted.")


class DevicePasswordAccessLog(TimeStampedModel):
    """
    Immutable log of device password access.
    Every access to device passwords is logged for security.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.PROTECT,
        related_name='password_access_logs'
    )
    accessed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='device_password_accesses'
    )
    reason = models.TextField(help_text="Reason for accessing the password")
    
    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Timestamp
    accessed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        ordering = ['-accessed_at']
        verbose_name_plural = 'Device password access logs'

    def __str__(self):
        return f"{self.job.job_number} accessed by {self.accessed_by.email}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("DevicePasswordAccessLog records are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("DevicePasswordAccessLog records cannot be deleted.")


class LoginLog(TimeStampedModel):
    """
    Log of user login attempts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='login_logs',
        null=True  # Null for failed attempts where user doesn't exist
    )
    email = models.EmailField(help_text="Email attempted")
    
    # Result
    success = models.BooleanField(default=False)
    failure_reason = models.CharField(
        max_length=100,
        blank=True,
        help_text="Reason for failure if unsuccessful"
    )
    
    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        status = "Success" if self.success else "Failed"
        return f"{self.email} - {status} - {self.created_at}"


class DataExportLog(TimeStampedModel):
    """
    Log of data exports (reports, Excel downloads, etc.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    user = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='export_logs'
    )
    export_type = models.CharField(
        max_length=50,
        choices=[
            ('REPORT', 'Report'),
            ('INVOICE_PDF', 'Invoice PDF'),
            ('EXCEL', 'Excel Export'),
            ('CSV', 'CSV Export'),
        ]
    )
    report_name = models.CharField(max_length=255)
    
    # Parameters
    parameters = models.JSONField(
        default=dict,
        help_text="Parameters used for the export"
    )
    
    # Result
    record_count = models.PositiveIntegerField(
        default=0,
        help_text="Number of records exported"
    )
    file_size = models.PositiveIntegerField(
        default=0,
        help_text="File size in bytes"
    )
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.report_name} by {self.user.email}"
