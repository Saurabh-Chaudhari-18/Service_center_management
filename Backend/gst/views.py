"""
GST Module Views — Dashboard, ITC, Output, GSTR-1 JSON, GSTR-3B, Payments, HSN
Intrastate only: CGST + SGST (no IGST).
"""

import json
from decimal import Decimal
from datetime import date
from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.permissions import IsAuthenticated

from core.permissions import CanViewReports, get_scoped_branches
from core.models import Branch
from .models import HSNCode, GSTPayment, GSTReturnStatus
from .serializers import HSNCodeSerializer, GSTPaymentSerializer, GSTReturnStatusSerializer


def get_date_range(request):
    from_date = request.query_params.get('from_date')
    to_date = request.query_params.get('to_date')
    if not from_date:
        today = timezone.now().date()
        from_date = date(today.year, today.month, 1)
    if not to_date:
        to_date = timezone.now().date()
    return from_date, to_date


def get_branches(request):
    return get_scoped_branches(request)


class GSTViewSet(viewsets.ViewSet):
    queryset = GSTPayment.objects.none()
    serializer_class = GSTPaymentSerializer
    permission_classes = [IsAuthenticated, CanViewReports]

    # ─── Dashboard ────────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        from billing.models import Invoice, InvoiceStatus
        from expenses.models import Expense
        from inventory.models import Purchase

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)

        # Output GST (from finalized invoices)
        invoices = Invoice.objects.filter(
            branch__in=branches,
            is_finalized=True,
            invoice_date__gte=from_date,
            invoice_date__lte=to_date,
        ).exclude(status=InvoiceStatus.CANCELLED)

        output = invoices.aggregate(
            taxable=Sum('subtotal'),
            cgst=Sum('cgst_total'),
            sgst=Sum('sgst_total'),
            invoice_count=Count('id'),
        )

        # ITC from purchases
        purchases = Purchase.objects.filter(
            branch__in=branches,
            purchase_date__gte=from_date,
            purchase_date__lte=to_date,
        )
        itc_purchases = purchases.aggregate(
            cgst=Sum('cgst_amount'),
            sgst=Sum('sgst_amount'),
        )

        # ITC from eligible expenses
        expenses = Expense.objects.filter(
            branch__in=branches,
            is_itc_eligible=True,
            expense_date__gte=from_date,
            expense_date__lte=to_date,
        )
        itc_expenses = expenses.aggregate(
            cgst=Sum('cgst_amount'),
            sgst=Sum('sgst_amount'),
        )

        out_cgst = Decimal(str(output['cgst'] or 0))
        out_sgst = Decimal(str(output['sgst'] or 0))
        itc_cgst = Decimal(str(itc_purchases['cgst'] or 0)) + Decimal(str(itc_expenses['cgst'] or 0))
        itc_sgst = Decimal(str(itc_purchases['sgst'] or 0)) + Decimal(str(itc_expenses['sgst'] or 0))

        net_cgst = out_cgst - itc_cgst
        net_sgst = out_sgst - itc_sgst

        # Filing status for current period
        period_month = date(timezone.now().date().year, timezone.now().date().month, 1)
        filing_status = GSTReturnStatus.objects.filter(
            branch__in=branches, period_month=period_month
        ).first()

        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'output': {
                'taxable': float(output['taxable'] or 0),
                'cgst': float(out_cgst),
                'sgst': float(out_sgst),
                'total': float(out_cgst + out_sgst),
                'invoice_count': output['invoice_count'] or 0,
            },
            'itc': {
                'purchases_cgst': float(itc_purchases['cgst'] or 0),
                'purchases_sgst': float(itc_purchases['sgst'] or 0),
                'expenses_cgst': float(itc_expenses['cgst'] or 0),
                'expenses_sgst': float(itc_expenses['sgst'] or 0),
                'total_cgst': float(itc_cgst),
                'total_sgst': float(itc_sgst),
                'total': float(itc_cgst + itc_sgst),
            },
            'net_payable': {
                'cgst': float(max(net_cgst, Decimal('0'))),
                'sgst': float(max(net_sgst, Decimal('0'))),
                'total': float(max(net_cgst, Decimal('0')) + max(net_sgst, Decimal('0'))),
            },
            'filing_status': {
                'gstr1_filed': filing_status.gstr1_filed if filing_status else False,
                'gstr3b_filed': filing_status.gstr3b_filed if filing_status else False,
            },
        })

    # ─── ITC Register ─────────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='itc-register')
    def itc_register(self, request):
        from expenses.models import Expense
        from inventory.models import Purchase

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)
        source = request.query_params.get('source', 'all')

        entries = []

        if source in ('all', 'purchases'):
            purchases = Purchase.objects.filter(
                branch__in=branches,
                purchase_date__gte=from_date,
                purchase_date__lte=to_date,
            ).order_by('-purchase_date')
            for p in purchases:
                entries.append({
                    'id': str(p.id),
                    'date': str(p.purchase_date),
                    'source': 'PURCHASE',
                    'vendor': p.vendor_name,
                    'vendor_gstin': p.vendor_gstin,
                    'invoice_number': p.invoice_number,
                    'taxable_amount': float(p.taxable_amount),
                    'cgst': float(p.cgst_amount),
                    'sgst': float(p.sgst_amount),
                    'total_itc': float(p.cgst_amount + p.sgst_amount),
                })

        if source in ('all', 'expenses'):
            expenses = Expense.objects.filter(
                branch__in=branches,
                is_itc_eligible=True,
                expense_date__gte=from_date,
                expense_date__lte=to_date,
            ).order_by('-expense_date')
            for e in expenses:
                entries.append({
                    'id': str(e.id),
                    'date': str(e.expense_date),
                    'source': 'EXPENSE',
                    'vendor': e.vendor_name,
                    'vendor_gstin': e.vendor_gstin,
                    'invoice_number': e.vendor_invoice_number,
                    'taxable_amount': float(e.taxable_amount),
                    'cgst': float(e.cgst_amount),
                    'sgst': float(e.sgst_amount),
                    'total_itc': float(e.cgst_amount + e.sgst_amount),
                })

        entries.sort(key=lambda x: x['date'], reverse=True)
        total_cgst = sum(e['cgst'] for e in entries)
        total_sgst = sum(e['sgst'] for e in entries)

        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'entries': entries,
            'totals': {
                'cgst': total_cgst,
                'sgst': total_sgst,
                'total_itc': total_cgst + total_sgst,
            },
        })

    # ─── Output Register ──────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='output-register')
    def output_register(self, request):
        from billing.models import Invoice, InvoiceStatus

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)

        invoices = Invoice.objects.filter(
            branch__in=branches,
            is_finalized=True,
            invoice_date__gte=from_date,
            invoice_date__lte=to_date,
        ).exclude(status=InvoiceStatus.CANCELLED).select_related('branch')

        data = []
        for inv in invoices:
            inv_type = 'B2B' if inv.customer_gstin else 'B2CS'
            data.append({
                'id': str(inv.id),
                'invoice_number': inv.invoice_number,
                'date': str(inv.invoice_date),
                'customer_name': inv.customer_name,
                'customer_gstin': inv.customer_gstin or '',
                'invoice_type': inv_type,
                'taxable': float(inv.subtotal),
                'cgst': float(inv.cgst_total),
                'sgst': float(inv.sgst_total),
                'total': float(inv.total_amount),
            })

        totals = invoices.aggregate(
            taxable=Sum('subtotal'), cgst=Sum('cgst_total'),
            sgst=Sum('sgst_total'), total=Sum('total_amount'),
        )
        return Response({
            'from_date': str(from_date), 'to_date': str(to_date),
            'invoices': data,
            'totals': {k: float(v or 0) for k, v in totals.items()},
        })

    # ─── GSTR-1 Data + JSON Export ────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='gstr1-data')
    def gstr1_data(self, request):
        from billing.models import Invoice, InvoiceStatus, InvoiceLineItem

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)

        invoices = Invoice.objects.filter(
            branch__in=branches, is_finalized=True,
            invoice_date__gte=from_date, invoice_date__lte=to_date,
        ).exclude(status=InvoiceStatus.CANCELLED).prefetch_related('line_items')

        b2b_list, b2cs_list = [], []
        b2cs_by_rate = {}

        for inv in invoices:
            if inv.customer_gstin:
                items = []
                for li in inv.line_items.all():
                    items.append({
                        'description': li.description,
                        'hsn_sac': li.hsn_sac_code,
                        'rate': float(li.gst_rate),
                        'taxable': float(li.amount),
                        'cgst': float(li.cgst_amount),
                        'sgst': float(li.sgst_amount),
                    })
                b2b_list.append({
                    'invoice_number': inv.invoice_number,
                    'date': str(inv.invoice_date),
                    'customer_name': inv.customer_name,
                    'customer_gstin': inv.customer_gstin,
                    'taxable': float(inv.subtotal),
                    'cgst': float(inv.cgst_total),
                    'sgst': float(inv.sgst_total),
                    'total': float(inv.total_amount),
                    'items': items,
                })
            else:
                # Aggregate B2CS by GST rate
                for li in inv.line_items.all():
                    rate = float(li.gst_rate)
                    if rate not in b2cs_by_rate:
                        b2cs_by_rate[rate] = {'rate': rate, 'taxable': 0, 'cgst': 0, 'sgst': 0}
                    b2cs_by_rate[rate]['taxable'] += float(li.amount)
                    b2cs_by_rate[rate]['cgst'] += float(li.cgst_amount)
                    b2cs_by_rate[rate]['sgst'] += float(li.sgst_amount)

        b2cs_list = list(b2cs_by_rate.values())

        return Response({
            'from_date': str(from_date), 'to_date': str(to_date),
            'b2b': b2b_list,
            'b2cs': b2cs_list,
            'b2b_count': len(b2b_list),
        })

    @action(detail=False, methods=['get'], url_path='gstr1-json')
    def gstr1_json(self, request):
        """Download GSTR-1 in GST portal JSON format."""
        from django.http import HttpResponse
        from billing.models import Invoice, InvoiceStatus

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)

        # Get GSTIN from first branch
        branch = branches.first()
        gstin = getattr(branch, 'gstin', '') if branch else ''

        # Period in MMYYYY format
        if hasattr(from_date, 'strftime'):
            fp = from_date.strftime('%m%Y')
        else:
            from datetime import datetime
            fp = datetime.strptime(str(from_date), '%Y-%m-%d').strftime('%m%Y')

        invoices = Invoice.objects.filter(
            branch__in=branches, is_finalized=True,
            invoice_date__gte=from_date, invoice_date__lte=to_date,
        ).exclude(status=InvoiceStatus.CANCELLED).prefetch_related('line_items')

        b2b_entries = {}
        b2cs_by_rate = {}

        for inv in invoices:
            inv_date = inv.invoice_date.strftime('%d-%m-%Y') if inv.invoice_date else ''
            items = []
            for li in inv.line_items.all():
                items.append({
                    'num': 1,
                    'itm_det': {
                        'txval': round(float(li.amount), 2),
                        'rt': float(li.gst_rate),
                        'camt': round(float(li.cgst_amount), 2),
                        'samt': round(float(li.sgst_amount), 2),
                        'csamt': 0,
                    }
                })

            if inv.customer_gstin:
                ctin = inv.customer_gstin
                if ctin not in b2b_entries:
                    b2b_entries[ctin] = {'ctin': ctin, 'inv': []}
                b2b_entries[ctin]['inv'].append({
                    'inum': inv.invoice_number,
                    'idt': inv_date,
                    'val': round(float(inv.total_amount), 2),
                    'pos': '27',  # Maharashtra state code
                    'rchrg': 'N',
                    'inv_typ': 'R',
                    'itms': items,
                })
            else:
                for li in inv.line_items.all():
                    rate = float(li.gst_rate)
                    if rate not in b2cs_by_rate:
                        b2cs_by_rate[rate] = {
                            'sply_tp': 'INTRA', 'typ': 'OE',
                            'pos': '27', 'rt': rate,
                            'txval': 0, 'camt': 0, 'samt': 0, 'csamt': 0,
                        }
                    b2cs_by_rate[rate]['txval'] += round(float(li.amount), 2)
                    b2cs_by_rate[rate]['camt'] += round(float(li.cgst_amount), 2)
                    b2cs_by_rate[rate]['samt'] += round(float(li.sgst_amount), 2)

        gstr1_json = {
            'gstin': gstin,
            'fp': fp,
            'b2b': list(b2b_entries.values()),
            'b2cs': list(b2cs_by_rate.values()),
        }

        response = HttpResponse(
            json.dumps(gstr1_json, indent=2),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="GSTR1_{fp}.json"'
        return response

    # ─── GSTR-3B Summary ──────────────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='gstr3b-summary')
    def gstr3b_summary(self, request):
        from billing.models import Invoice, InvoiceStatus
        from expenses.models import Expense
        from inventory.models import Purchase

        branches = get_branches(request)
        from_date, to_date = get_date_range(request)

        invoices = Invoice.objects.filter(
            branch__in=branches, is_finalized=True,
            invoice_date__gte=from_date, invoice_date__lte=to_date,
        ).exclude(status=InvoiceStatus.CANCELLED)

        output = invoices.aggregate(
            taxable=Sum('subtotal'), cgst=Sum('cgst_total'), sgst=Sum('sgst_total'),
        )

        itc_p = Purchase.objects.filter(
            branch__in=branches, purchase_date__gte=from_date, purchase_date__lte=to_date,
        ).aggregate(cgst=Sum('cgst_amount'), sgst=Sum('sgst_amount'))

        itc_e = Expense.objects.filter(
            branch__in=branches, is_itc_eligible=True,
            expense_date__gte=from_date, expense_date__lte=to_date,
        ).aggregate(cgst=Sum('cgst_amount'), sgst=Sum('sgst_amount'))

        out_cgst = float(output['cgst'] or 0)
        out_sgst = float(output['sgst'] or 0)
        itc_cgst = float(itc_p['cgst'] or 0) + float(itc_e['cgst'] or 0)
        itc_sgst = float(itc_p['sgst'] or 0) + float(itc_e['sgst'] or 0)

        return Response({
            'from_date': str(from_date), 'to_date': str(to_date),
            'table_3_1': {
                'taxable_outward': float(output['taxable'] or 0),
                'cgst': out_cgst, 'sgst': out_sgst,
            },
            'table_4': {
                'itc_purchases_cgst': float(itc_p['cgst'] or 0),
                'itc_purchases_sgst': float(itc_p['sgst'] or 0),
                'itc_expenses_cgst': float(itc_e['cgst'] or 0),
                'itc_expenses_sgst': float(itc_e['sgst'] or 0),
                'total_cgst': itc_cgst, 'total_sgst': itc_sgst,
            },
            'net_payable': {
                'cgst': max(out_cgst - itc_cgst, 0),
                'sgst': max(out_sgst - itc_sgst, 0),
                'total': max(out_cgst - itc_cgst, 0) + max(out_sgst - itc_sgst, 0),
            },
        })

    # ─── GST Payments CRUD ────────────────────────────────────────────────────

    @action(detail=False, methods=['get', 'post'])
    def payments(self, request):
        if request.method == 'GET':
            branches = get_branches(request)
            payments = GSTPayment.objects.filter(branch__in=branches).select_related('created_by')
            serializer = GSTPaymentSerializer(payments, many=True)
            return Response(serializer.data)

        serializer = GSTPaymentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='delete-payment')
    def delete_payment(self, request, pk=None):
        try:
            payment = GSTPayment.objects.get(
                pk=pk, branch__in=request.user.get_accessible_branches()
            )
            payment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except GSTPayment.DoesNotExist:
            raise NotFound('Not found')

    # ─── HSN/SAC Master ───────────────────────────────────────────────────────

    @action(detail=False, methods=['get', 'post'], url_path='hsn-codes')
    def hsn_codes(self, request):
        if request.method == 'GET':
            qs = HSNCode.objects.filter(is_active=True)
            q = request.query_params.get('q')
            if q:
                qs = qs.filter(Q(code__icontains=q) | Q(description__icontains=q))
            serializer = HSNCodeSerializer(qs, many=True)
            return Response(serializer.data)

        serializer = HSNCodeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['put', 'delete'], url_path='hsn')
    def hsn_detail(self, request, pk=None):
        try:
            hsn = HSNCode.objects.get(pk=pk)
        except HSNCode.DoesNotExist:
            raise NotFound('Not found')

        if request.method == 'PUT':
            serializer = HSNCodeSerializer(hsn, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        hsn.is_active = False
        hsn.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ─── Return Filing Status ─────────────────────────────────────────────────

    @action(detail=False, methods=['post'], url_path='mark-filed')
    def mark_filed(self, request):
        """Mark GSTR-1 or GSTR-3B as filed for a period."""
        from django.utils import timezone as tz

        period = request.data.get('period_month')
        return_type = request.data.get('return_type')  # 'gstr1' or 'gstr3b'
        branches = get_branches(request)
        branch = branches.first()

        if not period or not return_type:
            raise ValidationError('period_month and return_type required')

        obj, _ = GSTReturnStatus.objects.get_or_create(
            branch=branch, period_month=period,
            defaults={'filed_by': request.user}
        )

        if return_type == 'gstr1':
            obj.gstr1_filed = True
            obj.gstr1_filed_at = tz.now()
        elif return_type == 'gstr3b':
            obj.gstr3b_filed = True
            obj.gstr3b_filed_at = tz.now()

        obj.filed_by = request.user
        obj.save()

        return Response(GSTReturnStatusSerializer(obj).data)
