"""
Core Models: Organization, Branch, User (RBAC), and Role definitions.

Implements multi-tenant architecture with branch-level isolation.
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
import uuid


class TimeStampedModel(models.Model):
    """Abstract base model with created/updated timestamps."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Organization(TimeStampedModel):
    """
    Top-level tenant entity representing a business/company.
    One organization can have multiple branches (service centers).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    legal_name = models.CharField(max_length=255, help_text="Legal entity name for invoices")
    
    # Contact Information
    email = models.EmailField()
    phone = models.CharField(max_length=15, validators=[
        RegexValidator(r'^\+?[1-9]\d{1,14}$', message="Enter a valid phone number")
    ])
    website = models.URLField(blank=True)
    
    # Address
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=6, validators=[
        RegexValidator(r'^\d{6}$', message="Enter a valid 6-digit pincode")
    ])
    country = models.CharField(max_length=100, default='India')
    
    # Business Details
    pan_number = models.CharField(
        max_length=10,
        validators=[RegexValidator(r'^[A-Z]{5}\d{4}[A-Z]$', message="Enter a valid PAN")],
        help_text="PAN Number (e.g., ABCDE1234F)"
    )
    
    # Branding
    logo = models.ImageField(upload_to='organization_logos/', blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class Branch(TimeStampedModel):
    """
    Service Center / Branch within an Organization.
    Each branch has its own inventory, customers, jobs, and invoices.
    Branch-level data isolation is enforced throughout the system.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name='branches'
    )
    name = models.CharField(max_length=255)
    code = models.CharField(
        max_length=10,
        help_text="Short code for branch (used in job/invoice numbers)"
    )
    
    # Contact Information
    email = models.EmailField()
    phone = models.CharField(max_length=15, validators=[
        RegexValidator(r'^\+?[1-9]\d{1,14}$', message="Enter a valid phone number")
    ])
    
    # Address
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=6, validators=[
        RegexValidator(r'^\d{6}$', message="Enter a valid 6-digit pincode")
    ])
    
    # GST Details
    gstin = models.CharField(
        max_length=15,
        validators=[RegexValidator(
            r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$',
            message="Enter a valid GSTIN"
        )],
        help_text="GST Identification Number (e.g., 27ABCDE1234F1Z5)"
    )
    state_code = models.CharField(
        max_length=2,
        validators=[RegexValidator(r'^\d{2}$', message="Enter a valid 2-digit state code")],
        help_text="GST State Code (first 2 digits of GSTIN)"
    )
    
    # Invoice Configuration
    invoice_prefix = models.CharField(
        max_length=10,
        default='INV',
        help_text="Prefix for invoice numbers"
    )
    invoice_current_number = models.PositiveIntegerField(
        default=0,
        help_text="Current invoice number counter"
    )
    
    # Job Card Configuration
    jobcard_prefix = models.CharField(
        max_length=10,
        default='JC',
        help_text="Prefix for job card numbers"
    )
    jobcard_current_number = models.PositiveIntegerField(
        default=0,
        help_text="Current job card number counter"
    )
    
    # Notification Settings
    sms_enabled = models.BooleanField(default=True)
    whatsapp_enabled = models.BooleanField(default=True)
    
    # Operational Settings
    default_gst_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=18.00,
        help_text="Default GST rate percentage"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name_plural = 'Branches'
        ordering = ['organization', 'name']
        unique_together = ['organization', 'code']
        indexes = [
            models.Index(fields=['organization', 'is_active']),
            models.Index(fields=['code']),
            models.Index(fields=['gstin']),
        ]

    def __str__(self):
        return f"{self.organization.name} - {self.name}"

    def get_current_financial_year(self):
        """Get current financial year in format YYYY-YY (e.g., 2025-26)."""
        from django.conf import settings
        today = timezone.now().date()
        fy_start_month = getattr(settings, 'FINANCIAL_YEAR_START_MONTH', 4)
        
        if today.month >= fy_start_month:
            start_year = today.year
        else:
            start_year = today.year - 1
        
        end_year_short = str(start_year + 1)[-2:]
        return f"{start_year}-{end_year_short}"

    def get_next_invoice_number(self):
        """
        Generate next invoice number for this branch.
        Format: PREFIX/FY/BRANCH_CODE/SEQUENCE
        Example: INV/2025-26/MUM/00001
        """
        from django.db import transaction
        
        with transaction.atomic():
            # Lock the row for update
            branch = Branch.objects.select_for_update().get(pk=self.pk)
            branch.invoice_current_number += 1
            branch.save(update_fields=['invoice_current_number', 'updated_at'])
            
            fy = self.get_current_financial_year()
            sequence = str(branch.invoice_current_number).zfill(5)
            return f"{self.invoice_prefix}/{fy}/{self.code}/{sequence}"

    def get_next_jobcard_number(self):
        """
        Generate next job card number for this branch.
        Format: PREFIX/FY/BRANCH_CODE/SEQUENCE
        Example: JC/2025-26/MUM/00001
        """
        from django.db import transaction
        
        with transaction.atomic():
            # Lock the row for update
            branch = Branch.objects.select_for_update().get(pk=self.pk)
            branch.jobcard_current_number += 1
            branch.save(update_fields=['jobcard_current_number', 'updated_at'])
            
            fy = self.get_current_financial_year()
            sequence = str(branch.jobcard_current_number).zfill(5)
            return f"{self.jobcard_prefix}/{fy}/{self.code}/{sequence}"


class Role(models.TextChoices):
    """
    System roles with predefined permissions.
    Role-based access control (RBAC) is enforced at API level.
    """
    OWNER = 'OWNER', _('Owner')  # Full access to all branches in organization
    MANAGER = 'MANAGER', _('Manager')  # Full access to assigned branches
    RECEPTIONIST = 'RECEPTIONIST', _('Receptionist')  # Create jobs, manage customers
    TECHNICIAN = 'TECHNICIAN', _('Technician')  # View assigned jobs, add diagnosis
    ACCOUNTANT = 'ACCOUNTANT', _('Accountant')  # Billing, payments, reports


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', Role.OWNER)
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """
    Custom User model with RBAC and multi-branch assignment.
    - Owners can access all branches within their organization
    - Other roles are restricted to assigned branches
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    
    # Personal Information
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=15, blank=True, validators=[
        RegexValidator(r'^\+?[1-9]\d{1,14}$', message="Enter a valid phone number")
    ])
    
    # Organization & Role
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name='users'
    )
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.TECHNICIAN
    )
    
    # Branch Assignment (for non-Owner roles)
    branches = models.ManyToManyField(
        Branch,
        related_name='users',
        blank=True,
        help_text="Branches this user has access to (Owners have access to all)"
    )
    
    # Status
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    
    # Timestamps
    last_login = models.DateTimeField(null=True, blank=True)
    date_joined = models.DateTimeField(default=timezone.now)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']
    
    class Meta:
        ordering = ['first_name', 'last_name']
        indexes = [
            models.Index(fields=['organization', 'role']),
            models.Index(fields=['email']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    def get_accessible_branches(self):
        """
        Get all branches this user can access.
        Owners can access all branches in their organization.
        Others can only access assigned branches.
        """
        if self.role == Role.OWNER:
            return Branch.objects.filter(organization=self.organization, is_active=True)
        return self.branches.filter(is_active=True)

    def has_branch_access(self, branch):
        """Check if user has access to a specific branch."""
        if not branch:
            return False
        if branch.organization != self.organization:
            return False
        if self.role == Role.OWNER:
            return True
        return self.branches.filter(pk=branch.pk, is_active=True).exists()

    def is_owner(self):
        return self.role == Role.OWNER

    def is_manager(self):
        return self.role == Role.MANAGER

    def is_technician(self):
        return self.role == Role.TECHNICIAN

    def is_receptionist(self):
        return self.role == Role.RECEPTIONIST

    def is_accountant(self):
        return self.role == Role.ACCOUNTANT


class UserSession(TimeStampedModel):
    """Track user sessions for security auditing."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    current_branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        help_text="Currently selected branch context"
    )
    ip_address = models.GenericIPAddressField(null=True)
    user_agent = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.created_at}"
