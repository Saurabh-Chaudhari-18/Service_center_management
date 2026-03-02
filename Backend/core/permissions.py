"""
Custom permissions for branch-scoped access control.

Implements DB-driven RBAC with branch-level data isolation.
Permissions are stored in the RolePermission table and cached for 5 minutes.
No endpoint may leak cross-branch data.
"""

from rest_framework import permissions
from core.models import Role, RolePermission


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
        
        # Get branch from view kwargs or query params
        branch_id = view.kwargs.get('branch_id') or request.query_params.get('branch')
        
        if not branch_id:
            # If no specific branch requested, allow access (queryset will be filtered)
            return True
        
        from core.models import Branch
        try:
            branch = Branch.objects.get(pk=branch_id)
            return request.user.has_branch_access(branch)
        except Branch.DoesNotExist:
            return False

    def has_object_permission(self, request, view, obj):
        # Get branch from the object
        branch = getattr(obj, 'branch', None)
        if branch is None:
            # Object might be a Branch itself
            if hasattr(obj, 'organization'):
                branch = obj
        
        if branch is None:
            return False
        
        return request.user.has_branch_access(branch)


class IsOwner(permissions.BasePermission):
    """Only allow owners to access."""
    message = "Only owners can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == Role.OWNER
        )


class IsOwnerOrManager(permissions.BasePermission):
    """Allow owners and managers to access."""
    message = "Only owners and managers can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [Role.OWNER, Role.MANAGER]
        )


class IsOwnerManagerOrAccountant(permissions.BasePermission):
    """Allow owners, managers, and accountants to access."""
    message = "Only owners, managers, and accountants can perform this action."

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in [Role.OWNER, Role.MANAGER, Role.ACCOUNTANT]
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
        
        # Delete: Only Owner and Manager
        return request.user.role in [Role.OWNER, Role.MANAGER]


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
            Role.OWNER, Role.MANAGER, Role.TECHNICIAN
        ]


class IsTechnicianOrAbove(permissions.BasePermission):
    """Permission for technician-level operations."""
    message = "You do not have permission for this operation."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        
        return request.user.role in [
            Role.OWNER, Role.MANAGER, Role.TECHNICIAN
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
        
        # Write access
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
        
        return request.user.role in [Role.OWNER, Role.MANAGER]


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

    def perform_create(self, serializer):
        """Set branch on create if not already set, supporting universal logic."""
        branch_id = self.request.data.get('branch')
        
        if not branch_id:
            branch_id = self.request.headers.get('X-Branch-ID')
            
        if branch_id and str(branch_id).lower() == 'universal':
            branch_id = None
            
        if not branch_id:
            # Try to get branch from session/context as final fallback
            branch = getattr(self.request, 'current_branch', None)
            if branch:
                serializer.save(branch=branch)
                return
            
            # Universal Branch logic
            if self.request.user.role in ['OWNER', 'MANAGER']:
                # Owners/Managers can create Universal items
                serializer.save(branch=None)
                return
            else:
                # Regular staff must have a branch, pick their first accessible branch
                primary_branch = self.request.user.get_accessible_branches().first()
                if primary_branch:
                    serializer.save(branch=primary_branch)
                    return
                else:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You do not have a branch assigned.")
        
        # Validate branch access before saving specific branch
        if branch_id:
            from core.models import Branch
            try:
                branch = Branch.objects.get(pk=branch_id)
                if not self.request.user.has_branch_access(branch):
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You do not have access to this branch.")
                serializer.save(branch=branch)
            except Branch.DoesNotExist:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"branch": "Invalid branch."})
