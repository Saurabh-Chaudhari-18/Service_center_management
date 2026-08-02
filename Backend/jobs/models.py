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
        
        from django.db import connection
        
        # Call the stored procedure
        with connection.cursor() as cursor:
            try:
                cursor.execute(
                    "CALL transition_job_status(%s, %s, %s, %s, %s)",
                    [
                        self.id,
                        new_status,
                        user.id,
                        notes,
                        is_override
                    ]
                )
            except Exception as e:
                # Map database exceptions to application exceptions if needed
                # For now, re-raise or handle specific PG errors
                if 'Job is in terminal status' in str(e):
                    raise JobReadOnlyError(str(e))
                elif 'Invalid transition' in str(e):
                    raise InvalidStatusTransition(str(e))
                elif 'Only OWNER or MANAGER' in str(e):
                    raise InvalidStatusTransition(str(e))
                else:
                    raise e
        
        # Refresh instance from DB to get updated status and timestamps
        self.refresh_from_db()

        # Trigger notifications (keeping this in app layer for now)
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
        """Calculate total cost of diagnosis parts."""
        from django.db.models import Sum, F
        total = self.diagnosis_parts.aggregate(
            total=Sum(F('quantity') * F('price'))
        )['total']
        return total or 0

    def get_universal_job_number(self):
        """Generate a universal job number when no branch is assigned."""
        from django.db.models import Max
        
        prefix = "UNIV-JC-"
        target_date = self.received_date or timezone.now().date()
        if hasattr(target_date, 'date'):
            target_date = target_date.date()
        year = str(target_date.year)[-2:]
        prefix_with_year = f"{prefix}{year}-"
        
        last_job = JobCard.objects.filter(
            branch__isnull=True,
            job_number__startswith=prefix_with_year
        ).aggregate(Max('job_number'))['job_number__max']
        
        if last_job:
            try:
                sequence = int(last_job.split('-')[-1]) + 1
            except ValueError:
                sequence = 1
        else:
            sequence = 1
            
        return f"{prefix_with_year}{sequence:04d}"

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
        if not self._state.adding:
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


class DiagnosisPart(models.Model):
    """
    Spare parts identified during diagnosis (manual entry).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='diagnosis_parts'
    )
    name = models.CharField(max_length=255, help_text="Part name")
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Price per unit")
    warranty_months = models.PositiveIntegerField(default=0, help_text="Warranty in months")
    quantity = models.PositiveIntegerField(default=1)
    
    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.job.job_number} - {self.name}"


class PickupRequestStatus(models.TextChoices):
    """Pickup request status lifecycle."""
    REQUESTED = 'REQUESTED', 'Requested'
    ASSIGNED = 'ASSIGNED', 'Assigned'
    EN_ROUTE = 'EN_ROUTE', 'En Route'
    PICKED_UP = 'PICKED_UP', 'Picked Up'
    DELIVERED_TO_CENTER = 'DELIVERED_TO_CENTER', 'Delivered to Center'
    COMPLETED = 'COMPLETED', 'Completed'
    CANCELLED = 'CANCELLED', 'Cancelled'


ALLOWED_PICKUP_TRANSITIONS = {
    PickupRequestStatus.REQUESTED: [PickupRequestStatus.ASSIGNED, PickupRequestStatus.CANCELLED],
    PickupRequestStatus.ASSIGNED: [PickupRequestStatus.EN_ROUTE, PickupRequestStatus.CANCELLED],
    PickupRequestStatus.EN_ROUTE: [PickupRequestStatus.PICKED_UP, PickupRequestStatus.CANCELLED],
    PickupRequestStatus.PICKED_UP: [PickupRequestStatus.DELIVERED_TO_CENTER, PickupRequestStatus.CANCELLED],
    PickupRequestStatus.DELIVERED_TO_CENTER: [PickupRequestStatus.COMPLETED, PickupRequestStatus.CANCELLED],
    PickupRequestStatus.COMPLETED: [],
    PickupRequestStatus.CANCELLED: [],
}


class PickupRequest(TimeStampedModel):
    """
    Pickup & Drop request for customers who can't visit the shop.
    A technician is assigned to pick up the device from the customer's address.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='pickup_requests'
    )
    pickup_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Auto-generated pickup request number"
    )

    # Customer
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.PROTECT,
        related_name='pickup_requests'
    )

    # Linked job card (created after device is picked up)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pickup_requests'
    )

    # Status
    status = models.CharField(
        max_length=25,
        choices=PickupRequestStatus.choices,
        default=PickupRequestStatus.REQUESTED,
        db_index=True
    )

    # Assignment
    assigned_technician = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_pickups',
        limit_choices_to={'role': 'TECHNICIAN'}
    )

    # Device Information (preliminary from phone call)
    device_type = models.CharField(
        max_length=20,
        choices=DeviceType.choices,
        default=DeviceType.LAPTOP
    )
    brand = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    customer_complaint = models.TextField(
        help_text="Issue described by customer on the call"
    )

    # Pickup Details
    pickup_address = models.TextField(
        help_text="Full address for device pickup"
    )
    pickup_date = models.DateField(
        help_text="Scheduled pickup date"
    )
    pickup_time_slot = models.CharField(
        max_length=50,
        blank=True,
        help_text="Preferred time slot (e.g. 10:00 AM - 12:00 PM)"
    )
    contact_number = models.CharField(
        max_length=15,
        help_text="Contact number for pickup"
    )

    # Additional
    notes = models.TextField(blank=True, help_text="Additional notes from staff")
    is_urgent = models.BooleanField(default=False, help_text="Priority pickup")

    # Tracking
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_pickups',
        help_text="Staff who created the pickup request"
    )

    class Meta:
        ordering = ['-is_urgent', '-created_at']
        indexes = [
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['assigned_technician', 'status']),
            models.Index(fields=['customer']),
            models.Index(fields=['pickup_date']),
        ]

    def __str__(self):
        return f"{self.pickup_number} - {self.customer.get_full_name()}"

    def can_transition_to(self, new_status):
        """Check if transition to new_status is allowed."""
        allowed = ALLOWED_PICKUP_TRANSITIONS.get(self.status, [])
        return new_status in allowed

    def save(self, *args, **kwargs):
        if not self.pickup_number:
            self.pickup_number = self._generate_pickup_number()
        super().save(*args, **kwargs)

    def _generate_pickup_number(self):
        """Generate a unique pickup number for this branch."""
        return self.branch.get_next_pickup_number()


class DropdownCategory(models.TextChoices):
    """Categories for configurable dropdown options."""
    PHYSICAL_CONDITION = 'PHYSICAL_CONDITION', 'Physical Condition'
    ENGINEER_DIAGNOSIS = 'ENGINEER_DIAGNOSIS', 'Engineer Diagnosis'


class DropdownOption(TimeStampedModel):
    """
    Configurable dropdown options stored in DB.
    Allows dynamic add/remove of options from the admin panel or API.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.CharField(
        max_length=30,
        choices=DropdownCategory.choices,
        db_index=True,
        help_text="Which dropdown this option belongs to"
    )
    device_type = models.CharField(
        max_length=20,
        choices=DeviceType.choices,
        null=True,
        blank=True,
        help_text="If set, option only shows for this device type. NULL = show for all."
    )
    label = models.CharField(
        max_length=255,
        help_text="Display label for this option"
    )
    display_order = models.IntegerField(
        default=0,
        help_text="Lower numbers appear first"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive options are hidden from dropdowns"
    )
    has_text_input = models.BooleanField(
        default=False,
        help_text="If True, shows a text input when this option is selected (e.g. 'Others')"
    )

    class Meta:
        ordering = ['category', 'device_type', 'display_order', 'label']
        indexes = [
            models.Index(fields=['category', 'device_type', 'is_active']),
        ]

    def __str__(self):
        dt = f" ({self.get_device_type_display()})" if self.device_type else " (All)"
        return f"{self.get_category_display()}{dt}: {self.label}"


# =====================================================
# Outsource Vendor & Outsourced Repair Models
# =====================================================

class OutsourceVendor(TimeStampedModel):
    """
    Directory of external repair vendors / third-party service providers.
    Separate from the Supplier model (which is for parts purchasing).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='outsource_vendors',
        null=True,
        blank=True,
        help_text="Branch that created this vendor. NULL = shared across branches."
    )

    # Vendor Info
    name = models.CharField(max_length=255, help_text="Vendor / shop name")
    contact_person = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=15, help_text="Primary contact number")
    alternate_phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    specialization = models.CharField(
        max_length=255,
        blank=True,
        help_text="What they specialize in (e.g., BGA rework, motherboard repair)"
    )
    notes = models.TextField(blank=True, help_text="Internal notes about this vendor")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class OutsourcedRepairStatus(models.TextChoices):
    """Status of an individual outsource record."""
    SENT = 'SENT', 'Sent to Vendor'
    RETURNED = 'RETURNED', 'Returned from Vendor'
    CANCELLED = 'CANCELLED', 'Cancelled'


class RepairOutcome(models.TextChoices):
    """Outcome of the outsourced repair."""
    REPAIRED = 'REPAIRED', 'Repaired Successfully'
    PARTIALLY_REPAIRED = 'PARTIALLY_REPAIRED', 'Partially Repaired'
    NOT_REPAIRED = 'NOT_REPAIRED', 'Could Not Repair'


class OutsourcedRepair(TimeStampedModel):
    """
    Tracks a single outsource event for a job card or inventory warranty repair.
    A job or inventory part can be outsourced for specialized repair or warranty claims.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        JobCard,
        on_delete=models.CASCADE,
        related_name='outsourced_repairs',
        null=True,
        blank=True
    )
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='outsourced_repairs'
    )
    item_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name/description of item sent for warranty repair"
    )
    serial_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Serial number or invoice reference number"
    )
    customer_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Customer name for warranty claim"
    )
    customer_phone = models.CharField(
        max_length=20,
        blank=True,
        help_text="Customer phone number"
    )
    is_warranty_repair = models.BooleanField(
        default=True,
        help_text="Flag indicating if this is a warranty repair claim"
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='outsourced_repairs'
    )
    vendor = models.ForeignKey(
        OutsourceVendor,
        on_delete=models.PROTECT,
        related_name='repair_jobs',
        help_text="The external vendor handling this repair"
    )

    # Outward details
    reason = models.TextField(help_text="Why the device is being outsourced")
    sent_date = models.DateField(help_text="Date device was sent to vendor")
    estimated_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Vendor's estimated/quoted repair cost"
    )
    expected_return_date = models.DateField(
        null=True,
        blank=True,
        help_text="Expected date of return from vendor"
    )
    notes = models.TextField(blank=True, help_text="Internal notes")
    sent_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='outsourced_sent',
        help_text="Staff member who sent the device"
    )

    # Return details
    status = models.CharField(
        max_length=20,
        choices=OutsourcedRepairStatus.choices,
        default=OutsourcedRepairStatus.SENT,
        db_index=True
    )
    return_date = models.DateField(
        null=True,
        blank=True,
        help_text="Date device was received back from vendor"
    )
    actual_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Actual amount charged by vendor"
    )
    repair_outcome = models.CharField(
        max_length=25,
        choices=RepairOutcome.choices,
        blank=True,
        help_text="Result of the outsourced repair"
    )
    vendor_notes = models.TextField(
        blank=True,
        help_text="What the vendor reported (work done, issues found)"
    )
    vendor_invoice_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Vendor's bill/receipt reference number"
    )
    received_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='outsourced_received',
        help_text="Staff member who received the device back"
    )

    class Meta:
        ordering = ['-sent_date', '-created_at']
        indexes = [
            models.Index(fields=['job', 'status']),
            models.Index(fields=['vendor']),
        ]

    def __str__(self):
        return f"{self.job.job_number} → {self.vendor.name} ({self.get_status_display()})"

