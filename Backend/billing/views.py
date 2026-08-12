"""
Billing ViewSets for invoices, payments, and credit notes.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models
from django.http import HttpResponse
from decimal import Decimal
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from billing.models import (
    Invoice, InvoiceLineItem, Payment, CreditNote,
    InvoiceStatus, PaymentMethod, InvoiceEditHistory, InvoiceEditType
)
from billing.serializers import (
    InvoiceSerializer, InvoiceListSerializer, InvoiceCreateSerializer,
    InvoiceLineItemSerializer, AddLineItemSerializer,
    PaymentSerializer, RecordPaymentSerializer,
    CreditNoteSerializer, InvoiceStatsSerializer,
    InvoiceUpdateSerializer, InvoiceEditHistorySerializer
)
from core.permissions import (
    IsBranchMember, CanManageBilling, BranchScopedMixin,
    IsOwnerOrManager, CanManageFinance
)
from core.models import Role
from core.serializers import KeyValueSerializer
from core.exceptions import ProtectedResourceError


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
    filterset_fields = ['status', 'is_finalized', 'is_interstate', 'invoice_date']
    search_fields = ['invoice_number', 'customer_name', 'customer_mobile', 'job__job_number']
    ordering_fields = ['invoice_date', 'created_at', 'total_amount']
    ordering = ['-invoice_date', '-created_at']
    branch_field = 'branch'
    queryset = Invoice.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        
        queryset = queryset.select_related(
            'branch', 'job', 'created_by', 'finalized_by'
        ).prefetch_related('line_items', 'payments')

        # Date range filters
        date_from = self.request.query_params.get('invoice_date_after')
        date_to = self.request.query_params.get('invoice_date_before')
        if date_from:
            queryset = queryset.filter(invoice_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(invoice_date__lte=date_to)

        # Customer name filter
        customer_name = self.request.query_params.get('customer_name')
        if customer_name:
            queryset = queryset.filter(customer_name__icontains=customer_name)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return InvoiceCreateSerializer
        if self.action == 'list':
            return InvoiceListSerializer
        if self.action in ['update', 'partial_update']:
            return InvoiceUpdateSerializer
        return InvoiceSerializer

    def perform_destroy(self, instance):
        # GST records have a statutory retention period; deletion is never permitted.
        raise ProtectedResourceError(
            "Invoices cannot be deleted during the statutory GST retention period. "
            "Cancel the invoice instead."
        )

    @action(detail=True, methods=['post'])
    def finalize(self, request, pk=None):
        """Finalize an invoice, making it immutable."""
        invoice = self.get_object()
        
        if invoice.is_finalized:
            raise ValidationError('Invoice is already finalized.')

        try:
            invoice.finalize(request.user)
            return Response({
                'message': 'Invoice finalized successfully.',
                'invoice_number': invoice.invoice_number,
                'total_amount': str(invoice.total_amount)
            })
        except Exception as e:
            raise ValidationError(str(e)) from e

    @action(detail=True, methods=['post'], url_path='add-line-item')
    def add_line_item(self, request, pk=None):
        """Add a line item to an invoice."""
        invoice = self.get_object()

        if invoice.is_finalized:
            raise ValidationError('Cannot modify a finalized invoice.')

        serializer = AddLineItemSerializer(
            data=request.data,
            context={'request': request, 'invoice': invoice},
        )
        serializer.is_valid(raise_exception=True)

        line_item = InvoiceLineItem.objects.create(
            invoice=invoice,
            **serializer.validated_data
        )

        invoice.calculate_totals()
        invoice.save()

        # Log edit history
        InvoiceEditHistory.objects.create(
            invoice=invoice,
            edited_by=request.user,
            edit_type=InvoiceEditType.LINE_ITEM_ADDED,
            summary=f'Added: {line_item.description} (\u20b9{line_item.amount})',
            new_values={
                'description': line_item.description,
                'amount': str(line_item.amount),
                'quantity': line_item.quantity,
            }
        )

        return Response(
            InvoiceLineItemSerializer(line_item).data,
            status=status.HTTP_201_CREATED
        )

    @extend_schema(parameters=[
        OpenApiParameter('item_id', OpenApiTypes.UUID, OpenApiParameter.PATH)
    ])
    @action(detail=True, methods=['delete'], url_path='line-items/(?P<item_id>[^/.]+)')
    def remove_line_item(self, request, pk=None, item_id=None):
        """Remove a line item from an invoice."""
        invoice = self.get_object()
        
        try:
            line_item = invoice.line_items.get(pk=item_id)
            desc = line_item.description
            amount = str(line_item.amount)
            # Restore stock if direct sale
            if line_item.inventory_item and not line_item.job_part_usage:
                line_item.inventory_item.add_stock(
                    quantity=line_item.quantity,
                    reason=f"Line item removed from Invoice {invoice.invoice_number}",
                    user=request.user
                )

            line_item.delete()
            invoice.calculate_totals()
            invoice.save()
            
            # Log edit history
            InvoiceEditHistory.objects.create(
                invoice=invoice,
                edited_by=request.user,
                edit_type=InvoiceEditType.LINE_ITEM_REMOVED,
                summary=f'Removed: {desc} (\u20b9{amount})',
                old_values={'description': desc, 'amount': amount}
            )
            
            return Response({'message': 'Line item removed.'})
        except InvoiceLineItem.DoesNotExist:
            raise NotFound('Line item not found.')

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        """Record a payment against this invoice."""
        invoice = self.get_object()
        
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
            raise ValidationError(str(e)) from e

    @action(detail=True, methods=['get'])
    def payments(self, request, pk=None):
        """Get all payments for this invoice."""
        invoice = self.get_object()
        payments = invoice.payments.all()
        serializer = PaymentSerializer(payments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='edit-history')
    def edit_history(self, request, pk=None):
        """Get the edit history for this invoice."""
        invoice = self.get_object()
        history = invoice.edit_history.select_related('edited_by').all()
        serializer = InvoiceEditHistorySerializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        """Generate and download invoice PDF."""
        invoice = self.get_object()
        
        # Generate PDF using the service
        from billing.services import InvoiceService
        pdf_content = InvoiceService.generate_invoice_pdf(invoice)
        
        response = HttpResponse(pdf_content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{invoice.invoice_number}.pdf"'
        return response

    @action(detail=True, methods=['post'], url_path='log-download')
    def log_download(self, request, pk=None):
        """Log that the invoice was downloaded/printed."""
        invoice = self.get_object()
        InvoiceEditHistory.objects.create(
            invoice=invoice,
            edited_by=request.user,
            edit_type=InvoiceEditType.DOWNLOADED,
            summary='Invoice PDF downloaded/printed',
            old_values=None,
            new_values=None,
        )
        return Response({'message': 'Download logged successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[IsOwnerOrManager])
    def cancel(self, request, pk=None):
        """Cancel an invoice."""
        invoice = self.get_object()
        
        if invoice.paid_amount > Decimal('0'):
            raise ValidationError('Cannot cancel invoice with payments. Create a credit note instead.')

        reason = request.data.get('reason', '')
        if not reason:
            raise ValidationError('Cancellation reason is required.')
        
        # Restore stock for all direct sale line items
        for item in invoice.line_items.all():
            if item.inventory_item and not item.job_part_usage:
                item.inventory_item.add_stock(
                    quantity=item.quantity,
                    reason=f"Invoice {invoice.invoice_number} cancelled",
                    user=request.user
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
        queryset = self.get_queryset().exclude(status=InvoiceStatus.CANCELLED)
        
        # Date range filter
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        
        if from_date:
            queryset = queryset.filter(invoice_date__gte=from_date)
        if to_date:
            queryset = queryset.filter(invoice_date__lte=to_date)
        
        # Calculate stats with keys fetching frontend expectations
        stats = queryset.aggregate(
            invoice_count=models.Count('id'),
            total_invoiced=models.Sum('total_amount'),
            total_paid=models.Sum('paid_amount'),
        )
        
        # Handle None values and calculate pending
        stats['total_invoiced'] = stats['total_invoiced'] or Decimal('0')
        stats['total_paid'] = stats['total_paid'] or Decimal('0')
        stats['invoice_count'] = stats['invoice_count'] or 0
        stats['total_pending'] = stats['total_invoiced'] - stats['total_paid']
        
        return Response(stats)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending invoices."""
        queryset = self.get_queryset().filter(
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
        
        queryset = Payment.objects.select_related('invoice', 'received_by')
        
        branch_id = self.request.query_params.get('branch') or self.request.headers.get('X-Branch-ID')
        
        if branch_id:
            from core.models import Branch
            try:
                requested_branch = Branch.objects.get(pk=branch_id)
                if user.has_branch_access(requested_branch):
                    queryset = queryset.filter(invoice__branch_id=branch_id)
                else:
                    return Payment.objects.none()
            except Branch.DoesNotExist:
                return Payment.objects.none()
        else:
            queryset = queryset.filter(
                invoice__branch__in=user.get_accessible_branches()
            )
            
        return queryset


class CreditNoteViewSet(viewsets.ModelViewSet):
    """ViewSet for credit notes."""
    serializer_class = CreditNoteSerializer
    permission_classes = [IsAuthenticated, CanManageFinance]
    http_method_names = ['get', 'post', 'head', 'options']
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
        from audit.services import AuditLogService
        AuditLogService.log_create(self.request.user, serializer.instance, request=self.request)

    @action(detail=False, methods=['get'], url_path='eligible-invoices')
    def eligible_invoices(self, request):
        invoices = Invoice.objects.filter(
            branch__in=request.user.get_accessible_branches(),
            is_finalized=True,
        ).exclude(status=InvoiceStatus.CANCELLED).order_by('-invoice_date')[:200]
        return Response([{
            'id': str(invoice.id),
            'invoice_number': invoice.invoice_number,
            'customer_name': invoice.customer_name,
            'total_amount': invoice.total_amount,
            'balance_due': invoice.balance_due,
        } for invoice in invoices if invoice.balance_due > 0])

    @action(detail=True, methods=['get'], url_path='download-pdf')
    def download_pdf(self, request, pk=None):
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        from io import BytesIO

        note = self.get_object()
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        lines = [
            note.branch.name, 'CREDIT NOTE', note.credit_note_number,
            f'Against invoice: {note.invoice.invoice_number}',
            f'Customer: {note.invoice.customer_name}',
            f'Reason: {note.reason}', f'Credit before tax: {note.amount}',
            f'CGST: {note.cgst_amount}', f'SGST: {note.sgst_amount}',
            f'IGST: {note.igst_amount}', f'Total credit: {note.total_amount}',
        ]
        y = 800
        for line in lines:
            pdf.drawString(60, y, str(line))
            y -= 28
        pdf.save()
        buffer.seek(0)
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{note.credit_note_number}.pdf"'
        return response


class PaymentMethodsView(APIView):
    """APIView for payment method options."""
    permission_classes = [IsAuthenticated]
    serializer_class = KeyValueSerializer

    def get(self, request):
        """Get all payment methods."""
        methods = [{'value': pm.value, 'label': pm.label} for pm in PaymentMethod]
        return Response(methods)
