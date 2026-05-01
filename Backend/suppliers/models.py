"""
Supplier models for vendor management and purchase orders.

Features:
- Supplier directory with contact info
- Purchase order generation
- Supplier payment tracking
"""

from django.db import models
from django.core.validators import MinValueValidator, RegexValidator
from core.models import TimeStampedModel, Branch, User
import uuid
from decimal import Decimal


class Supplier(TimeStampedModel):
    """
    Vendor/Supplier directory for spare parts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='suppliers',
        null=True,
        blank=True
    )

    # Company Info
    name = models.CharField(max_length=255, help_text="Supplier / Company name")
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(
        max_length=15,
        validators=[RegexValidator(r'^\+?[1-9]\d{1,14}$', message="Enter a valid phone number")],
        blank=True
    )
    alternate_phone = models.CharField(max_length=15, blank=True)

    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=6, blank=True)

    # Business Details
    gstin = models.CharField(max_length=15, blank=True, help_text="Supplier GSTIN")
    pan_number = models.CharField(max_length=10, blank=True)

    # Payment Details
    bank_name = models.CharField(max_length=255, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    bank_ifsc = models.CharField(max_length=20, blank=True)
    upi_id = models.CharField(max_length=100, blank=True)
    payment_terms = models.CharField(
        max_length=50,
        choices=[
            ('IMMEDIATE', 'Immediate'),
            ('NET_7', 'Net 7 Days'),
            ('NET_15', 'Net 15 Days'),
            ('NET_30', 'Net 30 Days'),
            ('NET_60', 'Net 60 Days'),
        ],
        default='IMMEDIATE'
    )

    # Categories they supply
    categories = models.TextField(
        blank=True,
        help_text="Comma-separated categories this supplier provides (e.g., Screens, Batteries, Chargers)"
    )

    # Rating
    rating = models.PositiveIntegerField(
        default=0,
        help_text="Supplier rating 0-5"
    )

    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['branch', 'name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class PurchaseOrder(TimeStampedModel):
    """
    Purchase Order issued to a supplier.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='purchase_orders',
        null=True,
        blank=True
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.PROTECT,
        related_name='purchase_orders'
    )

    # PO Details
    po_number = models.CharField(max_length=50, unique=True)
    order_date = models.DateField()
    expected_delivery_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('DRAFT', 'Draft'),
            ('SENT', 'Sent to Supplier'),
            ('CONFIRMED', 'Confirmed'),
            ('PARTIAL', 'Partially Received'),
            ('RECEIVED', 'Fully Received'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='DRAFT'
    )

    # Amounts
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    # Payment
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_purchase_orders'
    )

    class Meta:
        ordering = ['-order_date', '-created_at']
        indexes = [
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['supplier']),
        ]

    def __str__(self):
        return f"PO-{self.po_number} - {self.supplier.name}"

    @property
    def balance_due(self):
        return self.total_amount - self.paid_amount


class PurchaseOrderItem(TimeStampedModel):
    """Items in a purchase order."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='items'
    )
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='po_items'
    )
    description = models.CharField(max_length=500)
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    received_quantity = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.description} x{self.quantity}"

    def save(self, *args, **kwargs):
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)
