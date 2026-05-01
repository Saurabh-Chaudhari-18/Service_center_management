"""
Expense serializers.
"""

from rest_framework import serializers
from expenses.models import Expense, ExpenseCategory


class ExpenseSerializer(serializers.ModelSerializer):
    """Full expense serializer."""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )

    class Meta:
        model = Expense
        fields = [
            'id', 'branch', 'category', 'category_display',
            'title', 'description', 'amount', 'expense_date',
            'payment_method', 'payment_method_display', 'reference',
            'receipt', 'is_recurring', 'vendor_name',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class ExpenseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listings."""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_display', 'title',
            'amount', 'expense_date', 'vendor_name', 'is_recurring'
        ]


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating expenses."""

    class Meta:
        model = Expense
        fields = [
            'branch', 'category', 'title', 'description',
            'amount', 'expense_date', 'payment_method',
            'reference', 'receipt', 'is_recurring', 'vendor_name'
        ]


class ExpenseCategorySerializer(serializers.Serializer):
    """Serializer for expense category options."""
    value = serializers.CharField()
    label = serializers.CharField()
