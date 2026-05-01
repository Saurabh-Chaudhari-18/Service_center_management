"""
Enquiry ViewSets with branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models
from django.db.models import Count
from django.utils import timezone

from enquiries.models import Enquiry, EnquiryNote, LeadSource, EnquiryStatus
from enquiries.serializers import (
    EnquirySerializer, EnquiryListSerializer,
    EnquiryCreateSerializer, EnquiryNoteSerializer
)
from core.permissions import IsBranchMember, BranchScopedMixin


class EnquiryViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for enquiry/lead management.
    
    Features:
    - Branch-scoped access
    - Status-based filtering
    - Follow-up tracking
    - Conversion to job card
    - Lead analytics
    """
    serializer_class = EnquirySerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'source', 'assigned_to']
    search_fields = ['customer_name', 'customer_mobile', 'problem_description', 'brand']
    ordering_fields = ['created_at', 'follow_up_date', 'quoted_price']
    ordering = ['-created_at']
    branch_field = 'branch'
    queryset = Enquiry.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset

        queryset = queryset.select_related(
            'branch', 'customer', 'assigned_to', 'created_by', 'converted_job'
        )

        # Filter for today's follow-ups
        today_followups = self.request.query_params.get('today_followups')
        if today_followups and today_followups.lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(
                follow_up_date=timezone.now().date(),
                status__in=[EnquiryStatus.NEW, EnquiryStatus.CONTACTED, 
                           EnquiryStatus.FOLLOW_UP, EnquiryStatus.INTERESTED]
            )

        # Overdue follow-ups
        overdue = self.request.query_params.get('overdue')
        if overdue and overdue.lower() in ['true', '1', 'yes']:
            queryset = queryset.filter(
                follow_up_date__lt=timezone.now().date(),
                status__in=[EnquiryStatus.NEW, EnquiryStatus.CONTACTED,
                           EnquiryStatus.FOLLOW_UP, EnquiryStatus.INTERESTED]
            )

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return EnquiryCreateSerializer
        if self.action == 'list':
            return EnquiryListSerializer
        return EnquirySerializer

    def perform_create(self, serializer):
        """Set created_by and handle branch."""
        branch_id = self.request.data.get('branch') or self.request.headers.get('X-Branch-ID')
        
        if branch_id and str(branch_id).lower() != 'universal':
            from core.models import Branch
            try:
                branch = Branch.objects.get(pk=branch_id)
                serializer.save(created_by=self.request.user, branch=branch)
            except Branch.DoesNotExist:
                serializer.save(created_by=self.request.user)
        else:
            serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        """Add an interaction note to an enquiry."""
        enquiry = self.get_object()
        note_text = request.data.get('note', '')
        
        if not note_text:
            return Response(
                {'error': 'note is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        note = EnquiryNote.objects.create(
            enquiry=enquiry,
            note=note_text,
            created_by=request.user
        )
        
        return Response(
            EnquiryNoteSerializer(note).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def convert_to_job(self, request, pk=None):
        """
        Convert an enquiry to a Job Card.
        Creates a customer (if needed) and a job card.
        """
        enquiry = self.get_object()

        if enquiry.status == EnquiryStatus.CONVERTED:
            return Response(
                {'error': 'This enquiry is already converted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from customers.models import Customer
        from jobs.models import JobCard

        # Find or create customer
        customer = enquiry.customer
        if not customer:
            # Try to find by mobile
            customer = Customer.objects.filter(
                branch=enquiry.branch,
                mobile__endswith=enquiry.customer_mobile[-10:]
            ).first()

            if not customer:
                name_parts = enquiry.customer_name.split(' ', 1)
                customer = Customer.objects.create(
                    branch=enquiry.branch,
                    first_name=name_parts[0],
                    last_name=name_parts[1] if len(name_parts) > 1 else '',
                    mobile=enquiry.customer_mobile,
                    email=enquiry.customer_email
                )

        # Create job card
        from jobs.models import JobCard
        job = JobCard.objects.create(
            branch=enquiry.branch,
            customer=customer,
            device_type=enquiry.device_type or 'LAPTOP',
            brand=enquiry.brand,
            model=enquiry.model_name,
            customer_complaint=enquiry.problem_description,
            estimated_cost=enquiry.quoted_price,
            received_by=request.user
        )

        # Update enquiry status
        enquiry.status = EnquiryStatus.CONVERTED
        enquiry.converted_job = job
        enquiry.customer = customer
        enquiry.save()

        return Response({
            'message': f'Enquiry converted to Job #{job.job_number}',
            'job_id': str(job.id),
            'job_number': job.job_number,
            'customer_id': str(customer.id)
        })

    @action(detail=True, methods=['post'])
    def mark_lost(self, request, pk=None):
        """Mark an enquiry as lost/declined."""
        enquiry = self.get_object()
        loss_reason = request.data.get('loss_reason', 'OTHER')

        enquiry.status = EnquiryStatus.LOST
        enquiry.loss_reason = loss_reason
        enquiry.save()

        return Response({'message': 'Enquiry marked as lost.'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get enquiry/lead statistics."""
        queryset = self.get_queryset()

        # Date range
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        by_status = queryset.values('status').annotate(
            count=Count('id')
        ).order_by('status')

        by_source = queryset.values('source').annotate(
            count=Count('id')
        ).order_by('-count')

        total = queryset.count()
        converted = queryset.filter(status=EnquiryStatus.CONVERTED).count()
        conversion_rate = (converted / total * 100) if total > 0 else 0

        today = timezone.now().date()
        today_followups = queryset.filter(
            follow_up_date=today,
            status__in=[EnquiryStatus.NEW, EnquiryStatus.CONTACTED,
                       EnquiryStatus.FOLLOW_UP, EnquiryStatus.INTERESTED]
        ).count()

        overdue = queryset.filter(
            follow_up_date__lt=today,
            status__in=[EnquiryStatus.NEW, EnquiryStatus.CONTACTED,
                       EnquiryStatus.FOLLOW_UP, EnquiryStatus.INTERESTED]
        ).count()

        # Source labels
        source_map = dict(LeadSource.choices)
        status_map = dict(EnquiryStatus.choices)

        return Response({
            'total': total,
            'converted': converted,
            'conversion_rate': round(conversion_rate, 1),
            'today_followups': today_followups,
            'overdue_followups': overdue,
            'by_status': [
                {**item, 'status_display': status_map.get(item['status'], item['status'])}
                for item in by_status
            ],
            'by_source': [
                {**item, 'source_display': source_map.get(item['source'], item['source'])}
                for item in by_source
            ]
        })

    @action(detail=False, methods=['get'])
    def sources(self, request):
        """Get all lead source options."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in LeadSource.choices
        ])

    @action(detail=False, methods=['get'])
    def statuses(self, request):
        """Get all enquiry status options."""
        return Response([
            {'value': c[0], 'label': c[1]}
            for c in EnquiryStatus.choices
        ])
