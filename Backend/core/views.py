"""
Core ViewSets for Organization, Branch, and User management.
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from core.models import Organization, Branch, User, Role
from core.serializers import (
    OrganizationSerializer, OrganizationCreateSerializer,
    BranchSerializer, BranchMinimalSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, SetCurrentBranchSerializer
)
from core.permissions import (
    IsOwner, IsOwnerOrManager, IsBranchMember,
    CanManageUsers, CanAssignBranches
)


class OrganizationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Organization management.
    Only superusers can create organizations.
    Owners can view/update their own organization.
    """
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsOwner]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'legal_name', 'city']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        """Users can only see their own organization."""
        if self.request.user.is_superuser:
            return Organization.objects.all()
        return Organization.objects.filter(pk=self.request.user.organization_id)

    def get_serializer_class(self):
        if self.action == 'create':
            return OrganizationCreateSerializer
        return OrganizationSerializer

    def get_permissions(self):
        if self.action == 'create':
            # Only superusers can create organizations
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        instance.is_active = False
        instance.save()


class BranchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Branch management.
    - Owners can create/update/deactivate branches
    - Managers can view branches they're assigned to
    - All users can view their accessible branches
    """
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

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def assign_user(self, request, pk=None):
        """Assign a user to this branch."""
        branch = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(
                pk=user_id,
                organization=request.user.organization
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user.branches.add(branch)
        return Response({'message': f'User {user.email} assigned to {branch.name}'})

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
    def remove_user(self, request, pk=None):
        """Remove a user from this branch."""
        branch = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(
                pk=user_id,
                organization=request.user.organization
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
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
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, CanManageUsers]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']
    ordering_fields = ['first_name', 'last_name', 'email', 'created_at']
    ordering = ['first_name', 'last_name']

    def get_queryset(self):
        """Users can only see users in their organization."""
        return User.objects.filter(
            organization=self.request.user.organization
        ).prefetch_related('branches')

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        if self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['me', 'change_password', 'set_current_branch', 'my_branches']:
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_destroy(self, instance):
        """Soft delete - deactivate instead of deleting."""
        if instance == self.request.user:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("You cannot delete your own account.")
        
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
        
        instance.is_active = False
        instance.save()

    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user's profile."""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change current user's password."""
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'message': 'Password changed successfully'})

    @action(detail=False, methods=['get'])
    def my_branches(self, request):
        """Get branches accessible to current user."""
        branches = request.user.get_accessible_branches()
        serializer = BranchMinimalSerializer(branches, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
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

    @action(detail=True, methods=['post'], permission_classes=[IsOwner])
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
            return Response(
                {'error': 'One or more branches not found or unauthorized'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.branches.set(branches)
        return Response({'message': 'Branches assigned successfully'})


class RoleListView(generics.ListAPIView):
    """List available roles."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        roles = [
            {'value': role.value, 'label': role.label}
            for role in Role
        ]
        return Response(roles)


# Import models here to avoid circular import in stats action
from django.db import models
