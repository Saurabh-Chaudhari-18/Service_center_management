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


class OutsourceVendorSerializer(serializers.ModelSerializer):
    """Full CRUD serializer for outsource vendors."""
    class Meta:
        model = OutsourceVendor
        fields = [
            'id', 'branch', 'name', 'contact_person', 'phone',
            'alternate_phone', 'address', 'city', 'specialization',
            'notes', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class OutsourcedRepairSerializer(serializers.ModelSerializer):
    """Serializer for outsourced repair records (job-based or inventory warranty repairs)."""
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    vendor_phone = serializers.CharField(source='vendor.phone', read_only=True)
    vendor_city = serializers.CharField(source='vendor.city', read_only=True)
    job_number = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_mobile = serializers.SerializerMethodField()
    device_summary = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    repair_outcome_display = serializers.CharField(source='get_repair_outcome_display', read_only=True)
    sent_by_name = serializers.CharField(source='sent_by.get_full_name', read_only=True)
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OutsourcedRepair
        fields = [
            'id', 'job', 'job_number', 'inventory_item', 'item_name', 'serial_number',
            'is_warranty_repair', 'customer_name', 'customer_mobile', 'device_summary',
            'branch', 'vendor', 'vendor_name', 'vendor_phone', 'vendor_city',
            'reason', 'sent_date', 'estimated_cost', 'expected_return_date',
            'notes', 'sent_by', 'sent_by_name',
            'status', 'status_display',
            'return_date', 'actual_cost', 'repair_outcome', 'repair_outcome_display',
            'vendor_notes', 'vendor_invoice_number',
            'received_by', 'received_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'branch', 'sent_by', 'created_at', 'updated_at']

    def get_job_number(self, obj) -> str:
        if obj.job:
            return obj.job.job_number
        if obj.serial_number:
            return f"SN:{obj.serial_number}"
        return "INVENTORY-WARRANTY"

    def get_customer_name(self, obj) -> str:
        if obj.job and obj.job.customer:
            return obj.job.customer.get_full_name()
        if obj.customer_name:
            return obj.customer_name
        return "Inventory Customer"

    def get_customer_mobile(self, obj) -> str:
        if obj.job and obj.job.customer:
            return obj.job.customer.mobile
        return obj.customer_phone or ""

    def get_device_summary(self, obj) -> str:
        if obj.job:
            return f"{obj.job.get_device_type_display()} {obj.job.brand or ''} {obj.job.model or ''}".strip()
        if obj.item_name:
            return obj.item_name
        if obj.inventory_item:
            return obj.inventory_item.name
        return "Inventory Warranty Item"

    def get_received_by_name(self, obj) -> str:
        return obj.received_by.get_full_name() if obj.received_by else None


class OutsourcedRepairCreateSerializer(serializers.Serializer):
    """Serializer for creating an outsource record + changing job status."""
    vendor = serializers.UUIDField(help_text="ID of the OutsourceVendor")
    reason = serializers.CharField()
    sent_date = serializers.DateField()
    estimated_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    expected_return_date = serializers.DateField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_vendor(self, value):
        job = self.context.get('job')
        try:
            vendor = OutsourceVendor.objects.get(pk=value, is_active=True)
        except OutsourceVendor.DoesNotExist:
            raise serializers.ValidationError("Vendor not found or inactive.")
        if job and vendor.branch_id and vendor.branch_id != job.branch_id:
            raise serializers.ValidationError("Vendor does not belong to this branch.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        job = self.context['job']
        request = self.context['request']

        vendor = OutsourceVendor.objects.get(pk=validated_data['vendor'])

        outsource = OutsourcedRepair.objects.create(
            job=job,
            branch=job.branch,
            vendor=vendor,
            reason=validated_data['reason'],
            sent_date=validated_data['sent_date'],
            estimated_cost=validated_data.get('estimated_cost'),
            expected_return_date=validated_data.get('expected_return_date'),
            notes=validated_data.get('notes', ''),
            sent_by=request.user,
        )

        # Record status change
        old_status = job.status
        job.status = JobStatus.OUTSOURCED
        job.save(update_fields=['status'])

        JobStatusHistory.objects.create(
            job=job,
            from_status=old_status,
            to_status=JobStatus.OUTSOURCED,
            changed_by=request.user,
            notes=f"Outsourced to {vendor.name}: {validated_data['reason']}"
        )

        return outsource


class OutsourcedRepairReturnSerializer(serializers.Serializer):
    """Serializer for marking an outsource record as returned."""
    return_date = serializers.DateField()
    actual_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True
    )
    repair_outcome = serializers.ChoiceField(choices=RepairOutcome.choices)
    vendor_notes = serializers.CharField(required=False, allow_blank=True, default='')
    vendor_invoice_number = serializers.CharField(required=False, allow_blank=True, default='')
    # The status to move the job to after return
    new_job_status = serializers.ChoiceField(
        choices=[
            (JobStatus.REPAIR_IN_PROGRESS, 'Repair in Progress'),
            (JobStatus.READY_FOR_DELIVERY, 'Ready for Delivery'),
        ],
        help_text="Job status after device is returned"
    )

    @transaction.atomic
    def update(self, outsource, validated_data):
        request = self.context['request']
        job = outsource.job

        # Update outsource record
        outsource.status = OutsourcedRepairStatus.RETURNED
        outsource.return_date = validated_data['return_date']
        outsource.actual_cost = validated_data.get('actual_cost')
        outsource.repair_outcome = validated_data['repair_outcome']
        outsource.vendor_notes = validated_data.get('vendor_notes', '')
        outsource.vendor_invoice_number = validated_data.get('vendor_invoice_number', '')
        outsource.received_by = request.user
        outsource.save()

        # Transition job status
        new_status = validated_data['new_job_status']
        old_status = job.status
        job.status = new_status
        job.save(update_fields=['status'])

        outcome_label = dict(RepairOutcome.choices).get(validated_data['repair_outcome'], '')
        JobStatusHistory.objects.create(
            job=job,
            from_status=old_status,
            to_status=new_status,
            changed_by=request.user,
            notes=f"Returned from {outsource.vendor.name} — {outcome_label}"
        )

        return outsource
