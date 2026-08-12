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
from core.serializers import HealthCheckSerializer, ReadinessCheckSerializer

from django.db import models
from core.models import Organization, Branch, User, Role
from core.serializers import (
    OrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationBrandingSerializer,
    BranchSerializer,
    BranchMinimalSerializer,
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    SetCurrentBranchSerializer,
    KeyValueSerializer,
)
from core.permissions import (
    IsOwner,
    IsOwnerOrManager,
    IsBranchMember,
    IsSuperAdmin,
    CanManageUsers,
    CanAssignBranches,
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

    def perform_create(self, serializer):
        branch = serializer.save()
        from notifications.defaults import ensure_default_notification_templates
        ensure_default_notification_templates(branch)

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
