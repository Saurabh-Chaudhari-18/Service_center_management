from tenancy.policy import BranchScopePolicy

class BranchScopedMixin:
    """
    Mixin to automatically filter querysets by branch access.
    Use this in ViewSets to ensure branch-level data isolation.
    """

    def get_queryset(self):
        """Filter queryset based on user's branch access."""
        queryset = super().get_queryset()
        branch_field = getattr(self, 'branch_field', 'branch')
        include_universal = bool(getattr(self, 'include_universal', False))
        return BranchScopePolicy.filter_queryset(
            queryset,
            request=self.request,
            view=self,
            branch_field=branch_field,
            include_universal=include_universal,
        )

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
        branch = BranchScopePolicy.resolve_write_branch(
            request=self.request,
            view=self,
            allow_universal=bool(getattr(self, 'include_universal', False)),
        )
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
