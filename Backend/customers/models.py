"""
Customer models with branch-scoped data isolation.
Allows same mobile number across different branches.
"""

from django.db import models
from django.core.validators import RegexValidator
from core.models import TimeStampedModel, Branch
import uuid


class Customer(TimeStampedModel):
    """
    Customer model with branch-level isolation.
    Same customer (mobile) can exist in multiple branches.
    Each branch maintains its own customer record.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='customers'
    )
    
    # Personal Information
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    mobile = models.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                r'^\+?[1-9]\d{9,14}$',
                message="Enter a valid mobile number"
            )
        ],
        db_index=True
    )
    alternate_mobile = models.CharField(
        max_length=15,
        blank=True,
        validators=[
            RegexValidator(
                r'^\+?[1-9]\d{9,14}$',
                message="Enter a valid mobile number"
            )
        ]
    )
    
    # Address
    address_line1 = models.CharField(max_length=255, blank=True)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(
        max_length=6,
        blank=True,
        validators=[
            RegexValidator(r'^\d{6}$', message="Enter a valid 6-digit pincode")
        ]
    )
    state_code = models.CharField(
        max_length=2,
        blank=True,
        help_text="GST State Code for interstate supply determination"
    )
    
    # Business Details (for B2B customers)
    gstin = models.CharField(
        max_length=15,
        blank=True,
        help_text="Customer's GSTIN for B2B invoices"
    )
    company_name = models.CharField(max_length=255, blank=True)
    
    # Communication Preferences
    sms_enabled = models.BooleanField(
        default=True,
        help_text="Send SMS notifications to this customer"
    )
    whatsapp_enabled = models.BooleanField(
        default=True,
        help_text="Send WhatsApp notifications to this customer"
    )
    
    # Notes
    notes = models.TextField(blank=True, help_text="Internal notes about customer")
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['first_name', 'last_name']
        # Allow same mobile in different branches
        unique_together = ['branch', 'mobile']
        indexes = [
            models.Index(fields=['branch', 'mobile']),
            models.Index(fields=['mobile']),
            models.Index(fields=['branch', 'first_name', 'last_name']),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.mobile})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_service_history(self):
        """Get all job cards for this customer."""
        return self.job_cards.all().order_by('-created_at')

    def get_pending_jobs(self):
        """Get pending jobs for this customer."""
        return self.job_cards.exclude(
            status__in=['DELIVERED', 'CANCELLED']
        )

    def get_total_spent(self):
        """Get total amount spent by this customer."""
        from django.db.models import Sum
        from billing.models import Invoice
        total = Invoice.objects.filter(
            job__customer=self,
            status='PAID'
        ).aggregate(total=Sum('total_amount'))['total']
        return total or 0


class CustomerDocument(TimeStampedModel):
    """
    Documents associated with a customer (ID proof, etc.)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name='documents'
    )
    document_type = models.CharField(
        max_length=50,
        choices=[
            ('AADHAR', 'Aadhar Card'),
            ('PAN', 'PAN Card'),
            ('DRIVING_LICENSE', 'Driving License'),
            ('PASSPORT', 'Passport'),
            ('VOTER_ID', 'Voter ID'),
            ('OTHER', 'Other'),
        ]
    )
    document_number = models.CharField(max_length=50, blank=True)
    file = models.FileField(upload_to='customer_documents/')
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.customer.get_full_name()} - {self.document_type}"
