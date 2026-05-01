"""
Enquiry serializers.
"""

from rest_framework import serializers
from enquiries.models import Enquiry, EnquiryNote, LeadSource, EnquiryStatus


class EnquiryNoteSerializer(serializers.ModelSerializer):
    """Serializer for enquiry notes."""
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )

    class Meta:
        model = EnquiryNote
        fields = [
            'id', 'enquiry', 'note',
            'created_by', 'created_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class EnquirySerializer(serializers.ModelSerializer):
    """Full enquiry serializer."""
    source_display = serializers.CharField(
        source='get_source_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )
    assigned_to_name = serializers.CharField(
        source='assigned_to.get_full_name', read_only=True,
        default=None
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    converted_job_number = serializers.CharField(
        source='converted_job.job_number', read_only=True,
        default=None
    )
    interaction_notes = EnquiryNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Enquiry
        fields = [
            'id', 'branch', 'customer', 'customer_name', 'customer_mobile',
            'customer_email', 'device_type', 'brand', 'model_name',
            'problem_description', 'quoted_price',
            'source', 'source_display', 'status', 'status_display',
            'follow_up_date', 'follow_up_notes',
            'converted_job', 'converted_job_number',
            'loss_reason',
            'assigned_to', 'assigned_to_name',
            'created_by', 'created_by_name',
            'notes', 'interaction_notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'created_by', 'created_at', 'updated_at'
        ]


class EnquiryListSerializer(serializers.ModelSerializer):
    """Lightweight enquiry list serializer."""
    source_display = serializers.CharField(
        source='get_source_display', read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display', read_only=True
    )

    class Meta:
        model = Enquiry
        fields = [
            'id', 'customer_name', 'customer_mobile',
            'device_type', 'brand', 'problem_description',
            'quoted_price', 'source', 'source_display',
            'status', 'status_display',
            'follow_up_date', 'created_at'
        ]


class EnquiryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating enquiries."""

    class Meta:
        model = Enquiry
        fields = [
            'branch', 'customer', 'customer_name', 'customer_mobile',
            'customer_email', 'device_type', 'brand', 'model_name',
            'problem_description', 'quoted_price', 'source',
            'follow_up_date', 'follow_up_notes',
            'assigned_to', 'notes'
        ]
