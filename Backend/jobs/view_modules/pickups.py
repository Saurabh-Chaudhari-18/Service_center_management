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

class PickupRequestViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for Pickup & Drop requests.
    Manages the lifecycle of pickup requests from customer calls.
    """
    serializer_class = PickupRequestSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    pagination_class = OptionalPageSizePagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_urgent', 'assigned_technician', 'pickup_date']
    search_fields = [
        'pickup_number', 'customer__first_name', 'customer__last_name',
        'customer__mobile', 'brand', 'model_name', 'customer_complaint'
    ]
    ordering_fields = ['created_at', 'pickup_date', 'is_urgent']
    ordering = ['-is_urgent', '-created_at']

    queryset = PickupRequest.objects.select_related(
        'branch', 'customer', 'assigned_technician', 'created_by', 'job'
    ).all()

    def get_queryset(self):
        return super().get_queryset()

    def get_serializer_class(self):
        if self.action == 'create':
            return PickupRequestCreateSerializer
        if self.action == 'list':
            return PickupRequestListSerializer
        return PickupRequestSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get pickup request statistics."""
        qs = self.get_queryset()
        return Response({
            'total': qs.count(),
            'requested': qs.filter(status=PickupRequestStatus.REQUESTED).count(),
            'assigned': qs.filter(status=PickupRequestStatus.ASSIGNED).count(),
            'en_route': qs.filter(status=PickupRequestStatus.EN_ROUTE).count(),
            'picked_up': qs.filter(status=PickupRequestStatus.PICKED_UP).count(),
            'delivered_to_center': qs.filter(status=PickupRequestStatus.DELIVERED_TO_CENTER).count(),
            'completed': qs.filter(status=PickupRequestStatus.COMPLETED).count(),
            'cancelled': qs.filter(status=PickupRequestStatus.CANCELLED).count(),
            'pending': qs.exclude(
                status__in=[PickupRequestStatus.COMPLETED, PickupRequestStatus.CANCELLED]
            ).count(),
        })

    @action(detail=True, methods=['post'], url_path='assign-technician')
    def assign_technician(self, request, pk=None):
        """Assign a technician for pickup."""
        pickup = self.get_object()
        technician_id = request.data.get('technician_id')

        if not technician_id:
            raise ValidationError('technician_id is required.')

        try:
            technician = User.objects.get(
                pk=technician_id, role=Role.TECHNICIAN, is_active=True
            )
        except User.DoesNotExist:
            raise NotFound('Technician not found or inactive.')
        if not technician.has_branch_access(pickup.branch):
            raise ValidationError('Technician does not have access to this branch.')

        pickup.assigned_technician = technician
        if pickup.status == PickupRequestStatus.REQUESTED:
            pickup.status = PickupRequestStatus.ASSIGNED
        pickup.save()

        serializer = self.get_serializer(pickup)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        """Update pickup request status."""
        pickup = self.get_object()
        serializer = PickupRequestStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['new_status']
        notes = serializer.validated_data.get('notes', '')

        if not pickup.can_transition_to(new_status):
            allowed = ALLOWED_PICKUP_TRANSITIONS.get(pickup.status, [])
            allowed_labels = [s.label for s in allowed]
            raise ValidationError(f'Cannot transition from {pickup.get_status_display()} to {PickupRequestStatus(new_status).label}. Allowed: {", ".join(allowed_labels)}')

        pickup.status = new_status
        if notes:
            pickup.notes = (pickup.notes + '\n' + notes).strip() if pickup.notes else notes
        pickup.save()

        return Response(PickupRequestSerializer(pickup).data)

    @action(detail=True, methods=['post'], url_path='convert-to-job')
    def convert_to_job(self, request, pk=None):
        """
        Convert a completed pickup request into a Job Card.
        Only allowed when status is DELIVERED_TO_CENTER or COMPLETED.
        """
        pickup = self.get_object()

        if pickup.status not in [
            PickupRequestStatus.DELIVERED_TO_CENTER,
            PickupRequestStatus.COMPLETED
        ]:
            raise ValidationError('Pickup must be at center before creating a job card.')

        if pickup.job:
            raise ValidationError({'detail': 'A job card already exists for this pickup.', 'job_id': str(pickup.job.id), 'job_number': pickup.job.job_number})

        with transaction.atomic():
            job = JobCard.objects.create(
                branch=pickup.branch,
                customer=pickup.customer,
                device_type=pickup.device_type,
                brand=pickup.brand or 'Unknown',
                model=pickup.model_name or 'Unknown',
                customer_complaint=pickup.customer_complaint,
                physical_condition='Received via pickup',
                is_urgent=pickup.is_urgent,
                received_by=request.user,
            )
            pickup.job = job
            if pickup.status == PickupRequestStatus.DELIVERED_TO_CENTER:
                pickup.status = PickupRequestStatus.COMPLETED
            pickup.save()

            # Create initial status history
            JobStatusHistory.objects.create(
                job=job,
                from_status=JobStatus.RECEIVED,
                to_status=JobStatus.RECEIVED,
                changed_by=request.user,
                notes=f'Created from pickup request {pickup.pickup_number}'
            )

        return Response({
            'message': 'Job card created from pickup request.',
            'job_id': str(job.id),
            'job_number': job.job_number,
            'pickup_number': pickup.pickup_number,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def track(self, request, pk=None):
        """Get live location of the assigned technician."""
        pickup = self.get_object()

        if not pickup.assigned_technician:
            raise ValidationError('No technician assigned yet.')

        technician = pickup.assigned_technician
        return Response({
            'latitude': technician.last_latitude,
            'longitude': technician.last_longitude,
            'updated_at': technician.last_location_updated,
        })


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle

class PublicTrackingView(APIView):
    """
    Public View for tracking job card status without authentication.
    Requires job number, phone, and tracking PIN for security.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'public_track'
    serializer_class = GenericResponseSerializer

    TRACKING_ERROR = 'Could not find job with provided details. Please check your phone number and PIN.'

    def _get_verified_job(self, request, job_number, lock=False):
        phone = request.query_params.get('phone') or request.data.get('phone')
        pin = (request.query_params.get('pin') or request.data.get('pin') or '').strip()
        if not phone:
            raise ValidationError('Phone number is required for verification.')
        if not pin or len(pin) != 4 or not pin.isdigit():
            raise ValidationError('A valid 4-digit PIN is required for verification.')
        digits = ''.join(ch for ch in phone if ch.isdigit())
        if len(digits) < 10:
            raise NotFound(self.TRACKING_ERROR)
        queryset = JobCard.objects.select_for_update() if lock else JobCard.objects
        job = queryset.filter(
            job_number=job_number,
            customer__mobile__endswith=digits[-10:],
            tracking_pin=pin,
        ).first()
        if not job:
            raise NotFound(self.TRACKING_ERROR)
        return job

    def get(self, request, job_number):
        job = self._get_verified_job(request, job_number)

        timeline = []
        for history in job.status_history.all():
            timeline.append({
                'status': history.to_status,
                'status_display': JobStatus(history.to_status).label if history.to_status in JobStatus.values else history.to_status,
                'timestamp': history.created_at,
            })

        photos = []
        # We can expose 'DAMAGE' and 'COMPLETED' photos to the public
        for photo in job.photos.filter(photo_type__in=['DAMAGE', 'COMPLETED']):
            photos.append({
                'url': request.build_absolute_uri(photo.photo.url) if photo.photo else None,
                'type': photo.photo_type,
                'description': photo.description,
            })

        return Response({
            'job_number': job.job_number,
            'device_type': job.get_device_type_display(),
            'brand': job.brand,
            'model': job.model,
            'customer_complaint': job.customer_complaint,
            'current_status': job.status,
            'current_status_display': job.get_status_display(),
            'estimated_cost': job.estimated_cost,
            'estimated_completion_date': job.estimated_completion_date,
            'customer_response_allowed': job.status == JobStatus.ESTIMATE_SHARED,
            'customer_approval_date': job.customer_approval_date,
            'customer_rejection_reason': job.customer_rejection_reason,
            'timeline': timeline,
            'photos': photos
        })

    def post(self, request, job_number):
        """Let the verified customer approve or reject a shared estimate."""
        serializer = JobEstimateApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            job = self._get_verified_job(request, job_number, lock=True)
            if job.status != JobStatus.ESTIMATE_SHARED:
                raise ValidationError('This estimate is no longer awaiting a response.')
            if serializer.validated_data['approved']:
                job.customer_approval_date = timezone.now()
                job.save(update_fields=['customer_approval_date', 'updated_at'])
                job.transition_status(JobStatus.APPROVED, job.received_by, 'Customer approved estimate through tracking portal')
                message = 'Thank you. Your approval has been recorded.'
            else:
                job.customer_rejection_reason = serializer.validated_data['rejection_reason']
                job.save(update_fields=['customer_rejection_reason', 'updated_at'])
                job.transition_status(JobStatus.REJECTED, job.received_by, f'Customer rejected through tracking portal: {job.customer_rejection_reason}')
                message = 'Your decision has been recorded. The service center will contact you if needed.'
        return Response({'message': message, 'status': job.status})


# =====================================================
# Outsource Vendor ViewSet
# =====================================================
