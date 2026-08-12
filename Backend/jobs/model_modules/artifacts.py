from django.db import models
from core.models import TimeStampedModel, User
import uuid
from .job_card import JobCard, JobStatus, AccessoryType

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
