"""
Core ViewSets for Organization, Branch, and User management.
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.serializers import HealthCheckSerializer


class HealthCheckView(APIView):
    """
    GET /api/healthz/
    Returns 200 when the app + database are reachable.
    Used by Docker HEALTHCHECK, load balancers, and uptime monitors.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = HealthCheckSerializer

    def get(self, request):
        from django.db import connection
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False

        if not db_ok:
            return Response({'status': 'unhealthy', 'db': False}, status=503)

        return Response({'status': 'ok', 'db': True})

from core.models import Organization, Branch, User, Role
from core.serializers import (
    OrganizationSerializer, OrganizationCreateSerializer,
    OrganizationBrandingSerializer,
    BranchSerializer, BranchMinimalSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, SetCurrentBranchSerializer,
    KeyValueSerializer
)
from core.permissions import (
    IsOwner, IsOwnerOrManager, IsBranchMember, IsSuperAdmin,
    CanManageUsers, CanAssignBranches,
)
from audit.services import AuditLogService


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization management.
    Only superusers can create organizations.
    Owners can view/update their own organization.
    """
    queryset = Organization.objects.none()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'legal_name', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        """Users can only see their own organization. Super Admins see all."""
        if self.request.user.is_superuser or self.request.user.role == Role.SUPER_ADMIN:
            return Organization.objects.all()
        return Organization.objects.filter(pk=self.request.user.organization_id)

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsSuperAdmin()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def branding(self, request):
        """Get branding info for current user's organization.
        Returns org name, logo, tagline, colors for UI branding.
        Super Admins without an org get a default 'ServiceHub' response."""
        org = request.user.organization
        if not org:
            return Response({
                'name': 'ServiceHub',
                'tagline': 'Management System',
                'logo': None,
                'primary_color': '#6366f1',
                'favicon': None,
            })
        serializer = OrganizationBrandingSerializer(org)
        return Response(serializer.data)


class BranchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Branch management.
    - Owners can create/update/deactivate branches
    - Managers can view branches they're assigned to
    - All users can view their accessible branches
    """
    queryset = Branch.objects.none()
    serializer_class = BranchSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'city', 'state']
    search_fields = ['name', 'code', 'city', 'gstin']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        """Filter branches based on user's access."""
        user = self.request.user
        return user.get_accessible_branches()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsOwner()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        # Check if branch has active jobs
        if hasattr(instance, 'job_cards') and instance.job_cards.exclude(
            status__in=['DELIVERED', 'CANCELLED']
        ).exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                "Cannot deactivate branch with active jobs."
            )
        
        instance.is_active = False
        instance.save()

    @action(detail=True, methods=['get'])
    def users(self, request, pk=None):
        """Get all users assigned to this branch."""
        branch = self.get_object()
        users = branch.users.filter(is_active=True)
        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], permission_classes=[IsOwner], url_path='assign-user')
    def assign_user(self, request, pk=None):
        """Assign a user to this branch."""
        branch = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            raise ValidationError('user_id is required')

        try:
            user = User.objects.get(
                pk=user_id,
                organization=request.user.organization
            )
        except User.DoesNotExist:
            raise NotFound('User not found')

        user.branches.add(branch)
        return Response({'message': f'User {user.email} assigned to {branch.name}'})

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def remove_user(self, request, pk=None):
        """Remove a user from this branch."""
        branch = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            raise ValidationError('user_id is required')

        try:
            user = User.objects.get(
                pk=user_id,
                organization=request.user.organization
            )
        except User.DoesNotExist:
            raise NotFound('User not found')

        user.branches.remove(branch)
        return Response({'message': f'User {user.email} removed from {branch.name}'})

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Get branch statistics."""
        branch = self.get_object()
        
        # Import here to avoid circular imports
        from jobs.models import JobCard
        from billing.models import Invoice, Payment
        from inventory.models import InventoryItem
        
        # Job statistics
        total_jobs = branch.job_cards.count() if hasattr(branch, 'job_cards') else 0
        pending_jobs = branch.job_cards.exclude(
            status__in=['DELIVERED', 'CANCELLED']
        ).count() if hasattr(branch, 'job_cards') else 0
        
        # Inventory statistics
        low_stock_items = InventoryItem.objects.filter(
            branch=branch,
            is_active=True,
            quantity__lte=models.F('low_stock_threshold')
        ).count()
        
        return Response({
            'total_jobs': total_jobs,
            'pending_jobs': pending_jobs,
            'low_stock_items': low_stock_items,
        })


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for User management.
    Only Owners can manage users in their organization.
    """
    queryset = User.objects.none()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanManageUsers]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['first_name', 'last_name', 'email', 'created_at']
    ordering = ['first_name', 'last_name']

    def get_queryset(self):
        """Users can only see users in their organization. Super Admins see all. Can filter by branch."""
        if self.request.user.role == Role.SUPER_ADMIN:
            queryset = User.objects.all().prefetch_related('branches')
        else:
            queryset = User.objects.filter(
                organization=self.request.user.organization
            ).prefetch_related('branches')
        
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            from core.models import Branch
            try:
                if self.request.user.role == Role.SUPER_ADMIN:
                    branch = Branch.objects.get(pk=branch_id)
                else:
                    branch = Branch.objects.get(pk=branch_id, organization=self.request.user.organization)
                queryset = queryset.filter(
                    models.Q(branches=branch) | models.Q(role=Role.OWNER)
                ).distinct()
            except Branch.DoesNotExist:
                return queryset.none()
                
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['me', 'update_me', 'change_password', 'set_current_branch', 'my_branches', 'update_location']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_update(self, serializer):
        """Audit privilege changes (role, active status, branches)."""
        instance = serializer.instance
        old_role = instance.role
        old_active = instance.is_active
        old_branch_ids = set(instance.branches.values_list('pk', flat=True))

        user = serializer.save()

        changes = {}
        if user.role != old_role:
            changes['role'] = {'old': old_role, 'new': user.role}
        if user.is_active != old_active:
            changes['is_active'] = {'old': old_active, 'new': user.is_active}
        new_branch_ids = set(user.branches.values_list('pk', flat=True))
        if new_branch_ids != old_branch_ids:
            changes['branches'] = {
                'old': [str(pk) for pk in old_branch_ids],
                'new': [str(pk) for pk in new_branch_ids],
            }

        if changes:
            AuditLogService.log(
                user=self.request.user,
                action='PRIVILEGE_CHANGE',
                model_name='User',
                object_id=str(user.pk),
                old_values={k: v.get('old') for k, v in changes.items()},
                new_values={k: v.get('new') for k, v in changes.items()},
                details={'target_email': user.email},
                request=self.request,
            )

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot delete your own account.")

        if instance.role == Role.SUPER_ADMIN and self.request.user.role != Role.SUPER_ADMIN:
            raise PermissionDenied("Only super admins can deactivate super admin accounts.")

        # Check if this is the only owner
        if instance.role == Role.OWNER:
            other_owners = User.objects.filter(
                organization=instance.organization,
                role=Role.OWNER,
                is_active=True
            ).exclude(pk=instance.pk).count()
            
            if other_owners == 0:
                from rest_framework.exceptions import ValidationError
                raise ValidationError(
                    "Cannot delete the only owner. Add another owner first."
                )

        AuditLogService.log(
            user=self.request.user,
            action='DEACTIVATE',
            model_name='User',
            object_id=str(instance.pk),
            details={'target_email': instance.email, 'role': instance.role},
            request=self.request,
        )
        
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['post'], url_path='update-location')
    def update_location(self, request):
        """Update the live location of the technician."""
        from django.utils import timezone
        lat = request.data.get('latitude')
        lng = request.data.get('longitude')
        
        if lat is None or lng is None:
            raise ValidationError('latitude and longitude are required')
        
        request.user.last_latitude = lat
        request.user.last_longitude = lng
        request.user.last_location_updated = timezone.now()
        request.user.save(update_fields=['last_latitude', 'last_longitude', 'last_location_updated'])
        
        return Response({'message': 'Location updated successfully'})

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['patch'], url_path='update-me')
    def update_me(self, request):
        """Update own first_name, last_name, phone."""
        allowed = {k: v for k, v in request.data.items() if k in ('first_name', 'last_name', 'phone')}
        serializer = UserSerializer(request.user, data=allowed, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='change-password')
    def change_password(self, request):
        """Change current user's password."""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully'})

    @action(detail=False, methods=['get'], url_path='my-branches')
    def my_branches(self, request):
        """Get branches accessible to current user — returns full details so
        the frontend can use address, phone, GSTIN etc. for job card printing."""
        branches = request.user.get_accessible_branches()
        serializer = BranchSerializer(branches, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='set-current-branch')
    def set_current_branch(self, request):
        """Set current branch context for the user session."""
        serializer = SetCurrentBranchSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        branch_id = serializer.validated_data['branch_id']
        branch = Branch.objects.get(pk=branch_id)
        
        # Store in session or create UserSession record
        request.session['current_branch_id'] = str(branch_id)
        
        return Response({
            'message': f'Current branch set to {branch.name}',
            'branch': BranchMinimalSerializer(branch).data
        })

    @action(detail=True, methods=['post'], permission_classes=[IsOwner], url_path='assign-branches')
    def assign_branches(self, request, pk=None):
        """Assign branches to a user."""
        user = self.get_object()
        branch_ids = request.data.get('branch_ids', [])
        
        # Validate all branches belong to organization
        branches = Branch.objects.filter(
            pk__in=branch_ids,
            organization=request.user.organization
        )
        
        if len(branches) != len(branch_ids):
            raise ValidationError('One or more branches not found or unauthorized')
        
        user.branches.set(branches)
        return Response({'message': 'Branches assigned successfully'})


class RoleListView(generics.ListAPIView):
    """List available roles."""
    permission_classes = [IsAuthenticated]
    serializer_class = KeyValueSerializer
    queryset = User.objects.none()

    def get(self, request):
        roles = [
            {'value': role.value, 'label': role.label}
            for role in Role
            # Only show SUPER_ADMIN option to existing super admins
            if role != Role.SUPER_ADMIN or request.user.role == Role.SUPER_ADMIN
        ]
        return Response(roles)


# Import models here to avoid circular import in stats action
from django.db import models
