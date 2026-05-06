"""
Expense serializers — updated with ITC fields.
"""

from decimal import Decimal
from rest_framework import serializers
from expenses.models import Expense, ExpenseCategory


class ExpenseSerializer(serializers.ModelSerializer):
    """Full expense serializer — includes ITC fields."""
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
            # ITC fields
            'is_itc_eligible', 'vendor_gstin', 'vendor_invoice_number',
            'gst_rate', 'taxable_amount', 'cgst_amount', 'sgst_amount',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        """Auto-calculate cgst/sgst when ITC is eligible."""
        if attrs.get('is_itc_eligible'):
            taxable = attrs.get('taxable_amount', Decimal('0'))
            rate = attrs.get('gst_rate', Decimal('0'))
            half_tax = (taxable * rate / 100 / 2).quantize(Decimal('0.01'))
            attrs['cgst_amount'] = half_tax
            attrs['sgst_amount'] = half_tax
        else:
            # Clear ITC fields if not eligible
            attrs['cgst_amount'] = Decimal('0')
            attrs['sgst_amount'] = Decimal('0')
            attrs['taxable_amount'] = Decimal('0')
            attrs['gst_rate'] = Decimal('0')
        return attrs


class ExpenseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listings."""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )

    class Meta:
        model = Expense
        fields = [
            'id', 'category', 'category_display', 'title',
            'amount', 'expense_date', 'vendor_name', 'is_recurring',
            'is_itc_eligible', 'cgst_amount', 'sgst_amount',
        ]


class ExpenseCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating expenses — includes ITC fields."""

    class Meta:
        model = Expense
        fields = [
            'branch', 'category', 'title', 'description',
            'amount', 'expense_date', 'payment_method',
            'reference', 'receipt', 'is_recurring', 'vendor_name',
            # ITC fields
            'is_itc_eligible', 'vendor_gstin', 'vendor_invoice_number',
            'gst_rate', 'taxable_amount', 'cgst_amount', 'sgst_amount',
        ]

    def validate(self, attrs):
        """Auto-calculate cgst/sgst when ITC is eligible."""
        if attrs.get('is_itc_eligible'):
            taxable = attrs.get('taxable_amount', Decimal('0'))
            rate = attrs.get('gst_rate', Decimal('0'))
            half_tax = (taxable * rate / 100 / 2).quantize(Decimal('0.01'))
            attrs['cgst_amount'] = half_tax
            attrs['sgst_amount'] = half_tax
        else:
            attrs['cgst_amount'] = Decimal('0')
            attrs['sgst_amount'] = Decimal('0')
            attrs['taxable_amount'] = Decimal('0')
            attrs['gst_rate'] = Decimal('0')
        return attrs


class ExpenseCategorySerializer(serializers.Serializer):
    """Serializer for expense category options."""
    value = serializers.CharField()
    label = serializers.CharField()
