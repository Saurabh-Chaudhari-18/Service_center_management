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
    tagline = models.CharField(max_length=255, blank=True, default='Management System',
                               help_text="Shown below org name in sidebar")
    primary_color = models.CharField(max_length=7, default='#6366f1',
                                     help_text="Hex color for UI branding (e.g., #6366f1)")
    favicon = models.ImageField(upload_to='organization_favicons/', blank=True, null=True)
    
    # Invoice Configuration (org-level defaults shown on invoices)
    invoice_terms = models.TextField(blank=True, default='',
                                     help_text="Default terms & conditions for invoices")
    invoice_notes = models.TextField(blank=True, default='',
                                     help_text="Default footer notes for invoices")
    bank_name = models.CharField(max_length=255, blank=True, default='')
    bank_account_number = models.CharField(max_length=50, blank=True, default='')
    bank_ifsc = models.CharField(max_length=20, blank=True, default='')
    bank_branch = models.CharField(max_length=255, blank=True, default='')
    upi_id = models.CharField(max_length=100, blank=True, default='',
                              help_text="UPI ID for payment QR code on invoices")
    authorized_signatory = models.CharField(max_length=255, blank=True, default='',
                                            help_text="Name shown as authorized signatory on invoices")
    
    # Job Card Configuration (org-level defaults shown on job card printouts)
    jobcard_terms = models.TextField(blank=True, default='',
                                     help_text="Default terms for job card printouts")
    jobcard_warranty_text = models.TextField(blank=True, default='',
                                            help_text="Default warranty text for job cards")
    
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
        help_text="GST Identification Number (e.g., 27ABCDE1234F1Z5)",
        blank=True
    )
    state_code = models.CharField(
        max_length=2,
        validators=[RegexValidator(r'^\d{2}$', message="Enter a valid 2-digit state code")],
        help_text="GST State Code (first 2 digits of GSTIN)",
        blank=True
    )
    
    # Invoice Configuration
    invoice_prefix = models.CharField(
        max_length=10,
        default='INV',
        help_text="Prefix for invoice numbers",
        blank=True
    )
    invoice_current_number = models.PositiveIntegerField(
        default=0,
        help_text="Current invoice number counter"
    )
    
    # Job Card Configuration
    jobcard_prefix = models.CharField(
        max_length=10,
        default='JC',
        help_text="Prefix for job card numbers",
        blank=True
    )
    jobcard_current_number = models.PositiveIntegerField(
        default=0,
        help_text="Current job card number counter"
    )

    # Branch-specific Billing & Bank Details (falls back to organization defaults if blank)
    bank_name = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Branch-specific bank name (falls back to organization defaults if blank)"
    )
    bank_account_number = models.CharField(
        max_length=50,
        blank=True,
        default='',
        help_text="Branch-specific bank account number (falls back to organization defaults if blank)"
    )
    bank_ifsc = models.CharField(
        max_length=20,
        blank=True,
        default='',
        help_text="Branch-specific bank IFSC (falls back to organization defaults if blank)"
    )
    bank_branch = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Branch-specific bank branch name (falls back to organization defaults if blank)"
    )
    upi_id = models.CharField(
        max_length=100,
        blank=True,
        default='',
        help_text="Branch-specific UPI ID for payment QR codes (falls back to organization defaults if blank)"
    )
    authorized_signatory = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text="Branch-specific authorized signatory name (falls back to organization defaults if blank)"
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

    @property
    def jobcard_number_prefix(self):
        """Return prefix for job cards, e.g., 'apeksha-' if branch name contains 'apeksha info'."""
        if self.name and "apeksha info" in self.name.lower():
            return "apeksha-"
        return ""

    @property
    def effective_bank_name(self):
        return self.bank_name or (self.organization.bank_name if self.organization else "")

    @property
    def effective_bank_account_number(self):
        return self.bank_account_number or (self.organization.bank_account_number if self.organization else "")

    @property
    def effective_bank_ifsc(self):
        return self.bank_ifsc or (self.organization.bank_ifsc if self.organization else "")

    @property
    def effective_bank_branch(self):
        return self.bank_branch or (self.organization.bank_branch if self.organization else "")

    @property
    def effective_upi_id(self):
        return self.upi_id or (self.organization.upi_id if self.organization else "")

    @property
    def effective_authorized_signatory(self):
        return self.authorized_signatory or (self.organization.authorized_signatory if self.organization else "")

    def get_current_financial_year(self):
        """Get current financial year in format YYYY-YY (e.g., 2025-26)."""
        from django.conf import settings
        today = timezone.now().date()
        for_month = getattr(settings, 'FINANCIAL_YEAR_START_MONTH', 4)
        
        if today.month >= for_month:
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

        Uses a dedicated BranchSequence row so only the (branch, invoice) counter
        row is locked — not the entire Branch row — eliminating contention with
        concurrent Branch reads/writes on other fields.
        """
        from django.db import transaction

        with transaction.atomic():
            seq, _ = BranchSequence.objects.select_for_update().get_or_create(
                branch=self,
                kind=BranchSequence.Kind.INVOICE,
                defaults={'last_value': self.invoice_current_number},
            )
            seq.last_value += 1
            seq.save(update_fields=['last_value'])

            fy = self.get_current_financial_year()
            return f"{self.invoice_prefix}/{fy}/{self.code}/{str(seq.last_value).zfill(5)}"

    def get_next_jobcard_number(self, received_date=None):
        """
        Generate next job card number for this branch.
        Format: [PREFIX-]YYMMDDNN
        Example: apeksha-26062401 (1st job on 24-Jun-2026 for Apeksha Info branch)

        The daily sequence resets each day. We count existing jobs for
        today's date prefix in this branch and increment by 1.
        Uses SELECT FOR UPDATE on BranchSequence to serialize concurrent
        inserts and avoid duplicate numbers.
        """
        from django.db import transaction

        prefix = self.jobcard_number_prefix
        # Use received_date if provided, otherwise default to today
        target_date = received_date or timezone.now().date()
        if hasattr(target_date, 'date'):
            target_date = target_date.date()
        date_prefix = target_date.strftime('%y%m%d')  # e.g. "260624" (2-digit year)
        full_prefix = f"{prefix}{date_prefix}"

        with transaction.atomic():
            # Lock the sequence row to serialize concurrent creates
            seq, _ = BranchSequence.objects.select_for_update().get_or_create(
                branch=self,
                kind=BranchSequence.Kind.JOBCARD,
                defaults={'last_value': 0},
            )

            # Count jobs already created today for this branch with this prefix
            from jobs.models import JobCard
            today_count = JobCard.objects.filter(
                branch=self,
                job_number__startswith=full_prefix,
            ).count()

            next_seq = today_count + 1
            # Update the sequence tracker (informational, not used for numbering)
            seq.last_value = next_seq
            seq.save(update_fields=['last_value'])

            return f"{full_prefix}{str(next_seq).zfill(2)}"


class BranchSequence(models.Model):
    """
    Per-branch, per-kind auto-incrementing counter.

    Replaces invoice_current_number / jobcard_current_number on Branch.
    Each (branch, kind) pair gets its own row, so SELECT FOR UPDATE locks
    only that narrow row instead of the entire Branch record, removing the
    contention bottleneck at high invoice/job-card creation throughput.
    """

    class Kind(models.TextChoices):
        INVOICE = 'invoice', 'Invoice'
        JOBCARD = 'jobcard', 'Job Card'

    branch = models.ForeignKey(
        Branch,
        on_delete=models.CASCADE,
        related_name='sequences',
    )
    kind = models.CharField(max_length=10, choices=Kind.choices)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [['branch', 'kind']]

    def __str__(self):
        return f"{self.branch.code} / {self.kind} → {self.last_value}"


class Role(models.TextChoices):
    """
    System roles with predefined permissions.
    Role-based access control (RBAC) is enforced at API level.
    """
    SUPER_ADMIN = 'SUPER_ADMIN', _('Super Admin')  # Platform-wide access, manages all orgs/owners
    OWNER = 'OWNER', _('Owner')  # Full access to all branches in organization
    MANAGER = 'MANAGER', _('Manager')  # Full access to assigned branches
    RECEPTIONIST = 'RECEPTIONIST', _('Receptionist')  # Create jobs, manage customers
    TECHNICIAN = 'TECHNICIAN', _('Technician')  # View assigned jobs, add diagnosis
    ACCOUNTANT = 'ACCOUNTANT', _('Accountant')  # Billing, payments, reports


class RolePermission(models.Model):
    """
    Database-driven permission matrix.
    One row per role with boolean flags for each permission.
    Change permissions from Django Admin — no code changes needed.
    """
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        unique=True,
        help_text="The role this permission set applies to"
    )

    # Dashboard
    can_view_dashboard = models.BooleanField(default=True, help_text="Can access the dashboard")

    # Job Cards
    can_view_job_cards = models.BooleanField(default=False, help_text="Can view job cards")
    can_create_job_cards = models.BooleanField(default=False, help_text="Can create new job cards")
    can_edit_job_cards = models.BooleanField(default=False, help_text="Can edit/update job cards")

    # Inventory
    can_view_inventory = models.BooleanField(default=False, help_text="Can view inventory items")
    can_manage_inventory = models.BooleanField(default=False, help_text="Can add/edit/delete inventory")

    # Billing
    can_view_billing = models.BooleanField(default=False, help_text="Can view invoices and payments")
    can_create_invoices = models.BooleanField(default=False, help_text="Can create invoices")

    # Reports
    can_view_reports = models.BooleanField(default=False, help_text="Can view financial reports")

    # Administration
    can_manage_branches = models.BooleanField(default=False, help_text="Can create/edit branches")
    can_manage_users = models.BooleanField(default=False, help_text="Can create/edit/deactivate users")

    # Pickups
    can_view_pickups = models.BooleanField(default=False, help_text="Can view pickup requests")

    # Timestamps
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['role']
        verbose_name = "Role Permission"
        verbose_name_plural = "Role Permissions"

    def __str__(self):
        return f"Permissions for {self.get_role_display()}"

    def to_dict(self):
        """Return permissions as a dictionary for API responses."""
        return {
            'canViewDashboard': self.can_view_dashboard,
            'canViewJobCards': self.can_view_job_cards,
            'canCreateJobCards': self.can_create_job_cards,
            'canEditJobCards': self.can_edit_job_cards,
            'canViewInventory': self.can_view_inventory,
            'canManageInventory': self.can_manage_inventory,
            'canViewBilling': self.can_view_billing,
            'canCreateInvoices': self.can_create_invoices,
            'canViewReports': self.can_view_reports,
            'canManageBranches': self.can_manage_branches,
            'canManageUsers': self.can_manage_users,
            'canViewPickups': self.can_view_pickups,
        }

    @classmethod
    def get_permissions_for_role(cls, role):
        """Get permissions dict for a role, with caching."""
        from django.core.cache import cache
        cache_key = f"role_perms_{role}"
        perms = cache.get(cache_key)
        if perms is None:
            try:
                rp = cls.objects.get(role=role)
                perms = rp.to_dict()
            except cls.DoesNotExist:
                # Deny all if no row exists
                perms = {
                    'canViewDashboard': False,
                    'canViewJobCards': False,
                    'canCreateJobCards': False,
                    'canEditJobCards': False,
                    'canViewInventory': False,
                    'canManageInventory': False,
                    'canViewBilling': False,
                    'canCreateInvoices': False,
                    'canViewReports': False,
                    'canManageBranches': False,
                    'canManageUsers': False,
                    'canViewPickups': False,
                }
            cache.set(cache_key, perms, 300)  # Cache for 5 minutes
        return perms

    def save(self, *args, **kwargs):
        """Clear cache when permissions are updated."""
        super().save(*args, **kwargs)
        from django.core.cache import cache
        cache.delete(f"role_perms_{self.role}")


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
        extra_fields.setdefault('role', Role.SUPER_ADMIN)
        
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
        related_name='users',
        null=True,
        blank=True,
        help_text="Organization this user belongs to (null for Super Admins)"
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
    
    # Live Tracking
    last_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_updated = models.DateTimeField(null=True, blank=True)
    
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
        Super Admins can access all branches across all organizations.
        Owners can access all branches in their organization.
        Others can only access assigned branches.
        """
        if self.role == Role.SUPER_ADMIN:
            return Branch.objects.filter(is_active=True)
        if self.role == Role.OWNER:
            return Branch.objects.filter(organization=self.organization, is_active=True)
        return self.branches.filter(is_active=True)

    def has_branch_access(self, branch):
        """Check if user has access to a specific branch."""
        if not branch:
            return False
        if self.role == Role.SUPER_ADMIN:
            return True
        if branch.organization != self.organization:
            return False
        if self.role == Role.OWNER:
            return True
        return self.branches.filter(pk=branch.pk, is_active=True).exists()

    def is_super_admin(self):
        return self.role == Role.SUPER_ADMIN

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
