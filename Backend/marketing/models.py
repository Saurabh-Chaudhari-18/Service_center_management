"""
Marketing automation models.

Features:
- Service reminder configuration and tracking
- Google review request automation
- Customer ledger (Khata) entries
"""

from django.db import models
from core.models import TimeStampedModel, Branch, User
from customers.models import Customer
import uuid
from decimal import Decimal


# =====================================================
# Service Reminders
# =====================================================

class ReminderConfig(TimeStampedModel):
    """
    Configuration for automated service reminders per branch.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.OneToOneField(
        Branch,
        on_delete=models.CASCADE,
        related_name='reminder_config'
    )

    # Reminder intervals (days after delivery)
    reminder_1_days = models.PositiveIntegerField(
        default=90,
        help_text="First reminder X days after delivery"
    )
    reminder_2_days = models.PositiveIntegerField(
        default=180,
        help_text="Second reminder X days after delivery"
    )
    reminder_3_days = models.PositiveIntegerField(
        default=365,
        help_text="Third reminder X days after delivery"
    )

    # Templates
    reminder_message = models.TextField(
        default="Hello {customer_name}, it's been {days} days since your {device_type} was serviced at {branch_name}. Book your next service now!",
        help_text="Reminder message template. Variables: {customer_name}, {days}, {device_type}, {branch_name}, {job_number}"
    )

    # Channels
    send_whatsapp = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Reminder Config - {self.branch.name}"


class ServiceReminder(TimeStampedModel):
    """
    Individual reminder record, auto-generated from delivered jobs.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='service_reminders'
    )
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='service_reminders'
    )

    reminder_type = models.CharField(
        max_length=20,
        choices=[
            ('REMINDER_1', 'First Reminder'),
            ('REMINDER_2', 'Second Reminder'),
            ('REMINDER_3', 'Third Reminder'),
        ]
    )
    scheduled_date = models.DateField()
    sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('SENT', 'Sent'),
            ('FAILED', 'Failed'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='PENDING'
    )
    channel = models.CharField(
        max_length=20,
        choices=[
            ('WHATSAPP', 'WhatsApp'),
            ('SMS', 'SMS'),
        ],
        default='WHATSAPP'
    )
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['scheduled_date']
        constraints = [
            models.UniqueConstraint(fields=['job', 'reminder_type'], name='unique_job_service_reminder'),
        ]
        indexes = [
            models.Index(fields=['branch', 'scheduled_date', 'status']),
            models.Index(fields=['customer']),
        ]

    def __str__(self):
        return f"{self.reminder_type} for {self.customer} on {self.scheduled_date}"


# =====================================================
# Google Review Requests
# =====================================================

class ReviewConfig(TimeStampedModel):
    """
    Configuration for automated Google review requests per branch.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.OneToOneField(
        Branch,
        on_delete=models.CASCADE,
        related_name='review_config'
    )

    google_review_link = models.URLField(
        blank=True,
        help_text="Google Maps review link for your business"
    )

    # Trigger timing (hours after delivery)
    send_after_hours = models.PositiveIntegerField(
        default=24,
        help_text="Send review request X hours after delivery"
    )

    # Template
    review_message = models.TextField(
        default="Thank you {customer_name} for choosing {branch_name}! We'd love your feedback. Please leave us a Google review: {review_link}",
        help_text="Review request template. Variables: {customer_name}, {branch_name}, {review_link}"
    )

    send_whatsapp = models.BooleanField(default=True)
    send_sms = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Review Config - {self.branch.name}"


class ReviewRequest(TimeStampedModel):
    """
    Individual review request record.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='review_requests'
    )
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.CASCADE,
        related_name='review_requests'
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='review_requests'
    )

    scheduled_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('SENT', 'Sent'),
            ('FAILED', 'Failed'),
        ],
        default='PENDING'
    )
    error_message = models.TextField(blank=True)

    class Meta:
        ordering = ['-scheduled_at']

    def __str__(self):
        return f"Review request for {self.customer} - {self.status}"


# =====================================================
# Customer Ledger (Khata)
# =====================================================

class CustomerLedgerEntry(TimeStampedModel):
    """
    Customer credit/debit ledger entry (Khata system).
    Tracks all financial transactions with a customer.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='ledger_entries',
        null=True,
        blank=True
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name='ledger_entries'
    )

    entry_type = models.CharField(
        max_length=10,
        choices=[
            ('CREDIT', 'Credit (Customer owes us)'),
            ('DEBIT', 'Debit (We owe customer / Payment received)'),
        ]
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[models.fields.validators.MinValueValidator(Decimal('0.01'))]
    )
    description = models.CharField(max_length=500)
    reference_type = models.CharField(
        max_length=20,
        choices=[
            ('INVOICE', 'Invoice'),
            ('PAYMENT', 'Payment Received'),
            ('ADJUSTMENT', 'Manual Adjustment'),
            ('REFUND', 'Refund'),
            ('ADVANCE', 'Advance Payment'),
        ],
        default='ADJUSTMENT'
    )
    reference_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="Related invoice/payment ID"
    )
    entry_date = models.DateField()
    running_balance = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Running balance after this entry (positive = customer owes)"
    )

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='ledger_entries_created'
    )

    class Meta:
        ordering = ['-entry_date', '-created_at']
        verbose_name_plural = 'Customer ledger entries'
        indexes = [
            models.Index(fields=['customer', 'entry_date']),
            models.Index(fields=['branch', 'customer']),
        ]

    def __str__(self):
        return f"{self.customer} - {self.entry_type}: ₹{self.amount}"
