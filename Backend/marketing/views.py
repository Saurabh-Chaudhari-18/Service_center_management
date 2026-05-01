"""
Marketing ViewSets.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.db import models
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal

from marketing.models import (
    ReminderConfig, ServiceReminder,
    ReviewConfig, ReviewRequest,
    CustomerLedgerEntry
)
from marketing.serializers import (
    ReminderConfigSerializer, ServiceReminderSerializer,
    ReviewConfigSerializer, ReviewRequestSerializer,
    CustomerLedgerEntrySerializer, CustomerLedgerCreateSerializer
)
from core.permissions import (
    IsBranchMember, BranchScopedMixin, IsOwnerOrManager
)


class ReminderConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for reminder configuration."""
    serializer_class = ReminderConfigSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    queryset = ReminderConfig.objects.all()

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return self.queryset.none()
        return self.queryset.filter(
            branch__in=user.get_accessible_branches()
        )


class ServiceReminderViewSet(BranchScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for service reminders."""
    serializer_class = ServiceReminderSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'reminder_type']
    ordering = ['scheduled_date']
    branch_field = 'branch'
    queryset = ServiceReminder.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        return queryset.select_related('customer', 'job')

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending reminders due today or overdue."""
        today = timezone.now().date()
        queryset = self.get_queryset().filter(
            scheduled_date__lte=today,
            status='PENDING'
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        """Mark a reminder as sent."""
        reminder = self.get_object()
        reminder.status = 'SENT'
        reminder.sent_at = timezone.now()
        reminder.save()
        return Response({'message': 'Reminder marked as sent.'})


class ReviewConfigViewSet(viewsets.ModelViewSet):
    """ViewSet for review configuration."""
    serializer_class = ReviewConfigSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    queryset = ReviewConfig.objects.all()

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return self.queryset.none()
        return self.queryset.filter(
            branch__in=user.get_accessible_branches()
        )


class ReviewRequestViewSet(BranchScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for review requests."""
    serializer_class = ReviewRequestSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status']
    ordering = ['-scheduled_at']
    branch_field = 'branch'
    queryset = ReviewRequest.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        return queryset.select_related('customer', 'job')


class CustomerLedgerViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for customer ledger (Khata) management.
    """
    serializer_class = CustomerLedgerEntrySerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['customer', 'entry_type', 'reference_type']
    ordering = ['-entry_date', '-created_at']
    branch_field = 'branch'
    queryset = CustomerLedgerEntry.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset
        return queryset.select_related('customer', 'created_by')

    def get_serializer_class(self):
        if self.action == 'create':
            return CustomerLedgerCreateSerializer
        return CustomerLedgerEntrySerializer

    def perform_create(self, serializer):
        """Create ledger entry and calculate running balance."""
        customer = serializer.validated_data['customer']
        entry_type = serializer.validated_data['entry_type']
        amount = serializer.validated_data['amount']

        # Get current balance
        last_entry = CustomerLedgerEntry.objects.filter(
            customer=customer
        ).order_by('-entry_date', '-created_at').first()

        current_balance = last_entry.running_balance if last_entry else Decimal('0.00')

        if entry_type == 'CREDIT':
            new_balance = current_balance + amount
        else:
            new_balance = current_balance - amount

        branch_id = self.request.data.get('branch') or self.request.headers.get('X-Branch-ID')
        from core.models import Branch
        branch = None
        if branch_id:
            try:
                branch = Branch.objects.get(pk=branch_id)
            except Branch.DoesNotExist:
                pass

        serializer.save(
            created_by=self.request.user,
            running_balance=new_balance,
            branch=branch
        )

    @action(detail=False, methods=['get'])
    def customer_statement(self, request):
        """Get complete ledger statement for a customer."""
        customer_id = request.query_params.get('customer')
        if not customer_id:
            return Response(
                {'error': 'customer parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        entries = self.get_queryset().filter(
            customer_id=customer_id
        ).order_by('entry_date', 'created_at')

        # Calculate balance
        total_credit = entries.filter(
            entry_type='CREDIT'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        total_debit = entries.filter(
            entry_type='DEBIT'
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        balance = total_credit - total_debit

        serializer = CustomerLedgerEntrySerializer(entries, many=True)

        return Response({
            'entries': serializer.data,
            'total_credit': total_credit,
            'total_debit': total_debit,
            'balance': balance,
            'balance_label': 'Customer owes' if balance > 0 else 'Refund due'
        })

    @action(detail=False, methods=['get'])
    def outstanding(self, request):
        """Get all customers with outstanding balance."""
        from customers.models import Customer
        from django.db.models import Subquery, OuterRef

        # Get latest running_balance for each customer
        latest_entries = CustomerLedgerEntry.objects.filter(
            customer=OuterRef('pk')
        ).order_by('-entry_date', '-created_at').values('running_balance')[:1]

        queryset = self.get_queryset()
        customer_ids = queryset.values_list('customer', flat=True).distinct()

        customers = Customer.objects.filter(
            id__in=customer_ids
        ).annotate(
            balance=Subquery(latest_entries)
        ).filter(
            balance__gt=0
        ).order_by('-balance')

        data = [
            {
                'id': str(c.id),
                'name': c.get_full_name(),
                'mobile': c.mobile,
                'balance': c.balance
            }
            for c in customers if c.balance
        ]

        return Response(data)
