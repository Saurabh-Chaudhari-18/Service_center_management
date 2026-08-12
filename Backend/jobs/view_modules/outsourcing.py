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

class OutsourceVendorViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    CRUD ViewSet for outsource vendor directory.
    Vendors are branch-scoped (or shared if branch is null).
    """
    queryset = OutsourceVendor.objects.filter(is_active=True)
    serializer_class = OutsourceVendorSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageOutsourcing]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['name', 'contact_person', 'phone', 'city', 'specialization']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    include_universal = True


class OutsourcedRepairViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for listing, creating, and managing outsourced repair records (jobs or inventory warranty repairs).
    """
    queryset = OutsourcedRepair.objects.select_related(
        'job', 'job__customer', 'inventory_item', 'vendor', 'branch', 'sent_by', 'received_by'
    ).all()
    serializer_class = OutsourcedRepairSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageOutsourcing]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'repair_outcome', 'vendor', 'job', 'is_warranty_repair']
    search_fields = [
        'job__job_number',
        'job__customer__first_name',
        'job__customer__last_name',
        'job__customer__mobile',
        'item_name',
        'serial_number',
        'customer_name',
        'customer_phone',
        'vendor__name',
        'vendor_invoice_number',
        'reason',
        'notes'
    ]
    ordering_fields = ['sent_date', 'created_at', 'expected_return_date', 'return_date', 'status']
    ordering = ['-sent_date', '-created_at']

    def perform_create(self, serializer):
        user = self.request.user
        job = serializer.validated_data.get('job')
        inventory_item = serializer.validated_data.get('inventory_item')
        vendor = serializer.validated_data.get('vendor')
        branch_id = get_requested_branch_id(self.request, self)

        if branch_id and str(branch_id).lower() != 'universal':
            branch = require_accessible_branch(user, branch_id)
        elif job:
            branch = job.branch
        elif inventory_item:
            branch = inventory_item.branch
        else:
            branch = user.get_accessible_branches().first()

        if not branch or not user.has_branch_access(branch):
            raise PermissionDenied('You do not have access to the repair branch.')
        for related in (job, inventory_item):
            if related and related.branch_id != branch.id:
                raise ValidationError({'branch': 'All repair records must belong to the same branch.'})
        if vendor and vendor.branch_id and vendor.branch_id != branch.id:
            raise ValidationError({'vendor': 'Vendor does not belong to the repair branch.'})

        serializer.save(sent_by=user, branch=branch)
        self._audit_create(serializer.instance)

    @action(detail=True, methods=['post'], url_path='return')
    def mark_returned(self, request, pk=None):
        """Mark an outsourced repair as returned from vendor."""
        outsource = self.get_object()
        if outsource.status != OutsourcedRepairStatus.SENT:
            raise ValidationError("Record is not in SENT status.")

        serializer = OutsourcedRepairReturnSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        outsource = serializer.update(outsource, serializer.validated_data)
        self._audit_update(outsource)

        return Response(OutsourcedRepairSerializer(outsource).data)


# =====================================================
# Outsource Job Actions (on JobCardViewSet)
# =====================================================

# Monkey-patching is messy; add actions as standalone views
# that are registered in urls.py with the job ID.

from rest_framework.views import APIView


class JobOutsourceView(APIView):
    """POST /jobs/{job_id}/outsource/ — create outsource record + change status."""
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageOutsourcing]
    serializer_class = OutsourcedRepairCreateSerializer

    def post(self, request, job_id):
        try:
            job = JobCard.objects.get(pk=job_id, branch__in=request.user.get_accessible_branches())
        except JobCard.DoesNotExist:
            raise NotFound("Job not found.")

        # Check if job can transition to OUTSOURCED
        from jobs.models import ALLOWED_STATUS_TRANSITIONS
        allowed = ALLOWED_STATUS_TRANSITIONS.get(job.status, [])
        if JobStatus.OUTSOURCED not in allowed:
            raise ValidationError(
                f"Cannot outsource from status '{job.get_status_display()}'. "
                f"Allowed transitions: {[s.label for s in allowed]}"
            )

        serializer = OutsourcedRepairCreateSerializer(
            data=request.data,
            context={'request': request, 'job': job}
        )
        serializer.is_valid(raise_exception=True)
        outsource = serializer.save()
        AuditLogService.log_create(request.user, outsource, request=request)

        return Response(
            OutsourcedRepairSerializer(outsource).data,
            status=status.HTTP_201_CREATED
        )


class JobOutsourceReturnView(APIView):
    """POST /jobs/{job_id}/outsource/{outsource_id}/return/ — mark returned."""
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageOutsourcing]
    serializer_class = OutsourcedRepairReturnSerializer

    def post(self, request, job_id, outsource_id):
        try:
            outsource = OutsourcedRepair.objects.select_related('job', 'vendor').get(
                pk=outsource_id,
                job_id=job_id,
                branch__in=request.user.get_accessible_branches(),
            )
        except OutsourcedRepair.DoesNotExist:
            raise NotFound("Outsource record not found.")

        if outsource.status != 'SENT':
            raise ValidationError("This outsource record is not in 'Sent' status.")

        serializer = OutsourcedRepairReturnSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        outsource = serializer.update(outsource, serializer.validated_data)
        AuditLogService.log_update(request.user, outsource, request=request)

        return Response(
            OutsourcedRepairSerializer(outsource).data,
            status=status.HTTP_200_OK
        )
