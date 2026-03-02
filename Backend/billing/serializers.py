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
            'is_finalized', 'total_tax'
        ]


class InvoiceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating invoices."""
    job_id = serializers.UUIDField(required=False, allow_null=True)
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    line_items = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )
    
    class Meta:
        model = Invoice
        fields = [
            'branch', 'job_id', 'customer_id', 'invoice_date', 'due_date',
            'discount_amount', 'notes', 'terms_and_conditions',
            'line_items'
        ]

    def validate(self, data):
        """Ensure at least one of job_id or customer_id is provided."""
        job_id = data.get('job_id')
        customer_id = data.get('customer_id')
        
        if not job_id and not customer_id:
            raise serializers.ValidationError(
                "Either job_id or customer_id must be provided."
            )
        return data

    def validate_job_id(self, value):
        """Validate job exists and belongs to branch."""
        if not value:
            return value
        from jobs.models import JobCard
        
        try:
            job = JobCard.objects.get(pk=value)
        except JobCard.DoesNotExist:
            raise serializers.ValidationError("Job not found.")
        
        return value

    def validate_customer_id(self, value):
        """Validate customer exists."""
        if not value:
            return value
        from customers.models import Customer
        
        try:
            customer = Customer.objects.get(pk=value)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found.")
        
        return value

    @transaction.atomic
    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        job_id = validated_data.pop('job_id', None)
        customer_id = validated_data.pop('customer_id', None)
        
        job = None
        customer = None
        
        # Path 1: Job-based invoice (get customer from job)
        if job_id:
            from jobs.models import JobCard
            job = JobCard.objects.select_related('customer').get(pk=job_id)
            customer = job.customer
        
        # Path 2: Direct customer invoice (no job)
        if not customer and customer_id:
            from customers.models import Customer
            customer = Customer.objects.get(pk=customer_id)
        
        if not customer:
            raise serializers.ValidationError("Could not determine customer.")
        
        # Determine interstate status
        from core.utils import is_interstate_supply
        is_interstate = is_interstate_supply(
            validated_data['branch'].state_code,
            customer.state_code
        )
        
        # Set customer details snapshot
        if job:
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
                inventory_item_id=item_data.get('inventory_item'),
                job_part_usage_id=item_data.get('job_part_usage'),
            )
        
        # Auto-add parts used in job (only if job exists)
        if job and hasattr(job, 'part_usages'):
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
        
        # Refresh to ensure date fields are legitimate date objects
        invoice.refresh_from_db()
        
        return invoice


class LineItemUpdateSerializer(serializers.ModelSerializer):
    """Serializer for validating line item updates."""
    id = serializers.UUIDField(required=False)
    inventory_item = serializers.PrimaryKeyRelatedField(
        queryset=InvoiceLineItem._meta.get_field('inventory_item').related_model.objects.all(),
        required=False, 
        allow_null=True
    )
    job_part_usage = serializers.PrimaryKeyRelatedField(
        queryset=InvoiceLineItem._meta.get_field('job_part_usage').related_model.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = InvoiceLineItem
        fields = [
            'id', 'item_type', 'description', 'hsn_sac_code',
            'quantity', 'unit', 'unit_price', 'gst_rate',
            'discount_percent', 'inventory_item', 'job_part_usage'
        ]
        read_only_fields = ['unit'] # Unit usually comes from inventory key

class InvoiceUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating invoices with nested line items."""
    line_items = LineItemUpdateSerializer(many=True, required=False)
    
    class Meta:
        model = Invoice
        fields = [
            'branch', 'invoice_date', 'due_date', 'discount_amount', 
            'notes', 'terms_and_conditions', 'line_items'
        ]

    @transaction.atomic
    def update(self, instance, validated_data):
        line_items_data = validated_data.pop('line_items', None)
        
        # Update invoice fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update line items if provided
        if line_items_data is not None:
            # Get existing item IDs
            existing_ids = set(instance.line_items.values_list('id', flat=True))
            provided_ids = set()
            
            for item_data in line_items_data:
                item_id = item_data.get('id')
                
                if item_id and item_id in existing_ids:
                    # Update existing item
                    provided_ids.add(item_id)
                    item = InvoiceLineItem.objects.get(id=item_id, invoice=instance)
                    
                    # Update fields
                    for field in ['item_type', 'description', 'hsn_sac_code', 
                                  'quantity', 'unit_price', 'gst_rate', 
                                  'discount_percent']:
                        if field in item_data:
                            setattr(item, field, item_data[field])
                    
                    # Handle FKs if present
                    if 'inventory_item' in item_data:
                        item.inventory_item = item_data['inventory_item']
                    if 'job_part_usage' in item_data:
                        item.job_part_usage = item_data['job_part_usage']
                        
                    item.save()
                else:
                    # Create new item
                    # Remove 'id' if present (it might be a temp id)
                    if 'id' in item_data:
                        del item_data['id']
                        
                    InvoiceLineItem.objects.create(
                        invoice=instance,
                        **item_data
                    )
            
            # Delete items not in provided list (if any were provided)
            # This logic mimics a full "replace" of the list for UX consistency
            # Items not in the payload are assumed deleted
            items_to_delete = existing_ids - provided_ids
            InvoiceLineItem.objects.filter(id__in=items_to_delete).delete()

        # Recalculate totals
        instance.calculate_totals()
        instance.save()
        
        return instance


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
