"""
Inventory models with branch-scoped stock management.

Features:
- Per-branch inventory isolation
- Auto-deduct on job usage
- Low stock alerts
- Manual adjustment with audit trail
"""

from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from core.models import TimeStampedModel, Branch, User
from core.exceptions import InsufficientInventory
import uuid
from decimal import Decimal


class UnitType(models.TextChoices):
    """Unit of measure for inventory items. Standardized as TextChoices."""
    PIECES = 'PCS', 'Pieces'
    NUMBERS = 'NOS', 'Numbers'
    METERS = 'MTR', 'Meters'
    SET = 'SET', 'Set'
    BOX = 'BOX', 'Box'
    KILOGRAM = 'KG', 'Kilogram'


class InventoryCategory(TimeStampedModel):
    """Categories for inventory items."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='inventory_categories',
        null=True,
        blank=True
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    class Meta:
        verbose_name_plural = 'Inventory categories'
        constraints = [
            models.UniqueConstraint(fields=['branch', 'name'], name='unique_branch_category_name')
        ]
        ordering = ['name']

    def __str__(self):
        return self.name


class InventoryItem(TimeStampedModel):
    """
    Inventory item with per-branch stock tracking.
    Stock cannot go negative.
    All adjustments are audited.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='inventory_items',
        null=True,
        blank=True
    )
    
    # Item Details
    name = models.CharField(max_length=255)
    sku = models.CharField(
        max_length=50,
        blank=True,
        help_text="Stock Keeping Unit"
    )
    category = models.ForeignKey(
        InventoryCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items'
    )
    description = models.TextField(blank=True)
    
    # Pricing
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Cost price (purchase price)"
    )
    selling_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))],
        help_text="Selling price to customers"
    )
    
    # GST
    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18.00,
        help_text="GST rate percentage"
    )
    hsn_code = models.CharField(
        max_length=8,
        blank=True,
        help_text="HSN/SAC code for GST"
    )
    
    # Stock
    quantity = models.PositiveIntegerField(
        default=0,
        help_text="Current stock quantity"
    )
    low_stock_threshold = models.PositiveIntegerField(
        default=5,
        help_text="Alert when stock falls below this level"
    )
    
    # Unit
    unit = models.CharField(
        max_length=20,
        default=UnitType.PIECES,
        choices=UnitType.choices,
    )
    
    # Location
    location = models.CharField(
        max_length=100,
        blank=True,
        help_text="Storage location in branch"
    )
    
    # Vendor Info
    vendor_name = models.CharField(max_length=255, blank=True)
    vendor_contact = models.CharField(max_length=100, blank=True)
    
    # Warranty
    warranty_period_months = models.PositiveIntegerField(
        default=0,
        help_text="Warranty period in months (0 = no warranty)"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['branch', 'name']),
            models.Index(fields=['branch', 'sku']),
            models.Index(fields=['quantity', 'low_stock_threshold']),
        ]

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

    @property
    def is_low_stock(self):
        """Check if item is below low stock threshold."""
        return self.quantity <= self.low_stock_threshold

    def add_stock(self, quantity, reason='', user=None):
        """
        Add stock with audit logging.
        Uses select_for_update() to prevent race conditions when multiple
        requests try to modify stock simultaneously.

        Args:
            quantity: Amount to add
            reason: Reason for adjustment
            user: User performing the action
        """
        from django.db import transaction

        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        with transaction.atomic():
            # Acquire a row-level lock to prevent Read-Modify-Write race condition.
            # Without this, two concurrent requests would both read the same
            # old_quantity and only deduct once instead of twice.
            locked_item = InventoryItem.objects.select_for_update().get(pk=self.pk)
            old_quantity = locked_item.quantity
            locked_item.quantity += quantity
            locked_item.save(update_fields=['quantity', 'updated_at'])
            # Sync in-memory instance with the DB-updated values
            self.quantity = locked_item.quantity

            # Log the adjustment
            InventoryAdjustment.objects.create(
                item=self,
                adjustment_type='ADD',
                quantity=quantity,
                old_quantity=old_quantity,
                new_quantity=self.quantity,
                reason=reason,
                adjusted_by=user
            )

    def deduct_stock(self, quantity, reason='', user=None, job=None):
        """
        Deduct stock with audit logging.
        Raises InsufficientInventory if not enough stock.
        Uses select_for_update() to prevent race conditions.

        Args:
            quantity: Amount to deduct
            reason: Reason for adjustment
            user: User performing the action
            job: Related job card (optional)
        """
        from django.db import transaction

        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        with transaction.atomic():
            # Acquire a row-level lock BEFORE reading quantity.
            # This prevents two simultaneous invoices from both reading stock=10,
            # both subtracting 1, and both saving 9 — which would lose a unit.
            locked_item = InventoryItem.objects.select_for_update().get(pk=self.pk)

            # Re-check stock availability with the locked, authoritative value
            if locked_item.quantity < quantity:
                raise InsufficientInventory(
                    f"Insufficient stock for {locked_item.name}. "
                    f"Requested: {quantity}, Available: {locked_item.quantity}"
                )

            old_quantity = locked_item.quantity
            locked_item.quantity -= quantity
            locked_item.save(update_fields=['quantity', 'updated_at'])
            # Sync in-memory instance
            self.quantity = locked_item.quantity

            # Log the adjustment
            adjustment = InventoryAdjustment.objects.create(
                item=self,
                adjustment_type='DEDUCT',
                quantity=quantity,
                old_quantity=old_quantity,
                new_quantity=self.quantity,
                reason=reason,
                adjusted_by=user
            )

            # Create job part usage record if job provided
            if job:
                JobPartUsage.objects.create(
                    job=job,
                    inventory_item=self,
                    quantity=quantity,
                    unit_price=self.selling_price,
                    total_price=self.selling_price * quantity,
                    adjustment=adjustment
                )

            # Check for low stock alert
            if self.is_low_stock:
                self._trigger_low_stock_alert()

    def adjust_stock(self, new_quantity, reason, user):
        """
        Manually set stock quantity (for corrections).
        Requires reason and is fully audited.
        Uses select_for_update() to prevent race conditions.
        """
        from django.db import transaction

        if new_quantity < 0:
            raise ValueError("Quantity cannot be negative")

        with transaction.atomic():
            # Lock the row to get the authoritative current quantity
            locked_item = InventoryItem.objects.select_for_update().get(pk=self.pk)
            old_quantity = locked_item.quantity
            quantity_diff = new_quantity - old_quantity

            locked_item.quantity = new_quantity
            locked_item.save(update_fields=['quantity', 'updated_at'])
            # Sync in-memory instance
            self.quantity = locked_item.quantity

            # Log the adjustment
            InventoryAdjustment.objects.create(
                item=self,
                adjustment_type='MANUAL' if quantity_diff >= 0 else 'CORRECTION',
                quantity=abs(quantity_diff),
                old_quantity=old_quantity,
                new_quantity=new_quantity,
                reason=reason,
                adjusted_by=user,
                is_manual_adjustment=True
            )

    def _trigger_low_stock_alert(self):
        """Trigger low stock notification."""
        from notifications.services import NotificationService
        NotificationService.send_low_stock_alert(self)

    def get_price_with_gst(self, is_interstate=False):
        """Calculate price including GST."""
        from core.utils import calculate_gst
        
        gst_calc = calculate_gst(
            self.selling_price,
            self.gst_rate,
            is_interstate
        )
        return gst_calc


class InventoryAdjustment(TimeStampedModel):
    """
    Immutable audit trail for inventory adjustments.
    Every stock change is logged and cannot be modified.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name='adjustments'
    )
    adjustment_type = models.CharField(
        max_length=20,
        choices=[
            ('ADD', 'Stock Added'),
            ('DEDUCT', 'Stock Deducted'),
            ('MANUAL', 'Manual Adjustment'),
            ('CORRECTION', 'Stock Correction'),
            ('RETURN', 'Stock Return'),
            ('DAMAGED', 'Damaged/Lost'),
        ]
    )
    quantity = models.PositiveIntegerField()
    old_quantity = models.PositiveIntegerField()
    new_quantity = models.PositiveIntegerField()
    reason = models.TextField()
    adjusted_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True
    )
    is_manual_adjustment = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.item.name}: {self.adjustment_type} {self.quantity}"

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValueError("InventoryAdjustment records are immutable")
        super().save(*args, **kwargs)


class JobPartUsage(TimeStampedModel):
    """
    Link between job and inventory items used.
    Tracks parts used in repairs with pricing at time of use.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.PROTECT,
        related_name='part_usages'
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name='job_usages'
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Price per unit at time of use"
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Total price (quantity × unit_price)"
    )
    adjustment = models.ForeignKey(
        InventoryAdjustment,
        on_delete=models.PROTECT,
        null=True,
        related_name='job_usage'
    )
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.job.job_number} - {self.inventory_item.name} x{self.quantity}"

    @property
    def warranty_expiry(self):
        """Calculate warranty expiry date for this part."""
        if self.inventory_item.warranty_period_months > 0:
            from datetime import timedelta
            return self.created_at + timedelta(
                days=30 * self.inventory_item.warranty_period_months
            )
        return None


class StockTransfer(TimeStampedModel):
    """
    Transfer stock between branches (future feature).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    from_branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='stock_transfers_out'
    )
    to_branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='stock_transfers_in'
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('IN_TRANSIT', 'In Transit'),
            ('COMPLETED', 'Completed'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='PENDING'
    )
    initiated_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='stock_transfers_initiated'
    )
    completed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stock_transfers_completed'
    )
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Transfer from {self.from_branch.name} to {self.to_branch.name}"


class StockTransferItem(models.Model):
    """Items in a stock transfer."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transfer = models.ForeignKey(
        StockTransfer,
        on_delete=models.CASCADE,
        related_name='items'
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        help_text="Item from source branch"
    )
    quantity = models.PositiveIntegerField()
    
    def __str__(self):
        return f"{self.inventory_item.name} x{self.quantity}"


class Purchase(TimeStampedModel):
    """
    Record of a bulk purchase of inventory from a vendor.
    GST fields allow tracking Input Tax Credit (ITC) on purchases.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='purchases',
        null=True,
        blank=True
    )
    vendor_name = models.CharField(max_length=255)
    vendor_gstin = models.CharField(
        max_length=15,
        blank=True,
        help_text="Vendor GSTIN (needed for ITC claim)"
    )
    invoice_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    taxable_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    cgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    sgst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total_gst = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-purchase_date', '-created_at']

    def __str__(self):
        return f"Purchase {self.invoice_number} from {self.vendor_name}"

    def calculate_gst_totals(self):
        """Recalculate GST totals from line items."""
        from django.db.models import Sum
        totals = self.items.aggregate(
            taxable=Sum('taxable_amount'),
            cgst=Sum('cgst_amount'),
            sgst=Sum('sgst_amount'),
        )
        self.taxable_amount = totals['taxable'] or Decimal('0.00')
        self.cgst_amount = totals['cgst'] or Decimal('0.00')
        self.sgst_amount = totals['sgst'] or Decimal('0.00')
        self.total_gst = self.cgst_amount + self.sgst_amount


class PurchaseItem(TimeStampedModel):
    """
    Items included in a specific purchase.
    Tracks GST per line for ITC calculation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='items'
    )
    inventory_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name='purchase_items'
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Cost per unit at the time of purchase"
    )
    total_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Total cost for this quantity"
    )
    # GST per line item
    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('18.00'),
        help_text="GST rate % on this item"
    )
    taxable_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Taxable amount (total_price excluding GST)"
    )
    cgst_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )
    sgst_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=Decimal('0.00')
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.inventory_item.name} x{self.quantity} for Purchase {self.purchase.invoice_number}"

