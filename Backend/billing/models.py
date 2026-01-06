"""
Billing models for GST-compliant invoicing and payments.

Features:
- CGST + SGST vs IGST logic based on supply type
- Branch-specific invoice numbering
- Partial and full payments
- Invoice immutability after finalization
"""

from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from core.models import TimeStampedModel, Branch, User
from core.utils import calculate_gst, is_interstate_supply
from core.exceptions import InvoiceNumberConflict
import uuid
from decimal import Decimal


class InvoiceStatus(models.TextChoices):
    """Invoice status options."""
    DRAFT = 'DRAFT', 'Draft'
    PENDING = 'PENDING', 'Pending Payment'
    PARTIAL = 'PARTIAL', 'Partially Paid'
    PAID = 'PAID', 'Paid'
    CANCELLED = 'CANCELLED', 'Cancelled'


class Invoice(TimeStampedModel):
    """
    GST-compliant invoice with branch-specific numbering.
    
    Key features:
    - Auto-generated branch-scoped invoice number
    - CGST+SGST for intrastate, IGST for interstate
    - Immutable after finalization
    - Linked to job card
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='invoices'
    )
    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        help_text="Auto-generated branch-scoped invoice number"
    )
    
    # Job Reference
    job = models.ForeignKey(
        'jobs.JobCard',
        on_delete=models.PROTECT,
        related_name='invoices'
    )
    
    # Customer Details (snapshot at invoice time)
    customer_name = models.CharField(max_length=255)
    customer_mobile = models.CharField(max_length=15)
    customer_email = models.EmailField(blank=True)
    customer_address = models.TextField()
    customer_gstin = models.CharField(max_length=15, blank=True)
    customer_state_code = models.CharField(max_length=2, blank=True)
    
    # Invoice Details
    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    
    # GST Type
    is_interstate = models.BooleanField(
        default=False,
        help_text="True for interstate supply (IGST), False for intrastate (CGST+SGST)"
    )
    
    # Amounts (calculated from line items)
    subtotal = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Total before tax"
    )
    cgst_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    sgst_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    igst_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_tax = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        help_text="Final amount after tax and discount"
    )
    
    # Payment Status
    status = models.CharField(
        max_length=20,
        choices=InvoiceStatus.choices,
        default=InvoiceStatus.DRAFT
    )
    paid_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    
    # Finalization
    is_finalized = models.BooleanField(
        default=False,
        help_text="Finalized invoices cannot be modified"
    )
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='finalized_invoices'
    )
    
    # Notes
    notes = models.TextField(blank=True)
    terms_and_conditions = models.TextField(blank=True)
    
    # Created By
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_invoices'
    )
    
    class Meta:
        ordering = ['-invoice_date', '-created_at']
        indexes = [
            models.Index(fields=['branch', 'invoice_number']),
            models.Index(fields=['branch', 'status']),
            models.Index(fields=['job']),
            models.Index(fields=['invoice_date']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.customer_name}"

    @property
    def balance_due(self):
        """Calculate outstanding balance."""
        return self.total_amount - self.paid_amount

    @property
    def is_fully_paid(self):
        """Check if invoice is fully paid."""
        return self.balance_due <= Decimal('0')

    def save(self, *args, **kwargs):
        # Generate invoice number if not set
        if not self.invoice_number:
            self.invoice_number = self.branch.get_next_invoice_number()
        
        # Prevent modifications to finalized invoices
        if self.pk and self.is_finalized:
            # Only allow payment-related updates
            allowed_fields = {'paid_amount', 'status', 'updated_at'}
            if hasattr(self, '_dirty_fields'):
                if not set(self._dirty_fields).issubset(allowed_fields):
                    from core.exceptions import BusinessRuleViolation
                    raise BusinessRuleViolation(
                        "Finalized invoices cannot be modified."
                    )
        
        super().save(*args, **kwargs)

    def calculate_totals(self):
        """Recalculate all totals from line items."""
        if self.is_finalized:
            return
        
        two_places = Decimal('0.01')
        
        self.subtotal = Decimal('0.00')
        self.cgst_total = Decimal('0.00')
        self.sgst_total = Decimal('0.00')
        self.igst_total = Decimal('0.00')
        
        for item in self.line_items.all():
            self.subtotal += item.amount
            self.cgst_total += item.cgst_amount
            self.sgst_total += item.sgst_amount
            self.igst_total += item.igst_amount
        
        self.total_tax = self.cgst_total + self.sgst_total + self.igst_total
        self.total_amount = (
            self.subtotal + self.total_tax - self.discount_amount
        ).quantize(two_places)
        
        # Update status based on payments
        self._update_payment_status()

    def _update_payment_status(self):
        """Update invoice status based on payments."""
        if self.status == InvoiceStatus.CANCELLED:
            return
        
        if self.balance_due <= Decimal('0'):
            self.status = InvoiceStatus.PAID
        elif self.paid_amount > Decimal('0'):
            self.status = InvoiceStatus.PARTIAL
        elif self.is_finalized:
            self.status = InvoiceStatus.PENDING
        else:
            self.status = InvoiceStatus.DRAFT

    def finalize(self, user):
        """
        Finalize the invoice, making it immutable.
        Only allowed for draft invoices.
        """
        if self.is_finalized:
            return
        
        if not self.line_items.exists():
            from core.exceptions import BusinessRuleViolation
            raise BusinessRuleViolation("Cannot finalize invoice without line items.")
        
        self.calculate_totals()
        self.is_finalized = True
        self.finalized_at = timezone.now()
        self.finalized_by = user
        self.status = InvoiceStatus.PENDING
        self.save()
        
        # Log to audit
        from audit.services import AuditLogService
        AuditLogService.log(
            user=user,
            action='INVOICE_FINALIZED',
            model_name='Invoice',
            object_id=str(self.pk),
            details={
                'invoice_number': self.invoice_number,
                'total_amount': str(self.total_amount),
            }
        )

    def record_payment(self, amount, payment_method, user, reference='', notes=''):
        """
        Record a payment against this invoice.
        Returns the created Payment object.
        """
        from django.db import transaction
        
        if amount <= 0:
            from core.exceptions import BusinessRuleViolation
            raise BusinessRuleViolation("Payment amount must be positive.")
        
        if self.status == InvoiceStatus.CANCELLED:
            from core.exceptions import BusinessRuleViolation
            raise BusinessRuleViolation("Cannot record payment on cancelled invoice.")
        
        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=self,
                amount=amount,
                payment_method=payment_method,
                reference=reference,
                notes=notes,
                received_by=user
            )
            
            self.paid_amount += amount
            self._update_payment_status()
            self.save(update_fields=['paid_amount', 'status', 'updated_at'])
            
            # Log to audit
            from audit.services import AuditLogService
            AuditLogService.log(
                user=user,
                action='PAYMENT_RECEIVED',
                model_name='Payment',
                object_id=str(payment.pk),
                details={
                    'invoice_number': self.invoice_number,
                    'amount': str(amount),
                    'method': payment_method,
                    'new_balance': str(self.balance_due),
                }
            )
            
            return payment


class InvoiceLineItem(TimeStampedModel):
    """
    Individual line item on an invoice.
    Can be service charges or spare parts.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='line_items'
    )
    
    # Item Type
    item_type = models.CharField(
        max_length=20,
        choices=[
            ('SERVICE', 'Service Charge'),
            ('PART', 'Spare Part'),
            ('LABOUR', 'Labour Charge'),
            ('OTHER', 'Other'),
        ]
    )
    
    # Description
    description = models.CharField(max_length=500)
    
    # HSN/SAC Code
    hsn_sac_code = models.CharField(
        max_length=8,
        blank=True,
        help_text="HSN code for goods, SAC for services"
    )
    
    # Pricing
    quantity = models.PositiveIntegerField(default=1)
    unit = models.CharField(max_length=20, default='NOS')
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0'))]
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="quantity × unit_price"
    )
    
    # GST
    gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('18.00')
    )
    cgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    sgst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    igst_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    
    # Discount
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0')
    )
    
    # Link to inventory item (if applicable)
    inventory_item = models.ForeignKey(
        'inventory.InventoryItem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    # Link to job part usage (if applicable)
    job_part_usage = models.ForeignKey(
        'inventory.JobPartUsage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    
    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.invoice.invoice_number} - {self.description}"

    def save(self, *args, **kwargs):
        # Calculate amounts
        two_places = Decimal('0.01')
        
        self.amount = (
            Decimal(str(self.quantity)) * self.unit_price
        ).quantize(two_places)
        
        # Apply discount
        if self.discount_percent > 0:
            discount = (self.amount * self.discount_percent / 100).quantize(two_places)
            self.amount -= discount
        
        # Calculate GST
        gst_calc = calculate_gst(self.amount, self.gst_rate, self.invoice.is_interstate)
        
        self.cgst_rate = gst_calc['cgst_rate']
        self.cgst_amount = gst_calc['cgst_amount']
        self.sgst_rate = gst_calc['sgst_rate']
        self.sgst_amount = gst_calc['sgst_amount']
        self.igst_rate = gst_calc['igst_rate']
        self.igst_amount = gst_calc['igst_amount']
        
        super().save(*args, **kwargs)
        
        # Recalculate invoice totals
        self.invoice.calculate_totals()
        self.invoice.save()


class PaymentMethod(models.TextChoices):
    """Supported payment methods."""
    CASH = 'CASH', 'Cash'
    UPI = 'UPI', 'UPI'
    CARD = 'CARD', 'Credit/Debit Card'
    NEFT = 'NEFT', 'NEFT/RTGS/IMPS'
    CHEQUE = 'CHEQUE', 'Cheque'
    WALLET = 'WALLET', 'Digital Wallet'
    OTHER = 'OTHER', 'Other'


class Payment(TimeStampedModel):
    """
    Payment record for invoices.
    Supports partial payments and multiple payment methods.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name='payments'
    )
    
    # Payment Details
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices
    )
    payment_date = models.DateTimeField(default=timezone.now)
    
    # Reference
    reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Transaction ID, UPI ref, Cheque number, etc."
    )
    
    # Notes
    notes = models.TextField(blank=True)
    
    # Received By
    received_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='received_payments'
    )
    
    # Status
    is_verified = models.BooleanField(
        default=True,
        help_text="False for pending verifications (e.g., cheque clearance)"
    )
    
    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.invoice.invoice_number} - ₹{self.amount} ({self.payment_method})"


class CreditNote(TimeStampedModel):
    """
    Credit note for refunds or corrections.
    Must reference an original invoice.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='credit_notes'
    )
    credit_note_number = models.CharField(max_length=50, unique=True)
    
    # Original Invoice
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.PROTECT,
        related_name='credit_notes'
    )
    
    # Amount
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    cgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    sgst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    igst_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0'))
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Reason
    reason = models.TextField()
    
    # Created By
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_credit_notes'
    )
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.credit_note_number} - ₹{self.total_amount}"
