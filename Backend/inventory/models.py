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


class InventoryCategory(TimeStampedModel):
    """Categories for inventory items."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='inventory_categories'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    class Meta:
        verbose_name_plural = 'Inventory categories'
        unique_together = ['branch', 'name']
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
        related_name='inventory_items'
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
        default='PCS',
        choices=[
            ('PCS', 'Pieces'),
            ('NOS', 'Numbers'),
            ('MTR', 'Meters'),
            ('SET', 'Set'),
            ('BOX', 'Box'),
            ('KG', 'Kilogram'),
        ]
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
        
        Args:
            quantity: Amount to add
            reason: Reason for adjustment
            user: User performing the action
        """
        from django.db import transaction
        
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        with transaction.atomic():
            old_quantity = self.quantity
            self.quantity += quantity
            self.save(update_fields=['quantity', 'updated_at'])
            
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
        
        Args:
            quantity: Amount to deduct
            reason: Reason for adjustment
            user: User performing the action
            job: Related job card (optional)
        """
        from django.db import transaction
        
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if self.quantity < quantity:
            raise InsufficientInventory(
                f"Insufficient stock for {self.name}. "
                f"Requested: {quantity}, Available: {self.quantity}"
            )
        
        with transaction.atomic():
            old_quantity = self.quantity
            self.quantity -= quantity
            self.save(update_fields=['quantity', 'updated_at'])
            
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
        """
        from django.db import transaction
        
        if new_quantity < 0:
            raise ValueError("Quantity cannot be negative")
        
        old_quantity = self.quantity
        quantity_diff = new_quantity - old_quantity
        
        with transaction.atomic():
            self.quantity = new_quantity
            self.save(update_fields=['quantity', 'updated_at'])
            
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
        if self.pk:
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
