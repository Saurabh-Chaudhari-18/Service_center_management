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
from django.utils import timezone

from jobs.models import (
    JobCard, JobStatus, JobStatusHistory, JobAccessory,
    JobPhoto, JobNote, PartRequest, DeviceType, AccessoryType, DiagnosisPart
)
from jobs.serializers import (
    JobCardSerializer, JobCardCreateSerializer, JobCardListSerializer,
    JobStatusUpdateSerializer, JobAssignTechnicianSerializer,
    JobDiagnosisSerializer, JobEstimateApprovalSerializer,
    JobDeliverySerializer, DevicePasswordAccessSerializer,
    JobAccessorySerializer, JobPhotoSerializer, JobNoteSerializer,
    PartRequestSerializer, AccessoryTypeSerializer, DeviceTypeSerializer,
    JobStatusHistorySerializer
)
from core.permissions import (
    IsBranchMember, CanManageJobs, IsTechnicianOrAbove,
    CanAccessDevicePasswords, CanOverrideStatus, BranchScopedMixin
)
from core.models import Role, User, Branch
from core.exceptions import JobReadOnlyError, InvalidStatusTransition


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

    def get_queryset(self):
        """Filter jobs based on user's role and branch access."""
        user = self.request.user
        
        if not user.is_authenticated:
            return JobCard.objects.none()
        
        queryset = JobCard.objects.select_related(
            'branch', 'customer', 'assigned_technician', 'received_by'
        ).prefetch_related('accessories', 'photos', 'notes', 'status_history')
        
        # Branch filtering
        accessible_branches = user.get_accessible_branches()
        queryset = queryset.filter(branch__in=accessible_branches)
        
        # Technicians only see their assigned jobs
        if user.role == Role.TECHNICIAN:
            queryset = queryset.filter(assigned_technician=user)
        
        # Apply branch filter from query params
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return JobCardCreateSerializer
        if self.action == 'list':
            return JobCardListSerializer
        return JobCardSerializer

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """
        Update job status with validation.
        Enforces sequential status transitions.
        """
        job = self.get_object()
        
        if job.is_terminal_status():
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
        
        if job.is_terminal_status():
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
        
        if job.is_terminal_status():
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
                        warranty_days=part.get('warranty_days', 0),
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
        
        if job.is_terminal_status():
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
        
        serializer = JobPhotoSerializer(data={
            **request.data,
            'job': str(job.id),
            'uploaded_by': str(request.user.id)
        })
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
        """Get jobs assigned to current user (for technicians)."""
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
        
        serializer = JobCardListSerializer(queryset, many=True)
        return Response(serializer.data)

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
