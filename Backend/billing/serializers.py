"""
Billing serializers for invoices and payments.
"""

from rest_framework import serializers
from django.db import transaction
from billing.models import (
    Invoice, InvoiceLineItem, Payment, CreditNote,
    InvoiceStatus, PaymentMethod
)
from decimal import Decimal


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    """Serializer for invoice line items."""
    total_with_tax = serializers.SerializerMethodField()
    
    class Meta:
        model = InvoiceLineItem
        fields = [
            'id', 'invoice', 'item_type', 'description', 'hsn_sac_code',
            'quantity', 'unit', 'unit_price', 'amount',
            'gst_rate', 'cgst_rate', 'cgst_amount',
            'sgst_rate', 'sgst_amount', 'igst_rate', 'igst_amount',
            'discount_percent', 'inventory_item', 'job_part_usage',
            'total_with_tax', 'created_at'
        ]
        read_only_fields = [
            'id', 'amount', 'cgst_rate', 'cgst_amount',
            'sgst_rate', 'sgst_amount', 'igst_rate', 'igst_amount',
            'created_at'
        ]

    def get_total_with_tax(self, obj):
        return str(obj.amount + obj.cgst_amount + obj.sgst_amount + obj.igst_amount)


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payments."""
    payment_method_display = serializers.CharField(
        source='get_payment_method_display', read_only=True
    )
    received_by_name = serializers.CharField(
        source='received_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = Payment
        fields = [
            'id', 'invoice', 'amount', 'payment_method',
            'payment_method_display', 'payment_date',
            'reference', 'notes', 'received_by', 'received_by_name',
            'is_verified', 'created_at'
        ]
        read_only_fields = ['id', 'received_by', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    """Full invoice serializer."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    job_number = serializers.CharField(source='job.job_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_fully_paid = serializers.BooleanField(read_only=True)
    finalized_by_name = serializers.CharField(
        source='finalized_by.get_full_name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'branch', 'branch_name', 'invoice_number',
            'job', 'job_number',
            'customer_name', 'customer_mobile', 'customer_email',
            'customer_address', 'customer_gstin', 'customer_state_code',
            'invoice_date', 'due_date', 'is_interstate',
            'subtotal', 'cgst_total', 'sgst_total', 'igst_total',
            'discount_amount', 'total_tax', 'total_amount',
            'status', 'status_display', 'paid_amount', 'balance_due',
            'is_fully_paid', 'is_finalized', 'finalized_at', 'finalized_by_name',
            'notes', 'terms_and_conditions',
            'line_items', 'payments',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'invoice_number', 'subtotal', 'cgst_total', 'sgst_total',
            'igst_total', 'total_tax', 'total_amount', 'status',
            'paid_amount', 'is_finalized', 'finalized_at',
            'created_by', 'created_at', 'updated_at'
        ]


class InvoiceListSerializer(serializers.ModelSerializer):
    """Lightweight invoice serializer for listings."""
    job_number = serializers.CharField(source='job.job_number', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'job_number', 'customer_name',
            'customer_mobile', 'invoice_date', 'total_amount',
            'paid_amount', 'balance_due', 'status', 'status_display',
            'is_finalized'
        ]


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoices."""
    job_id = serializers.UUIDField()
    line_items = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Invoice
        fields = [
            'branch', 'job_id', 'invoice_date', 'due_date',
            'discount_amount', 'notes', 'terms_and_conditions',
            'line_items'
        ]

    def validate_job_id(self, value):
        """Validate job exists and belongs to branch."""
        from jobs.models import JobCard
        
        try:
            job = JobCard.objects.get(pk=value)
        except JobCard.DoesNotExist:
            raise serializers.ValidationError("Job not found.")
        
        return value

    @transaction.atomic
    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        job_id = validated_data.pop('job_id')
        
        from jobs.models import JobCard
        job = JobCard.objects.select_related('customer').get(pk=job_id)
        customer = job.customer
        
        # Determine interstate status
        from core.utils import is_interstate_supply
        is_interstate = is_interstate_supply(
            validated_data['branch'].state_code,
            customer.state_code
        )
        
        # Set customer details snapshot
        validated_data['job'] = job
        validated_data['customer_name'] = customer.get_full_name()
        validated_data['customer_mobile'] = customer.mobile
        validated_data['customer_email'] = customer.email
        validated_data['customer_address'] = (
            f"{customer.address_line1}, {customer.address_line2}, "
            f"{customer.city}, {customer.state} - {customer.pincode}"
        ).strip(', ')
        validated_data['customer_gstin'] = customer.gstin
        validated_data['customer_state_code'] = customer.state_code
        validated_data['is_interstate'] = is_interstate
        validated_data['created_by'] = self.context['request'].user
        
        # Create invoice
        invoice = Invoice.objects.create(**validated_data)
        
        # Create line items
        for item_data in line_items_data:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                item_type=item_data.get('item_type', 'SERVICE'),
                description=item_data.get('description', ''),
                hsn_sac_code=item_data.get('hsn_sac_code', ''),
                quantity=item_data.get('quantity', 1),
                unit=item_data.get('unit', 'NOS'),
                unit_price=Decimal(str(item_data.get('unit_price', 0))),
                gst_rate=Decimal(str(item_data.get('gst_rate', 18))),
                discount_percent=Decimal(str(item_data.get('discount_percent', 0))),
                inventory_item_id=item_data.get('inventory_item_id'),
                job_part_usage_id=item_data.get('job_part_usage_id'),
            )
        
        # Auto-add parts used in job
        for part_usage in job.part_usages.all():
            # Check if already added
            if not invoice.line_items.filter(job_part_usage=part_usage).exists():
                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    item_type='PART',
                    description=part_usage.inventory_item.name,
                    hsn_sac_code=part_usage.inventory_item.hsn_code,
                    quantity=part_usage.quantity,
                    unit=part_usage.inventory_item.unit,
                    unit_price=part_usage.unit_price,
                    gst_rate=part_usage.inventory_item.gst_rate,
                    inventory_item=part_usage.inventory_item,
                    job_part_usage=part_usage,
                )
        
        # Calculate totals
        invoice.calculate_totals()
        invoice.save()
        
        return invoice


class AddLineItemSerializer(serializers.ModelSerializer):
    """Serializer for adding line items to invoice."""
    
    class Meta:
        model = InvoiceLineItem
        fields = [
            'item_type', 'description', 'hsn_sac_code',
            'quantity', 'unit', 'unit_price', 'gst_rate',
            'discount_percent', 'inventory_item', 'job_part_usage'
        ]


class RecordPaymentSerializer(serializers.Serializer):
    """Serializer for recording a payment."""
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices)
    reference = serializers.CharField(required=False, allow_blank=True, max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        invoice = self.context.get('invoice')
        if invoice and value > invoice.balance_due:
            raise serializers.ValidationError(
                f"Payment amount exceeds balance due (₹{invoice.balance_due})."
            )
        return value


class CreditNoteSerializer(serializers.ModelSerializer):
    """Serializer for credit notes."""
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = CreditNote
        fields = [
            'id', 'branch', 'credit_note_number', 'invoice', 'invoice_number',
            'amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount',
            'reason', 'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = [
            'id', 'credit_note_number', 'cgst_amount', 'sgst_amount',
            'igst_amount', 'total_amount', 'created_by', 'created_at'
        ]


class InvoiceStatsSerializer(serializers.Serializer):
    """Serializer for invoice statistics."""
    total_invoices = serializers.IntegerField()
    total_revenue = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_outstanding = serializers.DecimalField(max_digits=14, decimal_places=2)
    total_collected = serializers.DecimalField(max_digits=14, decimal_places=2)
    pending_count = serializers.IntegerField()
    partial_count = serializers.IntegerField()
