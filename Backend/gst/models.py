"""
GST Module Models

Tracks:
- HSNCode: Master table of HSN/SAC codes
- GSTPayment: Challan payments to the government  
- GSTReturnStatus: Filing status per period per branch
"""

import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, RegexValidator
from core.models import TimeStampedModel, Branch, User


class HSNCode(TimeStampedModel):
    """
    Master table for HSN (goods) and SAC (services) codes.
    Used as auto-suggest source when creating invoices and purchases.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    CODE_TYPE_CHOICES = [
        ('HSN', 'HSN — Goods'),
        ('SAC', 'SAC — Services'),
    ]
    code = models.CharField(
        max_length=10,
        unique=True,
        help_text="HSN or SAC code (e.g. 998711 or 84733099)"
    )
    code_type = models.CharField(
        max_length=3,
        choices=CODE_TYPE_CHOICES,
        default='SAC'
    )
    description = models.CharField(
        max_length=255,
        help_text="Description of goods/service"
    )
    default_gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('18.00'),
        help_text="Default GST rate for this code (%)"
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['code']
        verbose_name = 'HSN/SAC Code'
        verbose_name_plural = 'HSN/SAC Codes'

    def __str__(self):
        return f"{self.code} — {self.description} ({self.default_gst_rate}%)"


class GSTPayment(TimeStampedModel):
    """
    Records challan payments made to the government for GST liability.
    Intrastate only: CGST + SGST (no IGST).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='gst_payments'
    )
    # Period this payment covers (first day of the month)
    period_month = models.DateField(
        help_text="Month this payment covers (use first day of month)"
    )
    cgst_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    sgst_paid = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0'))]
    )
    payment_date = models.DateField()
    challan_number = models.CharField(
        max_length=100,
        blank=True,
        help_text="Challan Reference Number (CRN)"
    )
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('NEFT', 'NEFT/RTGS'),
            ('UPI', 'UPI'),
            ('CASH', 'Cash at Bank'),
            ('DEBIT_CARD', 'Debit Card'),
            ('OTHER', 'Other'),
        ],
        default='NEFT'
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='gst_payments_created'
    )

    class Meta:
        ordering = ['-period_month', '-payment_date']
        verbose_name = 'GST Payment'

    def __str__(self):
        total = self.cgst_paid + self.sgst_paid
        return f"GST Payment {self.period_month.strftime('%b %Y')} — ₹{total}"

    @property
    def total_paid(self):
        return self.cgst_paid + self.sgst_paid


class GSTReturnStatus(TimeStampedModel):
    """
    Tracks whether GSTR-1 and GSTR-3B have been filed for each month/branch.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='gst_return_statuses'
    )
    period_month = models.DateField(
        help_text="First day of the return period month"
    )
    gstr1_filed = models.BooleanField(default=False)
    gstr1_filed_at = models.DateTimeField(null=True, blank=True)
    gstr3b_filed = models.BooleanField(default=False)
    gstr3b_filed_at = models.DateTimeField(null=True, blank=True)
    filed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gst_returns_filed'
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-period_month']
        unique_together = [['branch', 'period_month']]
        verbose_name = 'GST Return Status'

    def __str__(self):
        return f"GST Return {self.branch} — {self.period_month.strftime('%b %Y')}"
