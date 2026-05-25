"""
Billing serializers for invoices and payments.
"""

from rest_framework import serializers
from django.db import transaction
from billing.models import (
    Invoice, InvoiceLineItem, Payment, CreditNote,
    InvoiceStatus, PaymentMethod, InvoiceEditHistory, InvoiceEditType
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
    """Serializer for creating DRAFT invoices."""
    job_id = serializers.UUIDField(required=False, allow_null=True)
    customer_id = serializers.UUIDField(required=False, allow_null=True)
    line_items = AddLineItemSerializer(many=True, required=False)

    class Meta:
        model = Invoice
        fields = [
            'id', 'branch', 'invoice_number', 'status', 'is_finalized',
            'job_id', 'customer_id',
            'customer_name', 'customer_mobile', 'customer_email',
            'customer_address', 'customer_gstin', 'customer_state_code',
            'invoice_date', 'due_date', 'is_interstate',
            'discount_amount', 'notes', 'terms_and_conditions',
            'line_items',
            'created_at',
        ]
        read_only_fields = ['id', 'invoice_number', 'status', 'is_finalized', 'created_at']
        extra_kwargs = {
            'customer_name': {'required': False},
            'customer_mobile': {'required': False},
            'customer_address': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        job_id = data.get('job_id')
        customer_id = data.get('customer_id')
        customer_name = data.get('customer_name')

        if not job_id and not customer_id and not customer_name:
            raise serializers.ValidationError(
                "Provide job_id, customer_id, or customer_name to identify the customer."
            )
        return data

    def validate_job_id(self, value):
        if not value:
            return value
        from jobs.models import JobCard
        try:
            JobCard.objects.get(pk=value)
        except JobCard.DoesNotExist:
            raise serializers.ValidationError("Job not found.")
        return value

    def validate_customer_id(self, value):
        if not value:
            return value
        from customers.models import Customer
        try:
            Customer.objects.get(pk=value)
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        line_items_data = validated_data.pop('line_items', [])
        job_id = validated_data.pop('job_id', None)
        customer_id = validated_data.pop('customer_id', None)

        if job_id:
            from jobs.models import JobCard
            job = JobCard.objects.select_related('customer').get(pk=job_id)
            customer = job.customer
            validated_data.setdefault('customer_name', customer.get_full_name())
            validated_data.setdefault('customer_mobile', customer.mobile)
            validated_data.setdefault('customer_email', customer.email or '')
            validated_data.setdefault('customer_gstin', customer.gstin or '')
            validated_data.setdefault('customer_state_code', customer.state_code or '')
            validated_data.setdefault('customer_address', ', '.join(filter(None, [
                customer.address_line1, customer.city,
                customer.state, customer.pincode,
            ])))
            validated_data['job'] = job
        elif customer_id:
            from customers.models import Customer
            customer = Customer.objects.get(pk=customer_id)
            validated_data.setdefault('customer_name', customer.get_full_name())
            validated_data.setdefault('customer_mobile', customer.mobile)
            validated_data.setdefault('customer_email', customer.email or '')
            validated_data.setdefault('customer_gstin', customer.gstin or '')
            validated_data.setdefault('customer_state_code', customer.state_code or '')
            validated_data.setdefault('customer_address', ', '.join(filter(None, [
                customer.address_line1, customer.city,
                customer.state, customer.pincode,
            ])))

        validated_data.setdefault('customer_mobile', '')
        validated_data.setdefault('customer_address', '')
        request = self.context.get('request')
        validated_data['created_by'] = request.user if request else None

        invoice = Invoice.objects.create(**validated_data)

        added_details = []
        if line_items_data:
            for item_data in line_items_data:
                new_item = InvoiceLineItem.objects.create(
                    invoice=invoice,
                    **item_data
                )
                
                # Direct sales deduction for new item added during creation
                if new_item.inventory_item and not new_item.job_part_usage:
                    try:
                        new_item.inventory_item.deduct_stock(
                            quantity=new_item.quantity,
                            reason=f"Added to new Invoice {invoice.invoice_number}",
                            user=request.user if request else None
                        )
                    except Exception as e:
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError(f"Insufficient stock for {new_item.inventory_item.name}. {str(e)}")
                
                added_details.append(f"{new_item.description} (x{new_item.quantity})")

            # Calculate totals for the invoice based on added line items
            invoice.calculate_totals()
            invoice.save()

        summary = f'Invoice {invoice.invoice_number} created as draft.'
        if added_details:
            summary += f" Items: {', '.join(added_details)}"

        InvoiceEditHistory.objects.create(
            invoice=invoice,
            edited_by=request.user if request else None,
            edit_type=InvoiceEditType.CREATED,
            summary=summary,
            new_values={'status': invoice.status, 'total_amount': str(invoice.total_amount)},
        )

        # Refresh so DateField values are proper date objects (not datetime)
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
        
        request = self.context.get('request')
        changes = []
        
        if validated_data:
            field_names = ', '.join(validated_data.keys())
            changes.append(f'Fields updated: {field_names}')

        # Update line items if provided
        if line_items_data is not None:
            # Get existing items for comparison
            existing_items = {item.id: item for item in instance.line_items.all()}
            provided_ids = set()
            
            added_details = []
            updated_details = []
            removed_details = []
            
            for item_data in line_items_data:
                item_id = item_data.get('id')
                
                if item_id and item_id in existing_items:
                    # Update existing item
                    provided_ids.add(item_id)
                    item = existing_items[item_id]
                    
                    # Track pricing/quantity changes
                    old_price = item.unit_price
                    old_qty = item.quantity
                    
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
                    
                    if old_qty != item.quantity and item.inventory_item and not item.job_part_usage:
                        qty_diff = item.quantity - old_qty
                        try:
                            if qty_diff > 0:
                                item.inventory_item.deduct_stock(
                                    quantity=qty_diff,
                                    reason=f"Increased quantity on Invoice {instance.invoice_number}",
                                    user=request.user if request else None
                                )
                            elif qty_diff < 0:
                                item.inventory_item.add_stock(
                                    quantity=abs(qty_diff),
                                    reason=f"Decreased quantity on Invoice {instance.invoice_number}",
                                    user=request.user if request else None
                                )
                        except Exception as e:
                            from rest_framework.exceptions import ValidationError
                            raise ValidationError(f"Insufficient stock for {item.inventory_item.name}. {str(e)}")
                    
                    if old_price != item.unit_price or old_qty != item.quantity:
                        updated_details.append(f"Changed {item.description} (₹{old_price} x {old_qty} → ₹{item.unit_price} x {item.quantity})")
                else:
                    # Create new item
                    if 'id' in item_data:
                        del item_data['id']
                        
                    new_item = InvoiceLineItem.objects.create(
                        invoice=instance,
                        **item_data
                    )
                    
                    # Direct sales deduction for new item added during edit
                    if new_item.inventory_item and not new_item.job_part_usage:
                        try:
                            new_item.inventory_item.deduct_stock(
                                quantity=new_item.quantity,
                                reason=f"Added to existing Invoice {instance.invoice_number}",
                                user=request.user if request else None
                            )
                        except Exception as e:
                            from rest_framework.exceptions import ValidationError
                            raise ValidationError(f"Insufficient stock for {new_item.inventory_item.name}. {str(e)}")
                            
                    added_details.append(f"Added {new_item.description} (₹{new_item.unit_price} x {new_item.quantity})")
            
            # Delete items not in provided list (if any were provided)
            items_to_delete = set(existing_items.keys()) - provided_ids
            for item_id_to_delete in items_to_delete:
                deleted_item = existing_items[item_id_to_delete]
                
                # Restore stock if direct sale
                if deleted_item.inventory_item and not deleted_item.job_part_usage:
                    deleted_item.inventory_item.add_stock(
                        quantity=deleted_item.quantity,
                        reason=f"Removed from Invoice {instance.invoice_number}",
                        user=request.user if request else None
                    )
                    
                removed_details.append(f"Removed {deleted_item.description}")
                deleted_item.delete()

            # Compile line item changes string
            if added_details or updated_details or removed_details:
                all_line_item_changes = added_details + updated_details + removed_details
                changes.append("Line items modified: " + " | ".join(all_line_item_changes))

        # Snapshot old totals for edit history
        old_total = str(instance.total_amount)
        
        # Clear Django's prefetch cache so calculate_totals() queries the DB
        # for the current line items instead of using the stale prefetch data
        # (the viewset queryset uses prefetch_related('line_items')).
        if hasattr(instance, '_prefetched_objects_cache'):
            instance._prefetched_objects_cache.pop('line_items', None)
        
        # Recalculate totals
        instance.calculate_totals()
        instance.save()
        
        InvoiceEditHistory.objects.create(
            invoice=instance,
            edited_by=request.user if request else None,
            edit_type=InvoiceEditType.DETAILS_UPDATED,
            summary='\n'.join(changes) if changes else 'Invoice updated',
            old_values={'total_amount': old_total},
            new_values={'total_amount': str(instance.total_amount)},
        )
        
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


class InvoiceEditHistorySerializer(serializers.ModelSerializer):
    """Serializer for invoice edit history."""
    edited_by_name = serializers.CharField(
        source='edited_by.get_full_name', read_only=True
    )
    edit_type_display = serializers.CharField(
        source='get_edit_type_display', read_only=True
    )

    class Meta:
        model = InvoiceEditHistory
        fields = [
            'id', 'invoice', 'edited_by', 'edited_by_name',
            'edit_type', 'edit_type_display',
            'summary', 'old_values', 'new_values',
            'created_at'
        ]
        read_only_fields = fields
