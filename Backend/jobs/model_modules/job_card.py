"""
Job Card models with status lifecycle tracking and auditability.

Implements:
- Sequential status transitions only
- Immutable audit trail via JobStatusHistory
- Device password encryption
- Intake photos management
- Accessories checklist
"""

from django.db import models
from django.core.validators import RegexValidator
from django.utils import timezone
from core.models import TimeStampedModel, Branch, SystemSequence, User
from core.utils import encrypt_data, decrypt_data
from core.exceptions import InvalidStatusTransition, JobReadOnlyError
import random
import uuid


class JobStatus(models.TextChoices):
    """
    Job status enum with enforced sequential transitions.
    Based on FRD Section 8.1, with additional states for complete workflow coverage.
    """
    RECEIVED = 'RECEIVED', 'Inward Received'  # Initial status when device is received
    DIAGNOSIS = 'DIAGNOSIS', 'Under Diagnosis'  # Technician is diagnosing (FRD: DIAGNOSIS)
    ESTIMATE_SHARED = 'ESTIMATE_SHARED', 'Estimate Shared'  # Estimate shared with customer
    APPROVED = 'APPROVED', 'Customer Approved'  # Customer approved repair
    REJECTED = 'REJECTED', 'Customer Rejected'  # Customer rejected repair (dead end)
    WAITING_FOR_PARTS = 'WAITING_FOR_PARTS', 'Waiting for Parts'  # FRD: WAITING_FOR_PARTS
    REPAIR_IN_PROGRESS = 'REPAIR_IN_PROGRESS', 'Repair in Progress'  # FRD: REPAIR_IN_PROGRESS
    OUTSOURCED = 'OUTSOURCED', 'Outsourced for Repair'  # Device sent to external vendor
    READY_FOR_DELIVERY = 'READY_FOR_DELIVERY', 'Ready for Delivery'  # FRD: READY_FOR_DELIVERY
    DELIVERED = 'DELIVERED', 'Delivered'  # Device delivered to customer
    CANCELLED = 'CANCELLED', 'Cancelled'  # Job cancelled (dead end)


# Define allowed status transitions (FRD Section 8.2: sequential only)
ALLOWED_STATUS_TRANSITIONS = {
    JobStatus.RECEIVED: [JobStatus.DIAGNOSIS, JobStatus.CANCELLED],
    JobStatus.DIAGNOSIS: [JobStatus.ESTIMATE_SHARED, JobStatus.OUTSOURCED, JobStatus.CANCELLED],
    JobStatus.ESTIMATE_SHARED: [JobStatus.APPROVED, JobStatus.REJECTED, JobStatus.CANCELLED],
    JobStatus.APPROVED: [JobStatus.WAITING_FOR_PARTS, JobStatus.REPAIR_IN_PROGRESS, JobStatus.OUTSOURCED, JobStatus.CANCELLED],
    JobStatus.REJECTED: [],  # Terminal state
    JobStatus.WAITING_FOR_PARTS: [JobStatus.REPAIR_IN_PROGRESS, JobStatus.OUTSOURCED, JobStatus.CANCELLED],
    JobStatus.REPAIR_IN_PROGRESS: [JobStatus.WAITING_FOR_PARTS, JobStatus.READY_FOR_DELIVERY, JobStatus.OUTSOURCED, JobStatus.CANCELLED],
    JobStatus.OUTSOURCED: [JobStatus.REPAIR_IN_PROGRESS, JobStatus.READY_FOR_DELIVERY, JobStatus.CANCELLED],
    JobStatus.READY_FOR_DELIVERY: [JobStatus.DELIVERED, JobStatus.REPAIR_IN_PROGRESS],  # Can go back if issues found
    JobStatus.DELIVERED: [],  # Terminal state (FRD: Job becomes read-only after delivery)
    JobStatus.CANCELLED: [],  # Terminal state
}


class DeviceType(models.TextChoices):
    """Types of devices accepted for repair."""
    LAPTOP = 'LAPTOP', 'Laptop'
    DESKTOP = 'DESKTOP', 'Desktop'
    ALL_IN_ONE = 'ALL_IN_ONE', 'All-in-One'
    MONITOR = 'MONITOR', 'Monitor'
    PRINTER = 'PRINTER', 'Printer'
    UPS = 'UPS', 'UPS'
    OTHER = 'OTHER', 'Other'


class AccessoryType(models.TextChoices):
    """Standard accessories checklist items."""
    CHARGER = 'CHARGER', 'Charger/Adapter'
    BATTERY = 'BATTERY', 'Battery'
    BAG = 'BAG', 'Laptop Bag'
    MOUSE = 'MOUSE', 'Mouse'
    KEYBOARD = 'KEYBOARD', 'Keyboard'
    POWER_CABLE = 'POWER_CABLE', 'Power Cable'
    USB_CABLE = 'USB_CABLE', 'USB Cable'
    HDMI_CABLE = 'HDMI_CABLE', 'HDMI Cable'
    RAM = 'RAM', 'RAM Module'
    HDD = 'HDD', 'Hard Drive'
    SSD = 'SSD', 'SSD'
    OTHER = 'OTHER', 'Other'


class JobCard(TimeStampedModel):
    """
    Main job card / repair inward challan model.

    Key features:
    - Branch-scoped with unique job number per branch per financial year
    - Sequential status lifecycle with full audit trail
    - Encrypted device passwords
    - Accessories checklist
    - Intake photos
    - Technician assignment
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='job_cards',
        null=True,
        blank=True
    )
    job_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Auto-generated branch-scoped job number"
    )
    tracking_pin = models.CharField(
        max_length=4,
        blank=True,
        default='',
        help_text="Customer-facing PIN for public job tracking (digits only)",
    )
    received_date = models.DateField(
        default=timezone.localdate,
        help_text="The date the device was actually received from the customer"
    )

    # Customer
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='job_cards'
    )

    # Device Information
    device_type = models.CharField(
        max_length=20,
        choices=DeviceType.choices,
        default=DeviceType.LAPTOP
    )
    brand = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, blank=True)

    # Device passwords (encrypted at rest)
    _device_password = models.TextField(
        blank=True,
        db_column='device_password',
        help_text="Encrypted device password"
    )
    _bios_password = models.TextField(
        blank=True,
        db_column='bios_password',
        help_text="Encrypted BIOS password"
    )

    # Problem Description
    customer_complaint = models.TextField(
        help_text="Customer's description of the problem"
    )

    # Physical Condition (JSON: {"selected": ["uuid1", ...], "other_text": "..."})
    physical_condition = models.JSONField(
        default=dict,
        blank=True,
        help_text="Physical condition selections and optional text"
    )

    # Engineer Diagnosis (JSON: {"selected": ["uuid1", ...], "other_text": "..."})
    engineer_diagnosis = models.JSONField(
        default=dict,
        blank=True,
        help_text="Engineer diagnosis selections and optional text"
    )

    # Additional Comments
    additional_comments = models.TextField(
        blank=True,
        help_text="Additional comments or notes"
    )

    # Status
    status = models.CharField(
        max_length=20,
        choices=JobStatus.choices,
        default=JobStatus.RECEIVED,
        db_index=True
    )

    # Assignment
    assigned_technician = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_jobs',
        limit_choices_to={'role': 'TECHNICIAN'}
    )
    received_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='received_jobs',
        help_text="User who received the device"
    )

    # Diagnosis (by technician)
    diagnosis_notes = models.TextField(
        blank=True,
        help_text="Internal diagnosis notes (not shared with customer)"
    )

    # Estimate
    estimated_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated repair cost"
    )
    estimated_completion_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected completion date"
    )

    # Customer Response
    customer_approval_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When customer approved the estimate"
    )
    customer_rejection_reason = models.TextField(
        blank=True,
        help_text="Reason if customer rejected repair"
    )

    # Completion
    completion_notes = models.TextField(
        blank=True,
        help_text="Work done notes"
    )
    actual_completion_date = models.DateTimeField(
        null=True,
        blank=True
    )

    # Delivery
    delivery_date = models.DateTimeField(
        null=True,
        blank=True
    )
    delivery_otp = models.CharField(
        max_length=128,
        blank=True,
        help_text="Hashed OTP for device delivery"
    )
    delivery_otp_created_at = models.DateTimeField(null=True, blank=True)
    delivery_otp_expires_at = models.DateTimeField(null=True, blank=True)
    delivery_otp_attempts = models.PositiveSmallIntegerField(default=0)
    delivery_signature = models.ImageField(
        upload_to='delivery_signatures/',
        null=True,
        blank=True,
        help_text="Customer signature at delivery"
    )
    delivered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='delivered_jobs'
    )

    # Priority
    is_urgent = models.BooleanField(
        default=False,
        help_text="Mark job as urgent/priority"
    )

    # Warranty
    is_warranty_repair = models.BooleanField(
        default=False,
        help_text="This is a warranty repair"
    )
    warranty_details = models.TextField(
        blank=True,
        help_text="Warranty claim details"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['branch', 'status', 'created_at']),  # pending-jobs dashboard
            models.Index(fields=['branch', 'job_number']),
            models.Index(fields=['customer']),
            models.Index(fields=['assigned_technician', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.job_number} - {self.customer.get_full_name()}"

    @property
    def device_password(self):
        """Decrypt and return device password."""
        if self._device_password:
            return decrypt_data(self._device_password)
        return ''

    @device_password.setter
    def device_password(self, value):
        """Encrypt and store device password."""
        if value:
            self._device_password = encrypt_data(value)
        else:
            self._device_password = ''

    @property
    def bios_password(self):
        """Decrypt and return BIOS password."""
        if self._bios_password:
            return decrypt_data(self._bios_password)
        return ''

    @bios_password.setter
    def bios_password(self, value):
        """Encrypt and store BIOS password."""
        if value:
            self._bios_password = encrypt_data(value)
        else:
            self._bios_password = ''

    def is_terminal_status(self):
        """Check if job is in a terminal (read-only) status."""
        return self.status in [JobStatus.DELIVERED, JobStatus.CANCELLED, JobStatus.REJECTED]

    def can_transition_to(self, new_status):
        """Check if transition to new_status is allowed."""
        allowed = ALLOWED_STATUS_TRANSITIONS.get(self.status, [])
        return new_status in allowed

    def transition_status(self, new_status, user, notes='', is_override=False):
        """
        Transition job to new status with validation.

        Args:
            new_status: Target status
            user: User performing the transition
            notes: Optional notes for this transition
            is_override: If True, bypass normal transition rules (Owner/Manager only)

        Raises:
            JobReadOnlyError: If job is in terminal status
            InvalidStatusTransition: If transition is not allowed
        """
        from jobs.application import JobLifecycleService

        return JobLifecycleService.transition(
            self, new_status, user, notes=notes, is_override=is_override
        )

    def generate_delivery_otp(self):
        """Generate, hash and send a short-lived delivery OTP."""
        from datetime import timedelta
        from django.conf import settings
        from django.contrib.auth.hashers import make_password
        from core.utils import generate_otp
        raw_otp = generate_otp()
        now = timezone.now()
        self.delivery_otp = make_password(raw_otp)
        self.delivery_otp_created_at = now
        self.delivery_otp_expires_at = now + timedelta(
            minutes=getattr(settings, 'DELIVERY_OTP_TTL_MINUTES', 10)
        )
        self.delivery_otp_attempts = 0
        self.save(update_fields=[
            'delivery_otp', 'delivery_otp_created_at',
            'delivery_otp_expires_at', 'delivery_otp_attempts', 'updated_at',
        ])

        # Send OTP to customer
        from notifications.services import NotificationService
        delivery_result = NotificationService.send_delivery_otp(self, raw_otp)

        return raw_otp, delivery_result

    def verify_delivery_otp(self, otp):
        """Verify an unexpired OTP and count failed attempts."""
        from django.conf import settings
        from django.contrib.auth.hashers import check_password

        max_attempts = getattr(settings, 'DELIVERY_OTP_MAX_ATTEMPTS', 5)
        if not self.delivery_otp or not self.delivery_otp_expires_at:
            return False, 'missing'
        if self.delivery_otp_attempts >= max_attempts:
            return False, 'locked'
        if timezone.now() > self.delivery_otp_expires_at:
            return False, 'expired'
        if not check_password(str(otp), self.delivery_otp):
            self.delivery_otp_attempts += 1
            self.save(update_fields=['delivery_otp_attempts', 'updated_at'])
            return False, 'locked' if self.delivery_otp_attempts >= max_attempts else 'incorrect'
        return True, 'valid'

    def get_total_parts_cost(self):
        """Calculate total cost of diagnosis parts."""
        from django.db.models import Sum, F
        total = self.diagnosis_parts.aggregate(
            total=Sum(F('quantity') * F('price'))
        )['total']
        return total or 0

    def get_universal_job_number(self):
        """Generate a universal job number when no branch is assigned."""
        prefix = "UNIV-JC-"
        target_date = self.received_date or timezone.now().date()
        if hasattr(target_date, 'date'):
            target_date = target_date.date()
        year = str(target_date.year)[-2:]
        sequence = SystemSequence.next_value(f'universal-job:{year}')
        return f"{prefix}{year}-{sequence:04d}"

    def save(self, *args, **kwargs):
        # Generate job number if not set
        if not self.job_number:
            if self.branch:
                self.job_number = self.branch.get_next_jobcard_number(self.received_date)
            else:
                self.job_number = self.get_universal_job_number()
        if not self.tracking_pin:
            self.tracking_pin = str(random.randint(1000, 9999))
        super().save(*args, **kwargs)
