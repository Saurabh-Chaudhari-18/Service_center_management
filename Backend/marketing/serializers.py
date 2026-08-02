"""
Marketing serializers.
"""

from rest_framework import serializers
from marketing.models import (
    ReminderConfig, ServiceReminder,
    ReviewConfig, ReviewRequest,
    CustomerLedgerEntry
)


class ReminderConfigSerializer(serializers.ModelSerializer):
    """Serializer for reminder configuration."""
    class Meta:
        model = ReminderConfig
        fields = [
            'id', 'branch', 'reminder_1_days', 'reminder_2_days',
            'reminder_3_days', 'reminder_message',
            'send_whatsapp', 'send_sms', 'is_active'
        ]
        read_only_fields = ['id']


class ServiceReminderSerializer(serializers.ModelSerializer):
    """Serializer for service reminders."""
    customer_name = serializers.CharField(
        source='customer.get_full_name', read_only=True
    )
    customer_mobile = serializers.CharField(
        source='customer.mobile', read_only=True
    )
    job_number = serializers.CharField(
        source='job.job_number', read_only=True
    )

    class Meta:
        model = ServiceReminder
        fields = [
            'id', 'branch', 'job', 'job_number',
            'customer', 'customer_name', 'customer_mobile',
            'reminder_type', 'scheduled_date', 'sent_at',
            'status', 'channel', 'error_message'
        ]
        read_only_fields = ['id']


class ReviewConfigSerializer(serializers.ModelSerializer):
    """Serializer for review configuration."""
    class Meta:
        model = ReviewConfig
        fields = [
            'id', 'branch', 'google_review_link',
            'send_after_hours', 'review_message',
            'send_whatsapp', 'send_sms', 'is_active'
        ]
        read_only_fields = ['id']


class ReviewRequestSerializer(serializers.ModelSerializer):
    """Serializer for review requests."""
    customer_name = serializers.CharField(
        source='customer.get_full_name', read_only=True
    )
    job_number = serializers.CharField(
        source='job.job_number', read_only=True
    )

    class Meta:
        model = ReviewRequest
        fields = [
            'id', 'branch', 'job', 'job_number',
            'customer', 'customer_name',
            'scheduled_at', 'sent_at', 'status', 'error_message'
        ]
        read_only_fields = ['id']


class CustomerLedgerEntrySerializer(serializers.ModelSerializer):
    """Serializer for customer ledger entries."""
    customer_name = serializers.CharField(
        source='customer.get_full_name', read_only=True
    )
    customer_mobile = serializers.CharField(
        source='customer.mobile', read_only=True
    )
    entry_type_display = serializers.CharField(
        source='get_entry_type_display', read_only=True
    )
    reference_type_display = serializers.CharField(
        source='get_reference_type_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )

    class Meta:
        model = CustomerLedgerEntry
        fields = [
            'id', 'branch', 'customer', 'customer_name', 'customer_mobile',
            'entry_type', 'entry_type_display', 'amount', 'description',
            'reference_type', 'reference_type_display', 'reference_id',
            'entry_date', 'running_balance', 'notes',
            'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'running_balance', 'created_by', 'created_at', 'updated_at']


class CustomerLedgerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating ledger entries."""
    def validate(self, attrs):
        branch = attrs.get('branch')
        customer = attrs.get('customer')
        request = self.context.get('request')
        if not branch:
            raise serializers.ValidationError({'branch': 'A branch is required.'})
        if request and not request.user.has_branch_access(branch):
            raise serializers.ValidationError({'branch': 'You do not have access to this branch.'})
        if customer and customer.branch_id != branch.id:
            raise serializers.ValidationError({'customer': 'Customer does not belong to the ledger branch.'})
        return attrs

    class Meta:
        model = CustomerLedgerEntry
        fields = [
            'branch', 'customer', 'entry_type', 'amount',
            'description', 'reference_type', 'reference_id',
            'entry_date', 'notes'
        ]
