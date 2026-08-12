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


def get_scoped_branches(request, view=None):
    """Return the one canonical branch queryset for a request."""
    branches = request.user.get_accessible_branches()
    branch_id = get_requested_branch_id(request, view)
    if not branch_id:
        return branches
    if str(branch_id).lower() == 'universal':
        return branches.none()
    try:
        branch = require_accessible_branch(request.user, branch_id)
    except Exception:
        return branches.none()
    return branches.filter(pk=branch.pk)


class BranchScopePolicy:
    """Central policy for tenant rows and explicitly universal resources."""

    @staticmethod
    def filter_queryset(queryset, *, request, view, branch_field, include_universal=False):
        from django.db.models import Q

        user = request.user
        if not user.is_authenticated:
            return queryset.none()
        branch_id = get_requested_branch_id(request, view)
        if branch_id and str(branch_id).lower() == 'universal':
            if user.role != Role.SUPER_ADMIN or not include_universal:
                return queryset.none()
            return queryset.filter(**{f'{branch_field}__isnull': True})

        branches = get_scoped_branches(request, view)
        scoped = Q(**{f'{branch_field}__in': branches})
        if include_universal:
            scoped |= Q(**{f'{branch_field}__isnull': True})
        return queryset.filter(scoped)

    @staticmethod
    def resolve_write_branch(*, request, view, allow_universal=False):
        from rest_framework.exceptions import PermissionDenied

        branch_id = get_requested_branch_id(request, view)
        if branch_id and str(branch_id).lower() == 'universal':
            if request.user.role != Role.SUPER_ADMIN or not allow_universal:
                raise PermissionDenied(
                    'This resource cannot be created outside a branch.'
                )
            return None
        if branch_id:
            return require_accessible_branch(request.user, branch_id)
        branch = getattr(request, 'current_branch', None)
        if not branch:
            branch = request.user.get_accessible_branches().first()
        if not branch and request.user.role != Role.SUPER_ADMIN:
            raise PermissionDenied('You do not have a branch assigned.')
        return branch
