from django.db import models
from core.models import TimeStampedModel, Branch, User
import uuid
from .job_card import JobCard
from .configuration import OutsourceVendor

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
