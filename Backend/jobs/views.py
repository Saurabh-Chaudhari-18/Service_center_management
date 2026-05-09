"""
Job Card ViewSets with lifecycle management and branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import transaction
from django.db import models as django_models
from django.utils import timezone

from jobs.models import (
    JobCard, JobStatus, JobStatusHistory, JobAccessory,
    JobPhoto, JobNote, PartRequest, DeviceType, AccessoryType, DiagnosisPart,
    PickupRequest, PickupRequestStatus, ALLOWED_PICKUP_TRANSITIONS,
    DropdownOption, DropdownCategory
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
    DropdownOptionSerializer
)
from core.permissions import (
    IsBranchMember, CanManageJobs, IsTechnicianOrAbove,
    CanAccessDevicePasswords, CanOverrideStatus, BranchScopedMixin
)
from core.models import Role, User, Branch
from core.exceptions import JobReadOnlyError, InvalidStatusTransition, ProtectedResourceError


class JobCardViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for Job Card management.
    
    Features:
    - Branch-scoped access
    - Sequential status lifecycle
    - Technician assignment
    - Device password access logging
    """
    serializer_class = JobCardSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageJobs]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'device_type', 'is_urgent', 'assigned_technician']
    search_fields = [
        'job_number', 'customer__mobile', 'customer__first_name',
        'customer__last_name', 'brand', 'model', 'serial_number'
    ]
    ordering_fields = ['created_at', 'estimated_completion_date', 'is_urgent']
    ordering = ['-is_urgent', '-created_at']
    branch_field = 'branch'
    queryset = JobCard.objects.all()

    def get_queryset(self):
        """Filter jobs based on user's role and branch access."""
        # BranchScopedMixin handles branch authorization and X-Branch-ID filtering
        queryset = super().get_queryset()
        
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        
        queryset = queryset.select_related(
            'branch', 'customer', 'assigned_technician', 'received_by'
        ).prefetch_related('accessories', 'photos', 'notes', 'status_history')
        
        # Technicians only see their assigned jobs
        if user.role == Role.TECHNICIAN:
            queryset = queryset.filter(assigned_technician=user)
            
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return JobCardCreateSerializer
        if self.action in ['update', 'partial_update']:
            return JobCardUpdateSerializer
        if self.action == 'list':
            return JobCardListSerializer
        return JobCardSerializer

    def perform_destroy(self, instance):
        from django.db.models.deletion import ProtectedError
        try:
            instance.delete()
        except ProtectedError:
            raise ProtectedResourceError(
                "Cannot delete job: it has parts usage or other linked records. "
                "Cancel the job instead."
            )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Update job status with validation.
        Enforces sequential status transitions.
        """
        job = self.get_object()
        
        # Allow Owner to update status even if terminal
        if job.is_terminal_status() and request.user.role != Role.OWNER:
            return Response(
                {'error': f'Job is in terminal status ({job.get_status_display()}) and cannot be modified.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JobStatusUpdateSerializer(
            data=request.data,
            context={'job': job, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        try:
            job.transition_status(
                new_status=JobStatus(serializer.validated_data['new_status']),
                user=request.user,
                notes=serializer.validated_data.get('notes', ''),
                is_override=serializer.validated_data.get('is_override', False)
            )
            
            return Response({
                'message': f'Status updated to {job.get_status_display()}',
                'status': job.status,
                'status_display': job.get_status_display()
            })
        except (JobReadOnlyError, InvalidStatusTransition) as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsBranchMember])
    def assign_technician(self, request, pk=None):
        """Assign or reassign technician to job."""
        job = self.get_object()
        
        # Allow Owner to assign technician even if terminal
        if job.is_terminal_status() and request.user.role != Role.OWNER:
            return Response(
                {'error': 'Cannot assign technician to a completed job.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JobAssignTechnicianSerializer(
            data=request.data,
            context={'job': job, 'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        technician = User.objects.get(pk=serializer.validated_data['technician_id'])
        old_technician = job.assigned_technician
        
        with transaction.atomic():
            job.assigned_technician = technician
            job.save(update_fields=['assigned_technician', 'updated_at'])
            
            # Add note
            JobNote.objects.create(
                job=job,
                note=f"Technician assigned: {technician.get_full_name()}. {serializer.validated_data.get('notes', '')}",
                created_by=request.user,
                is_internal=True
            )
            
            # Notify new technician
            from notifications.services import NotificationService
            NotificationService.on_technician_assigned(job, technician)
        
        return Response({
            'message': f'Technician {technician.get_full_name()} assigned to job.',
            'technician': {
                'id': str(technician.id),
                'name': technician.get_full_name()
            }
        })

    @action(detail=True, methods=['post'], permission_classes=[IsTechnicianOrAbove])
    def add_diagnosis(self, request, pk=None):
        """Add or update diagnosis notes."""
        job = self.get_object()
        
        # Allow Owner to add diagnosis even if terminal
        if job.is_terminal_status() and request.user.role != Role.OWNER:
            return Response(
                {'error': 'Cannot modify a completed job.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JobDiagnosisSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            job.diagnosis_notes = serializer.validated_data['diagnosis_notes']
            
            if 'estimated_cost' in serializer.validated_data:
                job.estimated_cost = serializer.validated_data['estimated_cost']
            if 'estimated_completion_date' in serializer.validated_data:
                job.estimated_completion_date = serializer.validated_data['estimated_completion_date']
            
            job.save()

            # Handle diagnosis parts
            if 'parts' in serializer.validated_data:
                # Clear existing manual parts for this diagnosis
                DiagnosisPart.objects.filter(job=job).delete()
                
                parts_data = serializer.validated_data['parts']
                for part in parts_data:
                    DiagnosisPart.objects.create(
                        job=job,
                        name=part['name'],
                        price=part['price'],
                        warranty_months=part.get('warranty_months', 0),
                        quantity=part.get('quantity', 1)
                    )
            
            # Auto-transition to DIAGNOSIS if still in RECEIVED
            if job.status == JobStatus.RECEIVED:
                job.transition_status(
                    JobStatus.DIAGNOSIS,
                    request.user,
                    'Diagnosis completed'
                )
        
        return Response({
            'message': 'Diagnosis updated successfully.',
            'status': job.status,
            'status_display': job.get_status_display(),
            'diagnosis_parts_count': job.diagnosis_parts.count()
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsBranchMember])
    def share_estimate(self, request, pk=None):
        """Share estimate with customer."""
        job = self.get_object()
        
        if job.status != JobStatus.DIAGNOSIS:
            return Response(
                {'error': 'Job must be diagnosed before sharing estimate.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not job.estimated_cost:
            return Response(
                {'error': 'Estimated cost must be set before sharing.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        with transaction.atomic():
            job.transition_status(
                JobStatus.ESTIMATE_SHARED,
                request.user,
                f'Estimate of ₹{job.estimated_cost} shared with customer'
            )
            
            # Send notification to customer
            from notifications.services import NotificationService
            NotificationService.send_estimate(job)
        
        return Response({
            'message': 'Estimate shared with customer.',
            'status': job.status
        })

    @action(detail=True, methods=['post'])
    def record_customer_response(self, request, pk=None):
        """Record customer's approval or rejection of estimate."""
        job = self.get_object()
        
        if job.status != JobStatus.ESTIMATE_SHARED:
            return Response(
                {'error': 'Estimate must be shared before recording response.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JobEstimateApprovalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            if serializer.validated_data['approved']:
                job.customer_approval_date = timezone.now()
                job.transition_status(
                    JobStatus.APPROVED,
                    request.user,
                    'Customer approved estimate'
                )
                message = 'Customer approved the estimate.'
            else:
                job.customer_rejection_reason = serializer.validated_data['rejection_reason']
                job.transition_status(
                    JobStatus.REJECTED,
                    request.user,
                    f"Customer rejected: {job.customer_rejection_reason}"
                )
                message = 'Customer rejected the estimate.'
            
            job.save()
        
        return Response({
            'message': message,
            'status': job.status
        })

    @action(detail=True, methods=['post'], permission_classes=[IsTechnicianOrAbove])
    def mark_ready(self, request, pk=None):
        """Mark job as ready for pickup."""
        job = self.get_object()
        
        # Allow Owner to mark ready even if not in expected status (via override effectively, but here we check status)
        # Actually, standard flow enforces status. Owner can use update_status to force move.
        # But let's leave this strict unless requested, or relax if owner?
        # User said "edit the form till last status".
        # Let's keep this strict for workflow, Owner can use update_status for arbitrary jumps.
        
        if job.status not in [JobStatus.REPAIR_IN_PROGRESS, JobStatus.WAITING_FOR_PARTS]:
            return Response(
                {'error': 'Job must be in progress to mark as ready.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        completion_notes = request.data.get('completion_notes', '')
        
        with transaction.atomic():
            job.completion_notes = completion_notes
            job.actual_completion_date = timezone.now()
            job.save()
            
            job.transition_status(
                JobStatus.READY_FOR_DELIVERY,
                request.user,
                completion_notes
            )
            
            # Generate delivery OTP
            job.generate_delivery_otp()
        
        return Response({
            'message': 'Job marked as ready for pickup.',
            'status': job.status
        })

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """
        Deliver job to customer.
        Requires OTP or signature verification.
        """
        job = self.get_object()
        
        if job.status != JobStatus.READY_FOR_DELIVERY:
            return Response(
                {'error': 'Job must be ready for pickup before delivery.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = JobDeliverySerializer(
            data=request.data,
            context={'job': job}
        )
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            if serializer.validated_data.get('signature'):
                job.delivery_signature = serializer.validated_data['signature']
            
            job.delivery_date = timezone.now()
            job.delivered_by = request.user
            job.save()
            
            job.transition_status(
                JobStatus.DELIVERED,
                request.user,
                serializer.validated_data.get('notes', 'Device delivered to customer')
            )
        
        return Response({
            'message': 'Job delivered successfully.',
            'status': job.status
        })

    @action(detail=True, methods=['post'])
    def resend_delivery_otp(self, request, pk=None):
        """Resend delivery OTP to customer."""
        job = self.get_object()
        
        if job.status != JobStatus.READY_FOR_DELIVERY:
            return Response(
                {'error': 'Job must be ready for pickup.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        otp = job.generate_delivery_otp()
        
        return Response({
            'message': 'OTP sent to customer.',
            'otp': otp if request.user.role in [Role.OWNER, Role.MANAGER] else '******'
        })

    @action(detail=True, methods=['post'], permission_classes=[CanAccessDevicePasswords])
    def access_device_password(self, request, pk=None):
        """
        Access device password with audit logging.
        Only Owner, Manager, and Technician can access.
        """
        job = self.get_object()
        
        serializer = DevicePasswordAccessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Log the access
        from audit.models import DevicePasswordAccessLog
        DevicePasswordAccessLog.objects.create(
            job=job,
            accessed_by=request.user,
            reason=serializer.validated_data['reason']
        )
        
        return Response({
            'device_password': job.device_password,
            'bios_password': job.bios_password,
            'warning': 'This access has been logged for security purposes.'
        })

    @action(detail=True, methods=['post'], permission_classes=[IsTechnicianOrAbove])
    def request_part(self, request, pk=None):
        """Request a part for this job."""
        job = self.get_object()
        
        # Allow Owner to request parts even if terminal
        if job.is_terminal_status() and request.user.role != Role.OWNER:
            return Response(
                {'error': 'Cannot request parts for a completed job.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PartRequestSerializer(data={
            **request.data,
            'job': str(job.id)
        })
        serializer.is_valid(raise_exception=True)
        serializer.save(requested_by=request.user)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def part_requests(self, request, pk=None):
        """Get all part requests for this job."""
        job = self.get_object()
        requests = job.part_requests.all()
        serializer = PartRequestSerializer(requests, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_photo(self, request, pk=None):
        """Add a photo to the job."""
        job = self.get_object()

        # Build mutable data dict from the multipart request.
        # We cannot spread `request.data` directly because it is a QueryDict
        # and ** unpacking turns multi-value keys into lists, which breaks
        # single-value fields like photo_type and description.
        # The actual file lives in request.FILES, not request.data.
        data = {
            'photo': request.FILES.get('photo'),
            'photo_type': request.data.get('photo_type', ''),
            'description': request.data.get('description', ''),
            'job': str(job.id),
            'uploaded_by': str(request.user.id),
        }

        serializer = JobPhotoSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        """Add an internal note to the job."""
        job = self.get_object()
        
        serializer = JobNoteSerializer(data={
            **request.data,
            'job': str(job.id),
            'created_by': str(request.user.id)
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Get complete timeline of job events."""
        job = self.get_object()
        
        # Combine status history and notes
        timeline = []
        
        # Status changes
        for history in job.status_history.all():
            timeline.append({
                'type': 'status_change',
                'timestamp': history.created_at,
                'from_status': history.from_status,
                'to_status': history.to_status,
                'user': history.changed_by.get_full_name(),
                'notes': history.notes,
                'is_override': history.is_override
            })
        
        # Notes
        for note in job.notes.all():
            timeline.append({
                'type': 'note',
                'timestamp': note.created_at,
                'user': note.created_by.get_full_name(),
                'content': note.note,
                'is_internal': note.is_internal
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return Response(timeline)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending jobs (not delivered/cancelled)."""
        queryset = self.get_queryset().exclude(
            status__in=[JobStatus.DELIVERED, JobStatus.CANCELLED, JobStatus.REJECTED]
        )
        
        # Apply additional filters
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        urgent_only = request.query_params.get('urgent')
        if urgent_only == 'true':
            queryset = queryset.filter(is_urgent=True)
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = JobCardListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = JobCardListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def my_jobs(self, request):
        """Get jobs assigned to current user (for technicians).

        Paginated to prevent massive JSON payloads as technicians
        accumulate hundreds of historical jobs over time.
        """
        if request.user.role != Role.TECHNICIAN:
            return Response(
                {'error': 'This endpoint is for technicians only.'},
                status=status.HTTP_403_FORBIDDEN
            )

        queryset = JobCard.objects.filter(
            assigned_technician=request.user,
            branch__in=request.user.get_accessible_branches()
        ).exclude(
            status__in=[JobStatus.DELIVERED, JobStatus.CANCELLED]
        ).order_by('-is_urgent', '-created_at')

        # Paginate to avoid downloading entire job history in one request
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = JobCardListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = JobCardListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get per-status job counts for the current branch.

        Uses PostgreSQL aggregations (COUNT + GROUP BY) so the frontend
        does NOT need to download the entire jobs table just to count statuses.
        This replaces the anti-pattern of fetching all jobs client-side to
        build the status-tab counters on jobs/page.tsx.
        """
        qs = self.get_queryset()
        counts = qs.values('status').annotate(count=django_models.Count('id'))
        result = {item['status']: item['count'] for item in counts}
        total = sum(result.values())
        return Response({
            'total': total,
            'by_status': result,
        })

    @action(detail=False, methods=['get'])
    def next_number(self, request):
        """Predict next job number for a branch."""
        branch_id = request.query_params.get('branch')
        if not branch_id:
             return Response({'error': 'Branch ID required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate access
        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            return Response({'error': 'Branch not found'}, status=status.HTTP_404_NOT_FOUND)

        if not request.user.has_branch_access(branch):
             return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)

        # Predict
        fy = branch.get_current_financial_year()
        next_sequence = str(branch.jobcard_current_number + 1).zfill(5)
        predicted_number = f"{branch.jobcard_prefix}/{fy}/{branch.code}/{next_sequence}"
        
        return Response({'next_number': predicted_number})


class PartRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for part requests."""
    serializer_class = PartRequestSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]

    def get_queryset(self):
        return PartRequest.objects.filter(
            job__branch__in=self.request.user.get_accessible_branches()
        ).select_related('job', 'requested_by', 'approved_by', 'inventory_item')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a part request."""
        part_request = self.get_object()
        
        if request.user.role not in [Role.OWNER, Role.MANAGER]:
            return Response(
                {'error': 'Only owners and managers can approve part requests.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            part_request.approve(request.user)
            return Response({'message': 'Part request approved.'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a part request."""
        part_request = self.get_object()
        
        if request.user.role not in [Role.OWNER, Role.MANAGER]:
            return Response(
                {'error': 'Only owners and managers can reject part requests.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'error': 'Rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        part_request.status = 'REJECTED'
        part_request.rejection_reason = reason
        part_request.save()
        
        return Response({'message': 'Part request rejected.'})


class JobEnumsView(viewsets.ViewSet):
    """ViewSet for job-related enums."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
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


class PickupRequestViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for Pickup & Drop requests.
    Manages the lifecycle of pickup requests from customer calls.
    """
    serializer_class = PickupRequestSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
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

    @action(detail=True, methods=['post'])
    def assign_technician(self, request, pk=None):
        """Assign a technician for pickup."""
        pickup = self.get_object()
        technician_id = request.data.get('technician_id')

        if not technician_id:
            return Response(
                {'error': 'technician_id is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            technician = User.objects.get(
                pk=technician_id, role=Role.TECHNICIAN, is_active=True
            )
        except User.DoesNotExist:
            return Response(
                {'error': 'Technician not found or inactive.'},
                status=status.HTTP_404_NOT_FOUND
            )

        pickup.assigned_technician = technician
        if pickup.status == PickupRequestStatus.REQUESTED:
            pickup.status = PickupRequestStatus.ASSIGNED
        pickup.save()

        serializer = self.get_serializer(pickup)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
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
            return Response(
                {
                    'error': f'Cannot transition from {pickup.get_status_display()} '
                             f'to {PickupRequestStatus(new_status).label}. '
                             f'Allowed: {", ".join(allowed_labels)}'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        pickup.status = new_status
        if notes:
            pickup.notes = (pickup.notes + '\n' + notes).strip() if pickup.notes else notes
        pickup.save()

        return Response(PickupRequestSerializer(pickup).data)

    @action(detail=True, methods=['post'])
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
            return Response(
                {'error': 'Pickup must be at center before creating a job card.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if pickup.job:
            return Response(
                {'error': 'A job card already exists for this pickup.',
                 'job_id': str(pickup.job.id),
                 'job_number': pickup.job.job_number},
                status=status.HTTP_400_BAD_REQUEST
            )

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
            return Response({'error': 'No technician assigned yet.'}, status=status.HTTP_400_BAD_REQUEST)
        
        technician = pickup.assigned_technician
        return Response({
            'latitude': technician.last_latitude,
            'longitude': technician.last_longitude,
            'updated_at': technician.last_location_updated,
        })


from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

class PublicTrackingView(APIView):
    """
    Public View for tracking job card status without authentication.
    Requires Job Number and Phone Number for security.
    """
    permission_classes = [AllowAny]
    
    def get(self, request, job_number):
        phone = request.query_params.get('phone')
        
        if not phone:
            return Response({'error': 'Phone number is required for verification.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # We strip non-digits to compare or rely on the mobile field
            job = JobCard.objects.get(job_number=job_number, customer__mobile__endswith=phone[-10:])
        except JobCard.DoesNotExist:
            return Response({'error': 'No matching job found with this Number and Phone combination.'}, status=status.HTTP_404_NOT_FOUND)
            
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
            'timeline': timeline,
            'photos': photos
        })
