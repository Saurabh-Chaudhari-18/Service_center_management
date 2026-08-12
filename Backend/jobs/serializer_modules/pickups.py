"""
Job Card serializers with status validation and lifecycle support.
"""

from rest_framework import serializers
from django.db import transaction
from jobs.models import (
    JobCard, JobStatus, JobStatusHistory, JobAccessory,
    JobPhoto, JobNote, PartRequest, DiagnosisPart, ALLOWED_STATUS_TRANSITIONS,
    AccessoryType, DeviceType,
    PickupRequest, PickupRequestStatus, ALLOWED_PICKUP_TRANSITIONS,
    DropdownOption, DropdownCategory,
    OutsourceVendor, OutsourcedRepair, OutsourcedRepairStatus, RepairOutcome
)
from customers.serializers import CustomerMinimalSerializer
from core.models import User


class PickupRequestSerializer(serializers.ModelSerializer):
    """Full pickup request serializer."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    customer = CustomerMinimalSerializer(read_only=True)
    customer_id = serializers.UUIDField(write_only=True, required=False)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    device_type_display = serializers.CharField(source='get_device_type_display', read_only=True)
    assigned_technician_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    job_number = serializers.CharField(source='job.job_number', read_only=True, default=None)
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = PickupRequest
        fields = [
            'id', 'branch', 'branch_name', 'pickup_number',
            'customer', 'customer_id',
            'job', 'job_number',
            'status', 'status_display', 'allowed_transitions',
            'assigned_technician', 'assigned_technician_name',
            'device_type', 'device_type_display', 'brand', 'model_name',
            'customer_complaint',
            'pickup_address', 'pickup_date', 'pickup_time_slot', 'contact_number',
            'notes', 'is_urgent',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pickup_number', 'status', 'created_by',
            'created_at', 'updated_at'
        ]

    def get_assigned_technician_name(self, obj) -> str:
        if obj.assigned_technician:
            return obj.assigned_technician.get_full_name()
        return None

    def get_allowed_transitions(self, obj) -> list:
        allowed = ALLOWED_PICKUP_TRANSITIONS.get(obj.status, [])
        return [{'value': s.value, 'label': s.label} for s in allowed]


class PickupRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating pickup requests."""
    customer_id = serializers.UUIDField()

    class Meta:
        model = PickupRequest
        fields = [
            'id', 'pickup_number', 'branch', 'customer_id',
            'device_type', 'brand', 'model_name',
            'customer_complaint',
            'pickup_address', 'pickup_date', 'pickup_time_slot', 'contact_number',
            'notes', 'is_urgent',
        ]
        read_only_fields = ['id', 'pickup_number']

    def validate_customer_id(self, value):
        from customers.models import Customer
        try:
            Customer.objects.get(pk=value)
            return value
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found.")

    def create(self, validated_data):
        from customers.models import Customer
        customer_id = validated_data.pop('customer_id')
        customer = Customer.objects.get(pk=customer_id)
        request = self.context.get('request')
        validated_data['customer'] = customer
        validated_data['created_by'] = request.user
        return PickupRequest.objects.create(**validated_data)


class PickupRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for pickup request listings."""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_mobile = serializers.CharField(source='customer.mobile', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_technician_name = serializers.SerializerMethodField()
    job_number = serializers.CharField(source='job.job_number', read_only=True, default=None)

    class Meta:
        model = PickupRequest
        fields = [
            'id', 'pickup_number', 'branch_name',
            'customer_name', 'customer_mobile',
            'device_type', 'brand', 'model_name',
            'status', 'status_display',
            'assigned_technician_name', 'job_number',
            'pickup_date', 'pickup_time_slot',
            'is_urgent', 'created_at'
        ]

    def get_assigned_technician_name(self, obj) -> str:
        if obj.assigned_technician:
            return obj.assigned_technician.get_full_name()
        return None


class PickupRequestStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating pickup request status."""
    new_status = serializers.ChoiceField(choices=PickupRequestStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True)


# =====================================================
# Outsource Vendor & Outsourced Repair Serializers
# =====================================================
