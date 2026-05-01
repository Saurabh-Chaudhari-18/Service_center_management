"""
Expense ViewSets with branch-scoped access.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db import models
from django.db.models import Sum
from decimal import Decimal

from expenses.models import Expense, ExpenseCategory
from expenses.serializers import (
    ExpenseSerializer, ExpenseListSerializer,
    ExpenseCreateSerializer
)
from core.permissions import (
    IsBranchMember, BranchScopedMixin, IsOwnerOrManager
)


class ExpenseViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """
    ViewSet for expense management.
    
    Features:
    - Branch-scoped access
    - Category-based filtering
    - Monthly/daily stats
    """
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'is_recurring', 'expense_date']
    search_fields = ['title', 'description', 'vendor_name']
    ordering_fields = ['expense_date', 'amount', 'created_at']
    ordering = ['-expense_date', '-created_at']
    branch_field = 'branch'
    queryset = Expense.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset

        queryset = queryset.select_related('branch', 'created_by')

        # Date range filters
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(expense_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(expense_date__lte=date_to)

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return ExpenseCreateSerializer
        if self.action == 'list':
            return ExpenseListSerializer
        return ExpenseSerializer

    def perform_create(self, serializer):
        """Set the created_by field and handle branch assignment."""
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

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get expense statistics for accessible branches."""
        queryset = self.get_queryset()

        # Date range filter
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            queryset = queryset.filter(expense_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(expense_date__lte=date_to)

        # Overall stats
        total = queryset.aggregate(
            total_amount=Sum('amount'),
            expense_count=models.Count('id')
        )
        total['total_amount'] = total['total_amount'] or Decimal('0')
        total['expense_count'] = total['expense_count'] or 0

        # By category breakdown
        by_category = queryset.values('category').annotate(
            total=Sum('amount'),
            count=models.Count('id')
        ).order_by('-total')

        # Format category display names
        category_map = dict(ExpenseCategory.choices)
        category_breakdown = [
            {
                'category': item['category'],
                'category_display': category_map.get(item['category'], item['category']),
                'total': item['total'],
                'count': item['count']
            }
            for item in by_category
        ]

        return Response({
            'total_amount': total['total_amount'],
            'expense_count': total['expense_count'],
            'by_category': category_breakdown
        })

    @action(detail=False, methods=['get'])
    def categories(self, request):
        """Get all expense category options."""
        categories = [
            {'value': choice[0], 'label': choice[1]}
            for choice in ExpenseCategory.choices
        ]
        return Response(categories)
