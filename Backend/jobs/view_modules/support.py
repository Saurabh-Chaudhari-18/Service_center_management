"""
Job Card ViewSets with lifecycle management and branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from django_filters import rest_framework as filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.db import models as django_models
from django.utils import timezone
from drf_spectacular.utils import extend_schema

from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import ScopedRateThrottle

from jobs.models import (
    JobCard, JobStatus, JobStatusHistory, JobAccessory,
    JobPhoto, JobNote, PartRequest, DeviceType, AccessoryType,
    PickupRequest, PickupRequestStatus, ALLOWED_PICKUP_TRANSITIONS,
    DropdownOption, DropdownCategory,
    OutsourceVendor, OutsourcedRepair, OutsourcedRepairStatus
)
from jobs.serializers import (
    JobCardSerializer, JobCardCreateSerializer, JobCardListSerializer,
    JobStatusUpdateSerializer, JobAssignTechnicianSerializer,
    JobCardUpdateSerializer,
    JobDiagnosisSerializer, JobEstimateApprovalSerializer,
    JobDeliverySerializer, DevicePasswordAccessSerializer,
    JobAccessorySerializer, JobPhotoSerializer, JobNoteSerializer,
    PartRequestSerializer, AccessoryTypeSerializer, DeviceTypeSerializer,
    JobStatusHistorySerializer,
    PickupRequestSerializer, PickupRequestCreateSerializer,
    PickupRequestListSerializer, PickupRequestStatusUpdateSerializer,
    DropdownOptionSerializer,
    OutsourceVendorSerializer, OutsourcedRepairSerializer,
    OutsourcedRepairCreateSerializer, OutsourcedRepairReturnSerializer
)
from audit.services import AuditLogService
from core.permissions import (
    IsBranchMember, CanManageJobs, IsTechnicianOrAbove,
    CanAccessDevicePasswords, CanOverrideStatus, BranchScopedMixin,
    IsOwnerOrManager, CanManageOutsourcing, CanManageCustomerApproval, require_accessible_branch,
    get_requested_branch_id,
)
from core.models import Role, User, Branch
from core.exceptions import JobReadOnlyError, InvalidStatusTransition, ProtectedResourceError
from core.pagination import OptionalPageSizePagination
from core.serializers import GenericResponseSerializer, KeyValueSerializer

class PartRequestViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for part requests."""
    queryset = PartRequest.objects.all()
    serializer_class = PartRequestSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    branch_field = 'job__branch'

    def get_queryset(self):
        return super().get_queryset().select_related(
            'job', 'requested_by', 'approved_by', 'inventory_item'
        )

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a part request."""
        part_request = self.get_object()

        if request.user.role not in [Role.OWNER, Role.MANAGER]:
            raise PermissionDenied('Only owners and managers can approve part requests.')

        try:
            part_request.approve(request.user)
            return Response({'message': 'Part request approved.'})
        except Exception as e:
            raise ValidationError(str(e)) from e

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a part request."""
        part_request = self.get_object()

        if request.user.role not in [Role.OWNER, Role.MANAGER]:
            raise PermissionDenied('Only owners and managers can reject part requests.')

        reason = request.data.get('reason', '')
        if not reason:
            raise ValidationError('Rejection reason is required.')

        part_request.status = 'REJECTED'
        part_request.rejection_reason = reason
        part_request.save()

        return Response({'message': 'Part request rejected.'})


class JobEnumsView(viewsets.ViewSet):
    """ViewSet for job-related enums."""
    permission_classes = [IsAuthenticated]
    serializer_class = KeyValueSerializer

    @action(detail=False, methods=['get'], url_path='device-types')
    def device_types(self, request):
        """Get all device types."""
        types = [{'value': dt.value, 'label': dt.label} for dt in DeviceType]
        return Response(types)

    @action(detail=False, methods=['get'])
    def accessory_types(self, request):
        """Get all accessory types."""
        types = [{'value': at.value, 'label': at.label} for at in AccessoryType]
        return Response(types)

    @action(detail=False, methods=['get'])
    def statuses(self, request):
        """Get all job statuses."""
        statuses = [{'value': js.value, 'label': js.label} for js in JobStatus]
        return Response(statuses)

    @action(detail=False, methods=['get'])
    def pickup_statuses(self, request):
        """Get all pickup request statuses."""
        statuses = [{'value': ps.value, 'label': ps.label} for ps in PickupRequestStatus]
        return Response(statuses)


class DropdownOptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing dropdown options.
    Supports filtering by category and device_type.

    Query params:
      - category: PHYSICAL_CONDITION or ENGINEER_DIAGNOSIS
      - device_type: LAPTOP, DESKTOP, etc. (returns options for that type + options with no type)
    """
    serializer_class = DropdownOptionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['category', 'is_active']
    ordering_fields = ['display_order', 'label']
    ordering = ['display_order', 'label']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerOrManager()]

    def get_queryset(self):
        queryset = DropdownOption.objects.all()

        # Filter by device_type: returns matching + universal (NULL) options
        device_type = self.request.query_params.get('device_type')
        if device_type:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(device_type=device_type) | Q(device_type__isnull=True)
            )

        # Default to active only for list
        if self.action == 'list' and 'is_active' not in self.request.query_params:
            queryset = queryset.filter(is_active=True)

        return queryset
