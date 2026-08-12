from rest_framework import permissions
from core.models import Role, RolePermission
from tenancy.policy import get_requested_branch_id, require_accessible_branch

def _has_perm(user, perm_key):
    """Check if a user has a specific permission via DB lookup (cached)."""
    if not user or not user.is_authenticated:
        return False
    perms = RolePermission.get_permissions_for_role(user.role)
    return perms.get(perm_key, False)


class IsBranchMember(permissions.BasePermission):
    """
    Ensure user has access to the requested branch.
    This is the foundational permission for branch-scoped endpoints.
    """
    message = "You do not have access to this branch."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Get branch from view kwargs, then query params, then the X-Branch-ID header.
        # BranchScopedMixin uses the header as its primary source, so checking it here
        # ensures we return 403 Forbidden (not a misleading 404) for invalid branch access.
        branch_id = get_requested_branch_id(request, view)

        if not branch_id:
            # If no specific branch requested, allow access (queryset will be filtered)
            return True

        if str(branch_id).lower() == 'universal':
            return request.user.role == Role.SUPER_ADMIN

        try:
            require_accessible_branch(request.user, branch_id)
            return True
        except Exception:
            return False

    def has_object_permission(self, request, view, obj):
        # Get branch from the object directly
        branch = getattr(obj, 'branch', None)

        # Traverse one-hop relationships (e.g. PartRequest → job → branch)
        if branch is None:
            job = getattr(obj, 'job', None)
            if job:
                branch = getattr(job, 'branch', None)

        # Object might be a Branch itself
        if branch is None and hasattr(obj, 'organization'):
            branch = obj

        if branch is None:
            return (
                hasattr(obj, 'branch_id')
                and request.user.role == Role.SUPER_ADMIN
                and bool(getattr(view, 'include_universal', False))
            )

        return request.user.has_branch_access(branch)


class IsSuperAdmin(permissions.BasePermission):
    """Only platform super admins."""
    message = "Only super admins can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role == Role.SUPER_ADMIN
        )


class IsOwner(permissions.BasePermission):
    """Only allow owners and super admins to access."""
    message = "Only owners can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [Role.SUPER_ADMIN, Role.OWNER]
        )


class IsOwnerOrManager(permissions.BasePermission):
    """Allow super admins, owners, and managers to access."""
    message = "Only owners and managers can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER]
        )


class IsOwnerManagerOrAccountant(permissions.BasePermission):
    """Allow super admins, owners, managers, and accountants to access."""
    message = "Only owners, managers, and accountants can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER, Role.ACCOUNTANT]
        )


class CanManageInventory(permissions.BasePermission):
    """Permission for inventory management — reads from DB."""
    message = "You do not have permission to manage inventory."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Read access
        if request.method in permissions.SAFE_METHODS:
            return _has_perm(request.user, 'canViewInventory')

        # Write access
        return _has_perm(request.user, 'canManageInventory')


class CanManageJobs(permissions.BasePermission):
    """Permission for job card management — reads from DB."""
    message = "You do not have permission to manage jobs."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Read access
        if request.method in permissions.SAFE_METHODS:
            return _has_perm(request.user, 'canViewJobCards')

        # DRF custom actions also use POST. Only the actual collection create
        # action should require create permission; lifecycle actions require
        # edit permission.
        if getattr(view, 'action', None) == 'create':
            return _has_perm(request.user, 'canCreateJobCards')

        # Update jobs
        if request.method in ['PUT', 'PATCH']:
            return _has_perm(request.user, 'canEditJobCards')

        # Delete: Only Super Admin, Owner and Manager
        return request.user.role in [Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER]


class CanManageCustomerApproval(permissions.BasePermission):
    """Front-desk or managerial staff may communicate and record estimates."""
    message = "Only owners, managers, and receptionists can manage customer estimates."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in [Role.OWNER, Role.MANAGER, Role.RECEPTIONIST]
        )


class CanManageBilling(permissions.BasePermission):
    """Permission for billing operations — reads from DB."""
    message = "You do not have permission to manage billing."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Read access
        if request.method in permissions.SAFE_METHODS:
            return _has_perm(request.user, 'canViewBilling')

        # Write access
        return _has_perm(request.user, 'canCreateInvoices')


class CanViewReports(permissions.BasePermission):
    """Permission for viewing reports — reads from DB."""
    message = "You do not have permission to view reports."

    def has_permission(self, request, view):
        return _has_perm(request.user, 'canViewReports')


class CanAccessDevicePasswords(permissions.BasePermission):
    """
    Permission for accessing device passwords.
    Access is logged in DevicePasswordAccessLog.
    """
    message = "You do not have permission to access device passwords."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        return request.user.role in [
            Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER, Role.TECHNICIAN
        ]


class IsTechnicianOrAbove(permissions.BasePermission):
    """Permission for technician-level operations."""
    message = "You do not have permission for this operation."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        return request.user.role in [
            Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER, Role.TECHNICIAN
        ]


class CanManageFinance(permissions.BasePermission):
    """Finance operations — owners, managers, and accountants."""
    message = "You do not have permission to manage finance records."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [
            Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER, Role.ACCOUNTANT,
        ]


class CanManageEnquiries(permissions.BasePermission):
    """Enquiry/lead management — front desk and above."""
    message = "You do not have permission to manage enquiries."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in [
            Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER, Role.RECEPTIONIST,
        ]


class CanManageOutsourcing(permissions.BasePermission):
    """Outsource vendors, costs, and repair handoffs are managerial actions."""
    message = "Only owners and managers can manage outsourced repairs."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in [Role.OWNER, Role.MANAGER]
        )


class CanManageCustomers(permissions.BasePermission):
    """Permission for customer management."""
    message = "You do not have permission to manage customers."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        # Customer records contain personal information. Keep direct customer
        # access to roles whose operational work requires it.
        if request.method in permissions.SAFE_METHODS:
            return request.user.role in [
                Role.OWNER, Role.MANAGER, Role.RECEPTIONIST, Role.ACCOUNTANT,
            ]

        # Write access (Super Admin excluded — no customer management)
        return request.user.role in [
            Role.OWNER, Role.MANAGER, Role.RECEPTIONIST
        ]


class CanManageUsers(permissions.BasePermission):
    """Permission for user management — reads from DB."""
    message = "Only authorized users can manage users."

    def has_permission(self, request, view):
        return _has_perm(request.user, 'canManageUsers')


class CanAssignBranches(permissions.BasePermission):
    """Permission for branch assignment — reads from DB."""
    message = "You do not have permission to assign branches."

    def has_permission(self, request, view):
        return _has_perm(request.user, 'canManageBranches')


class CanOverrideStatus(permissions.BasePermission):
    """Permission for manual status override (only Owner and Manager)."""
    message = "Only owners and managers can override job status."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False

        return request.user.role in [Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER]


class ReadOnly(permissions.BasePermission):
    """Allow only read operations."""
    message = "This resource is read-only."

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
