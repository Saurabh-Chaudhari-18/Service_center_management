from django.db import models
from core.models import TimeStampedModel, Branch
import uuid
from .job_card import DeviceType

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
