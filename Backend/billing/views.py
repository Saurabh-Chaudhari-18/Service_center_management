"""
Billing ViewSets for invoices, payments, and credit notes.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models
from django.http import HttpResponse
from decimal import Decimal

from billing.models import (
    Invoice, InvoiceLineItem, Payment, CreditNote,
    InvoiceStatus, PaymentMethod
)
from billing.serializers import (
    InvoiceSerializer, InvoiceListSerializer, InvoiceCreateSerializer,
    InvoiceLineItemSerializer, AddLineItemSerializer,
    PaymentSerializer, RecordPaymentSerializer,
    CreditNoteSerializer, InvoiceStatsSerializer
)
from core.permissions import (
    IsBranchMember, CanManageBilling, BranchScopedMixin,
    IsOwnerOrManager
)
from core.models import Role


class InvoiceViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for invoice management.
    
    Features:
    - GST-compliant invoicing
    - Branch-scoped access
    - Payment tracking
    - PDF generation
    """
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsBranchMember, CanManageBilling]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'is_finalized', 'is_interstate']
    search_fields = ['invoice_number', 'customer_name', 'customer_mobile', 'job__job_number']
    ordering_fields = ['invoice_date', 'created_at', 'total_amount']
    ordering = ['-invoice_date', '-created_at']
    branch_field = 'branch'

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Invoice.objects.none()
        
        queryset = Invoice.objects.select_related(
            'branch', 'job', 'created_by', 'finalized_by'
        ).prefetch_related('line_items', 'payments').filter(
            branch__in=user.get_accessible_branches()
        )
        
        # Filter by branch if specified
        branch_id = self.request.query_params.get('branch')
        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        if self.action == 'list':
            return InvoiceListSerializer
        return InvoiceSerializer

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """Finalize an invoice, making it immutable."""
        invoice = self.get_object()
        
        if invoice.is_finalized:
            return Response(
                {'error': 'Invoice is already finalized.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            invoice.finalize(request.user)
            return Response({
                'message': 'Invoice finalized successfully.',
                'invoice_number': invoice.invoice_number,
                'total_amount': str(invoice.total_amount)
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def add_line_item(self, request, pk=None):
        """Add a line item to a draft invoice."""
        invoice = self.get_object()
        
        if invoice.is_finalized:
            return Response(
                {'error': 'Cannot modify a finalized invoice.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = AddLineItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        line_item = InvoiceLineItem.objects.create(
            invoice=invoice,
            **serializer.validated_data
        )
        
        return Response(
            InvoiceLineItemSerializer(line_item).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'], url_path='line-items/(?P<item_id>[^/.]+)')
    def remove_line_item(self, request, pk=None, item_id=None):
        """Remove a line item from a draft invoice."""
        invoice = self.get_object()
        
        if invoice.is_finalized:
            return Response(
                {'error': 'Cannot modify a finalized invoice.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            line_item = invoice.line_items.get(pk=item_id)
            line_item.delete()
            invoice.calculate_totals()
            invoice.save()
            return Response({'message': 'Line item removed.'})
        except InvoiceLineItem.DoesNotExist:
            return Response(
                {'error': 'Line item not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=['post'])
    def record_payment(self, request, pk=None):
        """Record a payment against this invoice."""
        invoice = self.get_object()
        
        if not invoice.is_finalized:
            return Response(
                {'error': 'Finalize invoice before recording payments.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = RecordPaymentSerializer(
            data=request.data,
            context={'invoice': invoice}
        )
        serializer.is_valid(raise_exception=True)
        
        try:
            payment = invoice.record_payment(
                amount=serializer.validated_data['amount'],
                payment_method=serializer.validated_data['payment_method'],
                user=request.user,
                reference=serializer.validated_data.get('reference', ''),
                notes=serializer.validated_data.get('notes', '')
            )
            
            return Response({
                'message': 'Payment recorded successfully.',
                'payment': PaymentSerializer(payment).data,
                'balance_due': str(invoice.balance_due),
                'status': invoice.status
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Get all payments for this invoice."""
        invoice = self.get_object()
        payments = invoice.payments.all()
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def download_pdf(self, request, pk=None):
        """Generate and download invoice PDF."""
        invoice = self.get_object()
        
        # Generate PDF using the service
        from billing.services import InvoiceService
        pdf_content = InvoiceService.generate_invoice_pdf(invoice)
        
        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrManager])
    def cancel(self, request, pk=None):
        """Cancel an invoice."""
        invoice = self.get_object()
        
        if invoice.paid_amount > Decimal('0'):
            return Response(
                {'error': 'Cannot cancel invoice with payments. Create a credit note instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'error': 'Cancellation reason is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        invoice.status = InvoiceStatus.CANCELLED
        invoice.notes = f"{invoice.notes}\n\nCANCELLED: {reason}"
        invoice.save()
        
        # Log to audit
        from audit.services import AuditLogService
        AuditLogService.log(
            user=request.user,
            action='INVOICE_CANCELLED',
            model_name='Invoice',
            object_id=str(invoice.pk),
            details={
                'invoice_number': invoice.invoice_number,
                'reason': reason,
            }
        )
        
        return Response({'message': 'Invoice cancelled.'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get invoice statistics for accessible branches."""
        queryset = self.get_queryset().filter(is_finalized=True)
        
        # Date range filter
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        
        if from_date:
            queryset = queryset.filter(invoice_date__gte=from_date)
        if to_date:
            queryset = queryset.filter(invoice_date__lte=to_date)
        
        stats = queryset.aggregate(
            total_invoices=models.Count('id'),
            total_revenue=models.Sum('total_amount'),
            total_collected=models.Sum('paid_amount'),
        )
        
        stats['total_revenue'] = stats['total_revenue'] or Decimal('0')
        stats['total_collected'] = stats['total_collected'] or Decimal('0')
        stats['total_outstanding'] = stats['total_revenue'] - stats['total_collected']
        
        stats['pending_count'] = queryset.filter(status=InvoiceStatus.PENDING).count()
        stats['partial_count'] = queryset.filter(status=InvoiceStatus.PARTIAL).count()
        
        return Response(stats)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending invoices."""
        queryset = self.get_queryset().filter(
            is_finalized=True,
            status__in=[InvoiceStatus.PENDING, InvoiceStatus.PARTIAL]
        )
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = InvoiceListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        
        serializer = InvoiceListSerializer(queryset, many=True)
        return Response(serializer.data)


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for payments."""
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, CanManageBilling]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['payment_method', 'is_verified']
    ordering = ['-payment_date']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Payment.objects.none()
        
        return Payment.objects.filter(
            invoice__branch__in=user.get_accessible_branches()
        ).select_related('invoice', 'received_by')


class CreditNoteViewSet(viewsets.ModelViewSet):
    """ViewSet for credit notes."""
    serializer_class = CreditNoteSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return CreditNote.objects.none()
        
        return CreditNote.objects.filter(
            branch__in=user.get_accessible_branches()
        ).select_related('invoice', 'created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PaymentMethodsView(viewsets.ViewSet):
    """ViewSet for payment method options."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def list_methods(self, request):
        """Get all payment methods."""
        methods = [{'value': pm.value, 'label': pm.label} for pm in PaymentMethod]
        return Response(methods)
