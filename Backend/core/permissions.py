"""
Custom permissions for branch-scoped access control.

Implements DB-driven RBAC with branch-level data isolation.
Permissions are stored in the RolePermission table and cached for 5 minutes.
No endpoint may leak cross-branch data.
"""

from rest_framework import permissions
from core.models import Role, RolePermission


def get_requested_branch_id(request, view=None):
    """Return the branch explicitly selected for this request, if any."""
    view_kwargs = getattr(view, 'kwargs', {}) if view else {}
    body_branch = None
    if request.method not in permissions.SAFE_METHODS and hasattr(request, 'data'):
        body_branch = request.data.get('branch') or request.data.get('branch_id')
    return (
        view_kwargs.get('branch_id')
        or body_branch
        or request.query_params.get('branch')
        or request.headers.get('X-Branch-ID')
    )


def require_accessible_branch(user, branch_id):
    """Resolve a branch only when it belongs to the authenticated user's scope."""
    from core.models import Branch
    from rest_framework.exceptions import PermissionDenied, ValidationError

    try:
        branch = Branch.objects.get(pk=branch_id)
    except (Branch.DoesNotExist, ValueError, TypeError):
        raise ValidationError({'branch': 'Invalid branch.'})
    if not user.has_branch_access(branch):
        raise PermissionDenied('You do not have access to this branch.')
    return branch


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
            return False

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
        
        # Create jobs
        if request.method == 'POST':
            return _has_perm(request.user, 'canCreateJobCards')
        
        # Update jobs
        if request.method in ['PUT', 'PATCH']:
            return _has_perm(request.user, 'canEditJobCards')
        
        # Delete: Only Super Admin, Owner and Manager
        return request.user.role in [Role.SUPER_ADMIN, Role.OWNER, Role.MANAGER]


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


class CanManageCustomers(permissions.BasePermission):
    """Permission for customer management."""
    message = "You do not have permission to manage customers."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        # All roles can read customers
        if request.method in permissions.SAFE_METHODS:
            return True
        
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


class BranchScopedMixin:
    """
    Mixin to automatically filter querysets by branch access.
    Use this in ViewSets to ensure branch-level data isolation.
    """

    def get_queryset(self):
        """Filter queryset based on user's branch access."""
        queryset = super().get_queryset()
        user = self.request.user
        
        if not user.is_authenticated:
            return queryset.none()
        
        # Get the branch field name (default is 'branch')
        branch_field = getattr(self, 'branch_field', 'branch')
        
        # Get accessible branches for this user
        accessible_branches = user.get_accessible_branches()
        
        # Check for specific branch filter in request (query param or header)
        branch_id = self.request.query_params.get('branch')
        if not branch_id:
            branch_id = self.request.headers.get('X-Branch-ID')

        # Allow 'universal' as a special keyword
        if branch_id and str(branch_id).lower() == 'universal':
            branch_id = None

        if branch_id:
            from core.models import Branch
            try:
                requested_branch = Branch.objects.get(pk=branch_id)
                if user.has_branch_access(requested_branch):
                    accessible_branches = accessible_branches.filter(pk=branch_id)
                else:
                    return queryset.none()
            except Branch.DoesNotExist:
                return queryset.none()
        
        # Apply branch filter: accessible branches OR branch is null (universal items)
        from django.db.models import Q
        q_accessible = Q(**{f'{branch_field}__in': accessible_branches})
        q_null = Q(**{f'{branch_field}__isnull': True})
        return queryset.filter(q_accessible | q_null)

    def _audit_create(self, obj):
        from audit.services import AuditLogService
        AuditLogService.log_create(self.request.user, obj, request=self.request)

    def _audit_update(self, obj, old_values):
        from audit.services import AuditLogService
        AuditLogService.log_update(
            self.request.user, obj, old_values, request=self.request,
        )

    def perform_create(self, serializer):
        """Set a validated branch and record the creation in the audit trail."""
        branch_id = get_requested_branch_id(self.request, self)
        explicit_universal = branch_id and str(branch_id).lower() == 'universal'

        if explicit_universal and self.request.user.role != Role.SUPER_ADMIN:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only platform administrators can create universal records.')

        if explicit_universal:
            branch = None
        elif branch_id:
            branch = require_accessible_branch(self.request.user, branch_id)
        else:
            branch = getattr(self.request, 'current_branch', None)
            if not branch:
                branch = self.request.user.get_accessible_branches().first()
            if not branch and self.request.user.role != Role.SUPER_ADMIN:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You do not have a branch assigned.')

        serializer.save(branch=branch)
        self._audit_create(serializer.instance)

    def perform_update(self, serializer):
        """Prevent cross-branch moves and record old/new values."""
        from audit.services import AuditLogService
        old_values = AuditLogService._get_model_dict(serializer.instance)

        if 'branch' in serializer.validated_data:
            branch = serializer.validated_data.get('branch')
            if branch is None and self.request.user.role != Role.SUPER_ADMIN:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('Only platform administrators can create universal records.')
            if branch is not None and not self.request.user.has_branch_access(branch):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You do not have access to this branch.')

        serializer.save()
        self._audit_update(serializer.instance, old_values)

    def perform_destroy(self, instance):
        """Record destructive changes before deleting the object."""
        from audit.services import AuditLogService
        AuditLogService.log_delete(
            self.request.user, instance, request=self.request,
        )
        instance.delete()
