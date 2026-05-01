"""
Supplier serializers.
"""

from rest_framework import serializers
from suppliers.models import Supplier, PurchaseOrder, PurchaseOrderItem
from decimal import Decimal


class SupplierSerializer(serializers.ModelSerializer):
    """Full supplier serializer."""
    payment_terms_display = serializers.CharField(
        source='get_payment_terms_display', read_only=True
    )

    class Meta:
        model = Supplier
        fields = [
            'id', 'branch', 'name', 'contact_person', 'email', 'phone',
            'alternate_phone', 'address', 'city', 'state', 'pincode',
            'gstin', 'pan_number', 'bank_name', 'bank_account_number',
            'bank_ifsc', 'upi_id', 'payment_terms', 'payment_terms_display',
            'categories', 'rating', 'notes', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SupplierListSerializer(serializers.ModelSerializer):
    """Lightweight supplier list serializer."""
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_person', 'phone', 'city',
            'categories', 'rating', 'is_active'
        ]


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    """Serializer for PO items."""
    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'purchase_order', 'inventory_item', 'description',
            'quantity', 'unit_price', 'total_price', 'received_quantity'
        ]
        read_only_fields = ['id', 'total_price']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    """Full PO serializer."""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'branch', 'supplier', 'supplier_name', 'po_number',
            'order_date', 'expected_delivery_date', 'status', 'status_display',
            'subtotal', 'tax_amount', 'total_amount', 'paid_amount',
            'balance_due', 'notes', 'items',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'po_number', 'created_by', 'created_at', 'updated_at']


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    """Lightweight PO list serializer."""
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier_name', 'order_date',
            'total_amount', 'paid_amount', 'status', 'status_display'
        ]
