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


class DropdownOptionSerializer(serializers.ModelSerializer):
    """Serializer for dropdown options."""
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )
    device_type_display = serializers.CharField(
        source='get_device_type_display', read_only=True
    )

    class Meta:
        model = DropdownOption
        fields = [
            'id', 'category', 'category_display',
            'device_type', 'device_type_display',
            'label', 'display_order', 'is_active', 'has_text_input',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class JobAccessorySerializer(serializers.ModelSerializer):
    """Serializer for job accessories."""
    accessory_type_display = serializers.CharField(
        source='get_accessory_type_display', read_only=True
    )

    class Meta:
        model = JobAccessory
        fields = [
            'id', 'job', 'accessory_type', 'accessory_type_display',
            'description', 'condition', 'is_present'
        ]
        read_only_fields = ['id']


class JobPhotoSerializer(serializers.ModelSerializer):
    """Serializer for job photos."""
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True
    )

    class Meta:
        model = JobPhoto
        fields = [
            'id', 'job', 'photo', 'photo_type', 'description',
            'uploaded_by', 'uploaded_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class JobNoteSerializer(serializers.ModelSerializer):
    """Serializer for job notes."""
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )

    class Meta:
        model = JobNote
        fields = [
            'id', 'job', 'note', 'created_by', 'created_by_name',
            'is_internal', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class JobStatusHistorySerializer(serializers.ModelSerializer):
    """Serializer for job status history (read-only)."""
    from_status_display = serializers.CharField(
        source='get_from_status_display', read_only=True
    )
    to_status_display = serializers.CharField(
        source='get_to_status_display', read_only=True
    )
    changed_by_name = serializers.CharField(
        source='changed_by.get_full_name', read_only=True
    )

    class Meta:
        model = JobStatusHistory
        fields = [
            'id', 'from_status', 'from_status_display',
            'to_status', 'to_status_display',
            'changed_by', 'changed_by_name',
            'notes', 'is_override', 'created_at'
        ]
        read_only_fields = fields


class PartRequestSerializer(serializers.ModelSerializer):
    """Serializer for part requests."""
    requested_by_name = serializers.CharField(
        source='requested_by.get_full_name', read_only=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name', read_only=True
    )
    inventory_item_name = serializers.CharField(
        source='inventory_item.name', read_only=True
    )

    class Meta:
        model = PartRequest
        fields = [
            'id', 'job', 'requested_by', 'requested_by_name',
            'inventory_item', 'inventory_item_name', 'part_name',
            'quantity', 'status', 'approved_by', 'approved_by_name',
            'rejection_reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'requested_by', 'status', 'approved_by',
            'created_at', 'updated_at'
        ]


class DiagnosisPartSerializer(serializers.ModelSerializer):
    """Serializer for diagnosis spare parts."""
    class Meta:
        model = DiagnosisPart
        fields = ['id', 'name', 'price', 'warranty_months', 'quantity']
        read_only_fields = ['id']
