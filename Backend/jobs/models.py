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
from core.models import TimeStampedModel, Branch, User
from core.utils import encrypt_data, decrypt_data
from core.exceptions import InvalidStatusTransition, JobReadOnlyError
import uuid


class JobStatus(models.TextChoices):
    """
    Job status enum with enforced sequential transitions.
    """
    RECEIVED = 'RECEIVED', 'Received'  # Initial status when device is received
    DIAGNOSED = 'DIAGNOSED', 'Diagnosed'  # Technician has diagnosed the issue
    ESTIMATE_SHARED = 'ESTIMATE_SHARED', 'Estimate Shared'  # Estimate shared with customer
    APPROVED = 'APPROVED', 'Approved'  # Customer approved repair
    REJECTED = 'REJECTED', 'Rejected'  # Customer rejected repair (dead end)
    IN_PROGRESS = 'IN_PROGRESS', 'In Progress'  # Repair work in progress
    ON_HOLD = 'ON_HOLD', 'On Hold'  # Waiting for parts/approval
    READY = 'READY', 'Ready for Pickup'  # Repair complete, ready for delivery
    DELIVERED = 'DELIVERED', 'Delivered'  # Device delivered to customer
    CANCELLED = 'CANCELLED', 'Cancelled'  # Job cancelled (dead end)


# Define allowed status transitions
ALLOWED_STATUS_TRANSITIONS = {
    JobStatus.RECEIVED: [JobStatus.DIAGNOSED, JobStatus.CANCELLED],
    JobStatus.DIAGNOSED: [JobStatus.ESTIMATE_SHARED, JobStatus.CANCELLED],
    JobStatus.ESTIMATE_SHARED: [JobStatus.APPROVED, JobStatus.REJECTED, JobStatus.CANCELLED],
    JobStatus.APPROVED: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
    JobStatus.REJECTED: [],  # Terminal state
    JobStatus.IN_PROGRESS: [JobStatus.ON_HOLD, JobStatus.READY, JobStatus.CANCELLED],
    JobStatus.ON_HOLD: [JobStatus.IN_PROGRESS, JobStatus.CANCELLED],
    JobStatus.READY: [JobStatus.DELIVERED, JobStatus.IN_PROGRESS],  # Can go back to repair if issues found
    JobStatus.DELIVERED: [],  # Terminal state
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
        related_name='job_cards'
    )
    job_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Auto-generated branch-scoped job number"
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
    
    # Physical Condition
    physical_condition = models.TextField(
        help_text="Physical condition of device on receipt (scratches, dents, etc.)"
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
        max_length=6,
        blank=True,
        help_text="OTP for device delivery"
    )
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
        from django.db import transaction
        
        if self.is_terminal_status() and not is_override:
            raise JobReadOnlyError(
                f"Job {self.job_number} is in {self.get_status_display()} status and cannot be modified."
            )
        
        if not is_override and not self.can_transition_to(new_status):
            raise InvalidStatusTransition(
                f"Cannot transition from {self.get_status_display()} to {new_status.label}"
            )
        
        old_status = self.status
        
        with transaction.atomic():
            self.status = new_status
            
            # Update related timestamps
            if new_status == JobStatus.READY:
                self.actual_completion_date = timezone.now()
            elif new_status == JobStatus.DELIVERED:
                self.delivery_date = timezone.now()
            
            self.save()
            
            # Create status history record
            JobStatusHistory.objects.create(
                job=self,
                from_status=old_status,
                to_status=new_status,
                changed_by=user,
                notes=notes,
                is_override=is_override
            )
            
            # Trigger notifications
            from notifications.services import NotificationService
            NotificationService.on_job_status_change(self, old_status, new_status)

    def generate_delivery_otp(self):
        """Generate OTP for delivery."""
        from core.utils import generate_otp
        self.delivery_otp = generate_otp()
        self.save(update_fields=['delivery_otp', 'updated_at'])
        
        # Send OTP to customer
        from notifications.services import NotificationService
        NotificationService.send_delivery_otp(self)
        
        return self.delivery_otp

    def verify_delivery_otp(self, otp):
        """Verify delivery OTP."""
        return self.delivery_otp == otp

    def get_total_parts_cost(self):
        """Calculate total cost of parts used."""
        from django.db.models import Sum, F
        total = self.part_usages.aggregate(
            total=Sum(F('quantity') * F('unit_price'))
        )['total']
        return total or 0

    def save(self, *args, **kwargs):
        # Generate job number if not set
        if not self.job_number:
            self.job_number = self.branch.get_next_jobcard_number()
        super().save(*args, **kwargs)


class JobStatusHistory(TimeStampedModel):
    """
    Immutable audit trail for job status changes.
    Every status transition is logged and cannot be modified.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    from_status = models.CharField(max_length=20, choices=JobStatus.choices)
    to_status = models.CharField(max_length=20, choices=JobStatus.choices)
    changed_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='status_changes'
    )
    notes = models.TextField(blank=True)
    is_override = models.BooleanField(
        default=False,
        help_text="True if status was changed via manual override"
    )
    
    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Job status histories'

    def __str__(self):
        return f"{self.job.job_number}: {self.from_status} → {self.to_status}"

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValueError("JobStatusHistory records are immutable")
        super().save(*args, **kwargs)


class JobAccessory(models.Model):
    """
    Accessories checklist for job card.
    Records what accessories were received with the device.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='accessories'
    )
    accessory_type = models.CharField(
        max_length=20,
        choices=AccessoryType.choices
    )
    description = models.CharField(
        max_length=255,
        blank=True,
        help_text="Additional description for 'Other' type"
    )
    condition = models.CharField(
        max_length=255,
        blank=True,
        help_text="Condition of the accessory"
    )
    is_present = models.BooleanField(
        default=True,
        help_text="Was this accessory received with device"
    )
    
    class Meta:
        unique_together = ['job', 'accessory_type']

    def __str__(self):
        return f"{self.job.job_number} - {self.get_accessory_type_display()}"


class JobPhoto(TimeStampedModel):
    """
    Photos of device at intake or during repair.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='photos'
    )
    photo = models.ImageField(upload_to='job_photos/')
    photo_type = models.CharField(
        max_length=20,
        choices=[
            ('INTAKE', 'Intake Photo'),
            ('DAMAGE', 'Damage Photo'),
            ('REPAIR', 'Repair Photo'),
            ('COMPLETED', 'Completed Photo'),
        ],
        default='INTAKE'
    )
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True
    )
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job.job_number} - {self.photo_type}"


class JobNote(TimeStampedModel):
    """
    Internal notes on a job.
    Only visible to staff, not customers.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='notes'
    )
    note = models.TextField()
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT
    )
    is_internal = models.BooleanField(
        default=True,
        help_text="Internal notes are not visible to customers"
    )
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job.job_number} - Note by {self.created_by}"


class PartRequest(TimeStampedModel):
    """
    Parts requested by technician for a job.
    Links to inventory when approved.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='part_requests'
    )
    requested_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='part_requests_made'
    )
    
    # Either link to existing inventory or describe new part needed
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='requests'
    )
    part_name = models.CharField(
        max_length=255,
        help_text="Part name (for non-inventory items)"
    )
    quantity = models.PositiveIntegerField(default=1)
    
    # Approval
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending Approval'),
            ('APPROVED', 'Approved'),
            ('REJECTED', 'Rejected'),
            ('USED', 'Used'),
        ],
        default='PENDING'
    )
    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='part_approvals'
    )
    rejection_reason = models.TextField(blank=True)
    
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job.job_number} - {self.part_name}"

    def approve(self, user):
        """Approve part request and deduct from inventory."""
        from django.db import transaction
        from inventory.models import InventoryItem
        from core.exceptions import InsufficientInventory
        
        with transaction.atomic():
            if self.inventory_item:
                # Check stock availability
                if self.inventory_item.quantity < self.quantity:
                    raise InsufficientInventory(
                        f"Not enough stock for {self.part_name}. "
                        f"Requested: {self.quantity}, Available: {self.inventory_item.quantity}"
                    )
                
                # Deduct from inventory
                self.inventory_item.deduct_stock(
                    self.quantity,
                    f"Used for job {self.job.job_number}"
                )
            
            self.status = 'APPROVED'
            self.approved_by = user
            self.save()
