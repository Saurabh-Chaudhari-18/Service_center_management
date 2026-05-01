"""
Expense tracking models for daily shop operations.

Features:
- Category-based expense tracking
- Receipt uploads
- Branch-scoped isolation
- Monthly/daily summaries for net profit calculation
"""

from django.db import models
from django.core.validators import MinValueValidator
from core.models import TimeStampedModel, Branch, User
import uuid
from decimal import Decimal


class ExpenseCategory(models.TextChoices):
    """Standard expense categories for service centers."""
    RENT = 'RENT', 'Rent'
    ELECTRICITY = 'ELECTRICITY', 'Electricity'
    INTERNET = 'INTERNET', 'Internet / Wi-Fi'
    SALARY = 'SALARY', 'Staff Salary'
    TEA_SNACKS = 'TEA_SNACKS', 'Tea / Snacks / Meals'
    TRANSPORT = 'TRANSPORT', 'Transport / Fuel'
    STATIONERY = 'STATIONERY', 'Stationery / Printing'
    TOOLS = 'TOOLS', 'Tools & Equipment'
    MAINTENANCE = 'MAINTENANCE', 'Shop Maintenance'
    MARKETING = 'MARKETING', 'Marketing / Advertising'
    INSURANCE = 'INSURANCE', 'Insurance'
    TAX = 'TAX', 'Tax / Government Fees'
    MISCELLANEOUS = 'MISCELLANEOUS', 'Miscellaneous'


class Expense(TimeStampedModel):
    """
    Daily expense record for a branch.
    Tracks all non-inventory business expenses.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    branch = models.ForeignKey(
        Branch,
        on_delete=models.PROTECT,
        related_name='expenses',
        null=True,
        blank=True
    )

    # Expense Details
    category = models.CharField(
        max_length=20,
        choices=ExpenseCategory.choices,
        default=ExpenseCategory.MISCELLANEOUS
    )
    title = models.CharField(
        max_length=255,
        help_text="Short description of the expense"
    )
    description = models.TextField(
        blank=True,
        help_text="Detailed notes about the expense"
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    expense_date = models.DateField(
        help_text="Date the expense was incurred"
    )

    # Payment Info
    payment_method = models.CharField(
        max_length=20,
        choices=[
            ('CASH', 'Cash'),
            ('UPI', 'UPI'),
            ('CARD', 'Card'),
            ('NEFT', 'NEFT/RTGS'),
            ('OTHER', 'Other'),
        ],
        default='CASH'
    )
    reference = models.CharField(
        max_length=100,
        blank=True,
        help_text="Payment reference number"
    )

    # Receipt
    receipt = models.FileField(
        upload_to='expense_receipts/%Y/%m/',
        blank=True,
        null=True,
        help_text="Upload receipt/bill photo"
    )

    # Recurring flag
    is_recurring = models.BooleanField(
        default=False,
        help_text="Mark as a recurring monthly expense"
    )

    # Vendor / Payee
    vendor_name = models.CharField(
        max_length=255,
        blank=True,
        help_text="Name of vendor/payee"
    )

    # Tracking
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_expenses'
    )

    class Meta:
        ordering = ['-expense_date', '-created_at']
        indexes = [
            models.Index(fields=['branch', 'expense_date']),
            models.Index(fields=['branch', 'category']),
            models.Index(fields=['expense_date']),
        ]

    def __str__(self):
        return f"{self.title} - ₹{self.amount} ({self.expense_date})"
