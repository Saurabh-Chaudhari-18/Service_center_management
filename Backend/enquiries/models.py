"""
Enquiry / Lead management models.

Features:
- Track walk-in, call, and online enquiries
- Follow-up scheduling
- Conversion tracking (Enquiry → Job Card)
- Lead source attribution
"""

from django.db import models
from core.models import TimeStampedModel, Branch, User
from customers.models import Customer
import uuid


class LeadSource(models.TextChoices):
    """How the lead found us."""
    WALK_IN = 'WALK_IN', 'Walk-in'
    PHONE_CALL = 'PHONE_CALL', 'Phone Call'
    WHATSAPP = 'WHATSAPP', 'WhatsApp'
    WEBSITE = 'WEBSITE', 'Website'
    GOOGLE = 'GOOGLE', 'Google Search'
    SOCIAL_MEDIA = 'SOCIAL_MEDIA', 'Social Media'
    REFERRAL = 'REFERRAL', 'Referral'
    JUSTDIAL = 'JUSTDIAL', 'JustDial'
    SULEKHA = 'SULEKHA', 'Sulekha'
    OTHER = 'OTHER', 'Other'


class EnquiryStatus(models.TextChoices):
    """Enquiry lifecycle stages."""
    NEW = 'NEW', 'New'
    CONTACTED = 'CONTACTED', 'Contacted'
    FOLLOW_UP = 'FOLLOW_UP', 'Follow-up Scheduled'
    INTERESTED = 'INTERESTED', 'Interested'
    QUOTED = 'QUOTED', 'Quote Shared'
    CONVERTED = 'CONVERTED', 'Converted to Job'
    LOST = 'LOST', 'Lost / Declined'
    CLOSED = 'CLOSED', 'Closed'


class Enquiry(TimeStampedModel):
    """
    Lead/Enquiry record for tracking non-conversion calls,
    walk-ins, and prospective customers.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='enquiries'
    )

    # Customer Info (may not be existing customer)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='enquiries',
        help_text="Link to existing customer, if applicable"
    )
    customer_name = models.CharField(max_length=255, help_text="Name of prospect")
    customer_mobile = models.CharField(max_length=15)
    customer_email = models.EmailField(blank=True)

    # Device Info
    device_type = models.CharField(max_length=50, blank=True)
    brand = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=255, blank=True)

    # Enquiry Details
    problem_description = models.TextField(
        help_text="What the customer described as the issue"
    )
    quoted_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        help_text="Price quoted to the customer"
    )

    # Tracking
    source = models.CharField(
        max_length=20,
        choices=LeadSource.choices,
        default=LeadSource.WALK_IN
    )
    status = models.CharField(
        max_length=20,
        choices=EnquiryStatus.choices,
        default=EnquiryStatus.NEW
    )

    # Follow-up
    follow_up_date = models.DateField(
        null=True, blank=True,
        help_text="Next follow-up date"
    )
    follow_up_notes = models.TextField(blank=True)

    # Conversion
    converted_job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='from_enquiry'
    )

    # Reason for loss
    loss_reason = models.CharField(
        max_length=50,
        choices=[
            ('PRICE_HIGH', 'Price too high'),
            ('WENT_ELSEWHERE', 'Went to competitor'),
            ('NOT_NEEDED', 'Repair not needed'),
            ('NOT_REACHABLE', 'Customer not reachable'),
            ('DELAYED', 'Too long wait time'),
            ('OTHER', 'Other'),
        ],
        blank=True
    )

    # Assignment
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_enquiries'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_enquiries'
    )

    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Enquiries'
        indexes = [
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['customer_mobile']),
            models.Index(fields=['follow_up_date']),
            models.Index(fields=['source']),
        ]

    def __str__(self):
        return f"{self.customer_name} - {self.problem_description[:50]}"


class EnquiryNote(TimeStampedModel):
    """Follow-up notes / interaction log for an enquiry."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enquiry = models.ForeignKey(
        Enquiry,
        on_delete=models.CASCADE,
        related_name='interaction_notes'
    )
    note = models.TextField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='enquiry_notes'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note on {self.enquiry.customer_name} by {self.created_by}"
