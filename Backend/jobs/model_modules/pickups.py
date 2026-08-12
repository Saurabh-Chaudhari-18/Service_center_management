from django.db import models
from core.models import TimeStampedModel, Branch, User
import uuid
from .job_card import JobCard, DeviceType

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
