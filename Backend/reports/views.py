"""
Reports views for business analytics and exports.

Features:
- Branch-wise revenue reports
- Pending jobs analysis
- Technician productivity
- Inventory consumption
- Export to Excel/PDF
"""

from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from django.db import models
from django.db.models import Sum, Count, Avg, F, Q, ExpressionWrapper, DurationField
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import io

from core.permissions import CanViewReports, get_scoped_branches
from core.models import Branch


class ReportResponseSerializer(serializers.Serializer):
    """Named schema for dynamically assembled report responses."""


class ReportsViewSet(viewsets.ViewSet):
    serializer_class = ReportResponseSerializer
    """
    ViewSet for generating various reports.
    Only Owners, Managers, and Accountants can view reports.
    """
    permission_classes = [IsAuthenticated, CanViewReports]

    def get_accessible_branches(self):
        """Get branches accessible to current user."""
        return get_scoped_branches(self.request, self)

    def get_date_range(self):
        """Parse date range from query params."""
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        
        if not from_date:
            from_date = timezone.now().date() - timedelta(days=30)
        if not to_date:
            to_date = timezone.now().date()
        
        return from_date, to_date

    @action(detail=False, methods=['get'])
    def revenue(self, request):
        """
        Revenue report based on actual payments received.
        Filters by payment_date so "Today" shows payments collected today.
        """
        from billing.models import Payment, InvoiceStatus
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()
        
        # Query payments by payment_date (when money was actually collected)
        payments = Payment.objects.filter(
            invoice__branch__in=branches,
            invoice__is_finalized=True,
            payment_date__date__gte=from_date,
            payment_date__date__lte=to_date,
            is_verified=True,
        ).exclude(invoice__status=InvoiceStatus.CANCELLED)
        
        # Summary by branch
        branch_summary = payments.values(
            'invoice__branch', 'invoice__branch__name'
        ).annotate(
            total_collected=Sum('amount'),
            payment_count=Count('id'),
        ).order_by('invoice__branch__name')
        
        # Rename keys for frontend compatibility
        branch_list = []
        for b in branch_summary:
            branch_list.append({
                'branch': b['invoice__branch'],
                'branch__name': b['invoice__branch__name'],
                'total_revenue': b['total_collected'],
                'invoice_count': b['payment_count'],
            })
        
        # Daily breakdown by payment date
        daily_revenue = payments.annotate(
            date=TruncDate('payment_date')
        ).values('date').annotate(
            revenue=Sum('amount'),
            collected=Sum('amount'),
            count=Count('id')
        ).order_by('date')
        
        # Calculate totals
        totals = payments.aggregate(
            total_revenue=Sum('amount'),
            total_collected=Sum('amount'),
            total_invoices=Count('invoice', distinct=True),
        )
        # Fill None values with 0
        totals = {k: v or 0 for k, v in totals.items()}
        totals['total_outstanding'] = 0
        totals['total_tax'] = 0
        
        # Recent payments detail (for owner visibility)
        recent_payments = payments.select_related(
            'invoice', 'received_by'
        ).order_by('-payment_date')[:20]
        
        payments_detail = [
            {
                'id': str(p.id),
                'payment_date': p.payment_date.isoformat(),
                'amount': float(p.amount),
                'payment_method': p.payment_method,
                'reference': p.reference,
                'invoice_number': p.invoice.invoice_number,
                'received_by': p.received_by.get_full_name() or p.received_by.email,
                'notes': p.notes,
            }
            for p in recent_payments
        ]
        
        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'branches': branch_list,
            'daily_breakdown': list(daily_revenue),
            'totals': totals,
            'recent_payments': payments_detail,
        })

    @action(detail=False, methods=['get'], url_path='pending-jobs')
    def pending_jobs(self, request):
        """
        Pending jobs analysis.
        Shows jobs by status, days pending, and branch.
        """
        from jobs.models import JobCard, JobStatus
        
        branches = self.get_accessible_branches()
        
        # Get all non-completed jobs
        pending_jobs = JobCard.objects.filter(
            branch__in=branches
        ).exclude(
            status__in=[JobStatus.DELIVERED, JobStatus.CANCELLED, JobStatus.REJECTED]
        )
        
        # Summary by status
        status_summary = pending_jobs.values('status').annotate(
            count=Count('id')
        ).order_by('status')
        
        # Summary by branch
        branch_summary = pending_jobs.values('branch', 'branch__name').annotate(
            count=Count('id'),
            urgent_count=Count('id', filter=Q(is_urgent=True))
        ).order_by('branch__name')
        
        # Overdue analysis (jobs pending more than expected)
        overdue_jobs = pending_jobs.filter(
            estimated_completion_date__lt=timezone.now().date()
        ).annotate(
            days_overdue=F('estimated_completion_date') - timezone.now().date()
        )
        
        # Age analysis
        today = timezone.now().date()
        age_groups = {
            '0-3 days': pending_jobs.filter(
                created_at__date__gte=today - timedelta(days=3)
            ).count(),
            '4-7 days': pending_jobs.filter(
                created_at__date__lt=today - timedelta(days=3),
                created_at__date__gte=today - timedelta(days=7)
            ).count(),
            '8-14 days': pending_jobs.filter(
                created_at__date__lt=today - timedelta(days=7),
                created_at__date__gte=today - timedelta(days=14)
            ).count(),
            '15+ days': pending_jobs.filter(
                created_at__date__lt=today - timedelta(days=14)
            ).count(),
        }
        
        return Response({
            'total_pending': pending_jobs.count(),
            'urgent_count': pending_jobs.filter(is_urgent=True).count(),
            'overdue_count': overdue_jobs.count(),
            'by_status': list(status_summary),
            'by_branch': list(branch_summary),
            'by_age': age_groups,
        })

    @action(detail=False, methods=['get'], url_path='technician-productivity')
    def technician_productivity(self, request):
        """
        Technician productivity report.
        Shows jobs completed, average time, etc.
        """
        from jobs.models import JobCard, JobStatus
        from core.models import User, Role
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()
        
        # Aggregate all technician metrics in one query to avoid N+1 report queries.
        assigned_filter = Q(assigned_jobs__branch__in=branches)
        completed_filter = assigned_filter & Q(
            assigned_jobs__status=JobStatus.DELIVERED,
            assigned_jobs__delivery_date__date__gte=from_date,
            assigned_jobs__delivery_date__date__lte=to_date,
        )
        pending_filter = assigned_filter & ~Q(
            assigned_jobs__status__in=[
                JobStatus.DELIVERED, JobStatus.CANCELLED, JobStatus.REJECTED,
            ]
        )

        completion_duration = ExpressionWrapper(
            F('assigned_jobs__delivery_date') - F('assigned_jobs__created_at'),
            output_field=DurationField(),
        )
        technicians = User.objects.filter(
            role=Role.TECHNICIAN,
            branches__in=branches,
            is_active=True,
        ).distinct().annotate(
            assigned_jobs_count=Count('assigned_jobs', filter=assigned_filter, distinct=True),
            completed_jobs_count=Count('assigned_jobs', filter=completed_filter, distinct=True),
            pending_jobs_count=Count('assigned_jobs', filter=pending_filter, distinct=True),
            avg_completion_duration=Avg(completion_duration, filter=completed_filter),
        ).order_by('-completed_jobs_count', 'first_name', 'last_name')

        productivity_data = []
        for tech in technicians:
            avg_td = tech.avg_completion_duration
            avg_completion_days = round(avg_td.total_seconds() / 86400, 1) if avg_td else 0
            productivity_data.append({
                'technician_id': str(tech.id),
                'technician_name': tech.get_full_name(),
                'assigned_jobs': tech.assigned_jobs_count,
                'completed_jobs': tech.completed_jobs_count,
                'pending_jobs': tech.pending_jobs_count,
                'avg_completion_days': avg_completion_days,
            })

        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'technicians': productivity_data
        })

    @action(detail=False, methods=['get'], url_path='inventory-consumption')
    def inventory_consumption(self, request):
        """
        Inventory consumption report.
        Shows parts used over time period.
        """
        from inventory.models import JobPartUsage, InventoryItem
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()
        
        # Get usage data
        usage = JobPartUsage.objects.filter(
            job__branch__in=branches,
            created_at__date__gte=from_date,
            created_at__date__lte=to_date
        )
        
        # Summary by item
        item_summary = usage.values(
            'inventory_item', 'inventory_item__name', 'inventory_item__sku'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_value=Sum('total_price'),
            usage_count=Count('id')
        ).order_by('-total_quantity')[:20]  # Top 20 items
        
        # Summary by category
        category_summary = usage.values(
            'inventory_item__category', 'inventory_item__category__name'
        ).annotate(
            total_quantity=Sum('quantity'),
            total_value=Sum('total_price')
        ).order_by('-total_value')
        
        # Daily usage
        daily_usage = usage.annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            quantity=Sum('quantity'),
            value=Sum('total_price')
        ).order_by('date')
        
        # Totals
        totals = usage.aggregate(
            total_quantity=Sum('quantity'),
            total_value=Sum('total_price'),
            total_transactions=Count('id')
        )
        
        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'top_items': list(item_summary),
            'by_category': list(category_summary),
            'daily_usage': list(daily_usage),
            'totals': totals
        })

    @action(detail=False, methods=['get'], url_path='low-stock')
    def low_stock(self, request):
        """
        Low stock report.
        Shows items below threshold.
        """
        from inventory.models import InventoryItem
        
        branches = self.get_accessible_branches()
        
        low_stock_items = InventoryItem.objects.filter(
            branch__in=branches,
            is_active=True,
            quantity__lte=F('low_stock_threshold')
        ).select_related('branch', 'category').order_by('quantity')
        
        data = []
        for item in low_stock_items:
            data.append({
                'id': str(item.id),
                'name': item.name,
                'sku': item.sku,
                'branch': item.branch.name,
                'category': item.category.name if item.category else None,
                'quantity': item.quantity,
                'threshold': item.low_stock_threshold,
                'shortage': max(0, item.low_stock_threshold - item.quantity),
                'cost_price': str(item.cost_price),
            })
        
        return Response({
            'total_items': len(data),
            'items': data
        })

    @action(detail=False, methods=['get'], url_path='customer-analysis')
    def customer_analysis(self, request):
        """
        Customer analysis report.
        Shows top customers, repeat customers, etc.
        """
        from customers.models import Customer
        from billing.models import Invoice
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()
        
        # Customers with invoices in period
        customers_with_revenue = Invoice.objects.filter(
            branch__in=branches,
            is_finalized=True,
            invoice_date__gte=from_date,
            invoice_date__lte=to_date
        ).values('job__customer', 'job__customer__first_name', 'job__customer__last_name', 'job__customer__mobile').annotate(
            total_revenue=Sum('total_amount'),
            invoice_count=Count('id')
        ).order_by('-total_revenue')[:20]
        
        # New customers in period
        new_customers = Customer.objects.filter(
            branch__in=branches,
            created_at__date__gte=from_date,
            created_at__date__lte=to_date
        ).count()
        
        # Total customers
        total_customers = Customer.objects.filter(
            branch__in=branches,
            is_active=True
        ).count()
        
        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'total_customers': total_customers,
            'new_customers': new_customers,
            'top_customers': list(customers_with_revenue)
        })

    @action(detail=False, methods=['get'], url_path='gst-summary')
    def gst_summary(self, request):
        """
        GST summary report for filing.
        Shows CGST, SGST, IGST collected.
        """
        from billing.models import Invoice, InvoiceStatus
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()
        
        invoices = Invoice.objects.filter(
            branch__in=branches,
            is_finalized=True,
            invoice_date__gte=from_date,
            invoice_date__lte=to_date
        ).exclude(status=InvoiceStatus.CANCELLED)
        
        # GST totals
        gst_summary = invoices.aggregate(
            total_taxable=Sum('subtotal'),
            total_cgst=Sum('cgst_total'),
            total_sgst=Sum('sgst_total'),
            total_igst=Sum('igst_total'),
            total_tax=Sum('total_tax'),
            total_value=Sum('total_amount'),
            invoice_count=Count('id')
        )
        
        # By GST rate
        from billing.models import InvoiceLineItem
        rate_summary = InvoiceLineItem.objects.filter(
            invoice__in=invoices
        ).values('gst_rate').annotate(
            taxable_amount=Sum('amount'),
            cgst_amount=Sum('cgst_amount'),
            sgst_amount=Sum('sgst_amount'),
            igst_amount=Sum('igst_amount'),
        ).order_by('gst_rate')
        
        # Intrastate vs Interstate
        supply_type = invoices.values('is_interstate').annotate(
            count=Count('id'),
            total=Sum('total_amount')
        )
        
        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'summary': gst_summary,
            'by_rate': list(rate_summary),
            'by_supply_type': list(supply_type)
        })

    @action(detail=False, methods=['get'], url_path='export-excel')
    def export_excel(self, request):
        """
        Kick off an async Excel export. Returns a task_id immediately.
        Poll GET /api/reports/export_status/?task_id=<id> for the download URL.
        """
        report_type = request.query_params.get('report', 'revenue')
        from_date, to_date = self.get_date_range()
        branch_ids = [str(b.id) for b in self.get_accessible_branches()]

        from audit.services import AuditLogService
        AuditLogService.log_export(
            user=request.user,
            export_type='EXCEL',
            report_name=report_type,
            parameters=dict(request.query_params),
        )

        from reports.tasks import generate_excel_report
        task = generate_excel_report.delay(report_type, branch_ids, str(from_date), str(to_date))

        return Response({
            'task_id': task.id,
            'status': 'pending',
            'status_url': f'/api/reports/export_status/?task_id={task.id}',
        })

    @action(detail=False, methods=['get'], url_path='export-status')
    def export_status(self, request):
        """
        Poll the status of an async export task.
        Returns {status, download_url} when complete.
        """
        task_id = request.query_params.get('task_id')
        if not task_id:
            raise ValidationError('task_id is required')

        from celery.result import AsyncResult
        result = AsyncResult(task_id)

        if result.state == 'PENDING':
            return Response({'status': 'pending'})
        if result.state == 'STARTED' or result.state == 'RETRY':
            return Response({'status': 'processing'})
        if result.state == 'SUCCESS':
            return Response({'status': 'complete', 'download_url': result.get()})
        # FAILURE
        return Response(
            {'status': 'failed', 'error': str(result.result)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    @action(detail=False, methods=['get'], url_path='gstr1-export')
    def gstr1_export(self, request):
        """
        Kick off an async CA-ready GSTR-1 Excel export.
        Poll /api/reports/export_status/?task_id=<id> for the download URL.
        """
        from_date, to_date = self.get_date_range()
        branch_ids = [str(b.id) for b in self.get_accessible_branches()]

        from audit.services import AuditLogService
        AuditLogService.log_export(
            user=request.user,
            export_type='EXCEL',
            report_name='GSTR-1',
            parameters=dict(request.query_params),
        )

        from reports.tasks import generate_gstr1_report
        task = generate_gstr1_report.delay(branch_ids, str(from_date), str(to_date))

        return Response({
            'task_id': task.id,
            'status': 'pending',
            'status_url': f'/api/reports/export_status/?task_id={task.id}',
        })

    @action(detail=False, methods=['get'], url_path='net-profit')
    def net_profit(self, request):
        """
        Net Profit calculation: Revenue - Expenses.
        Used for the dashboard's financial overview.
        """
        from billing.models import Payment, InvoiceStatus
        from expenses.models import Expense
        
        branches = self.get_accessible_branches()
        from_date, to_date = self.get_date_range()

        # Revenue = Sum of verified payments
        revenue = Payment.objects.filter(
            invoice__branch__in=branches,
            invoice__is_finalized=True,
            payment_date__date__gte=from_date,
            payment_date__date__lte=to_date,
            is_verified=True
        ).exclude(
            invoice__status=InvoiceStatus.CANCELLED
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Expenses = Sum of expense amounts
        expenses_total = Expense.objects.filter(
            branch__in=branches,
            expense_date__gte=from_date,
            expense_date__lte=to_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        net_profit = revenue - expenses_total

        return Response({
            'from_date': str(from_date),
            'to_date': str(to_date),
            'revenue': revenue,
            'expenses': expenses_total,
            'net_profit': net_profit,
            'profit_margin': round(float(net_profit) / float(revenue) * 100, 1) if revenue > 0 else 0
        })

