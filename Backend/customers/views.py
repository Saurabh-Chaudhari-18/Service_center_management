"""
Customer ViewSets with branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from customers.models import Customer, CustomerDocument
from customers.serializers import (
    CustomerSerializer, CustomerCreateSerializer,
    CustomerMinimalSerializer, CustomerDocumentSerializer,
    CustomerServiceHistorySerializer
)
from core.permissions import IsBranchMember, CanManageCustomers, BranchScopedMixin


class CustomerViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for Customer management.
    Customers are branch-scoped - each branch has its own customer records.
    Same mobile number can exist across different branches.
    """
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageCustomers]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'city', 'state']
    search_fields = ['mobile', 'first_name', 'last_name', 'email', 'company_name']
    ordering_fields = ['first_name', 'last_name', 'created_at']
    ordering = ['-created_at']
    branch_field = 'branch'
    queryset = Customer.objects.all()

    def get_queryset(self):
        """Filter customers by accessible branches."""
        queryset = super().get_queryset()
        user = self.request.user
        
        if not user.is_authenticated:
            return queryset
            
        return queryset.select_related('branch')

    def get_serializer_class(self):
        if self.action == 'create':
            return CustomerCreateSerializer
        if self.action == 'list':
            return CustomerMinimalSerializer
        return CustomerSerializer

    @action(detail=False, methods=['get'], url_path='search-by-mobile')
    def search_by_mobile(self, request):
        """
        Search customer by mobile number or name.
        This is the primary customer lookup method.
        """
        mobile = request.query_params.get('mobile', '')
        branch_id = request.query_params.get('branch')
        
        if not mobile:
            raise ValidationError('mobile parameter is required')
        
        from django.db.models import Q
        
        # Check if query looks like a phone number or a name
        is_numeric = mobile.replace('+', '').replace(' ', '').isdigit()
        
        if is_numeric:
            # Normalize mobile number
            normalized = ''.join(c for c in mobile if c.isdigit() or c == '+')
            if not normalized.startswith('+') and len(normalized) == 10:
                normalized = '+91' + normalized
            
            queryset = self.get_queryset().filter(mobile__contains=normalized[-10:])
        else:
            # Search by name (first_name or last_name)
            queryset = self.get_queryset().filter(
                Q(first_name__icontains=mobile) | Q(last_name__icontains=mobile)
            )
        
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        
        serializer = CustomerSerializer(queryset[:20], many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='service-history')
    def service_history(self, request, pk=None):
        """Get service history for a customer."""
        customer = self.get_object()
        
        # Get all job cards for this customer
        from jobs.serializers import JobCardListSerializer
        jobs = customer.get_service_history()
        
        # Paginate results
        page = self.paginate_queryset(jobs)
        if page is not None:
            serializer = JobCardListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = JobCardListSerializer(jobs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='pending-jobs')
    def pending_jobs(self, request, pk=None):
        """Get pending jobs for a customer."""
        customer = self.get_object()
        
        from jobs.serializers import JobCardListSerializer
        jobs = customer.get_pending_jobs()
        serializer = JobCardListSerializer(jobs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def invoices(self, request, pk=None):
        """Get all invoices for a customer."""
        customer = self.get_object()
        
        from billing.models import Invoice
        from billing.serializers import InvoiceListSerializer
        
        invoices = Invoice.objects.filter(
            job__customer=customer
        ).order_by('-created_at')
        
        serializer = InvoiceListSerializer(invoices, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_document(self, request, pk=None):
        """Add a document to customer record."""
        customer = self.get_object()
        
        serializer = CustomerDocumentSerializer(data={
            **request.data,
            'customer': customer.pk
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def documents(self, request, pk=None):
        """Get all documents for a customer."""
        customer = self.get_object()
        documents = customer.documents.all()
        serializer = CustomerDocumentSerializer(documents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def merge(self, request, pk=None):
        """
        Merge another customer's records into this customer.
        Only for Owners and Managers.
        """
        from core.models import Role
        
        if request.user.role not in [Role.OWNER, Role.MANAGER]:
            raise PermissionDenied('Only owners and managers can merge customers')
        
        target_customer = self.get_object()
        source_id = request.data.get('source_customer_id')
        
        if not source_id:
            raise ValidationError('source_customer_id is required')
        
        try:
            source_customer = Customer.objects.get(
                pk=source_id,
                branch=target_customer.branch
            )
        except Customer.DoesNotExist:
            raise NotFound('Source customer not found')
        
        # Transfer all job cards
        from jobs.models import JobCard
        JobCard.objects.filter(customer=source_customer).update(customer=target_customer)
        
        # Transfer documents
        CustomerDocument.objects.filter(customer=source_customer).update(customer=target_customer)
        
        # Deactivate source customer
        source_customer.is_active = False
        source_customer.save()
        
        # Log this action
        from audit.services import AuditLogService
        AuditLogService.log(
            user=request.user,
            action='CUSTOMER_MERGE',
            model_name='Customer',
            object_id=str(target_customer.pk),
            details={
                'merged_from': str(source_customer.pk),
                'source_name': source_customer.get_full_name(),
            }
        )
        
        return Response({
            'message': f'Customer {source_customer.get_full_name()} merged into {target_customer.get_full_name()}'
        })

    @action(detail=True, methods=['post'], url_path='request-deletion')
    def request_deletion(self, request, pk=None):
        """
        Anonymise a customer's PII (GDPR/data-retention compliance).
        Blocked if the customer has any open (non-terminal) jobs.
        """
        from jobs.models import JobStatus
        customer = self.get_object()

        open_jobs = customer.job_cards.exclude(
            status__in=[
                JobStatus.DELIVERED,
                JobStatus.CANCELLED,
                JobStatus.REJECTED,
            ]
        )
        if open_jobs.exists():
            return Response(
                {'error': 'Customer has open jobs. Close all jobs before requesting deletion.'},
                status=status.HTTP_409_CONFLICT
            )

        from customers.services import anonymise_customer

        anonymise_customer(customer)

        return Response({'message': 'Customer data anonymised successfully.'})


class CustomerDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for customer documents."""
    serializer_class = CustomerDocumentSerializer
    permission_classes = [IsAuthenticated, CanManageCustomers]

    def get_queryset(self):
        return CustomerDocument.objects.filter(
            customer__branch__in=self.request.user.get_accessible_branches()
        )
