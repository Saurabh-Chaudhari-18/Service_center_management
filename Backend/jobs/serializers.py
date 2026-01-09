"""
Job Card serializers with status validation and lifecycle support.
"""

from rest_framework import serializers
from django.db import transaction
from jobs.models import (
    JobCard, JobStatus, JobStatusHistory, JobAccessory,
    JobPhoto, JobNote, PartRequest, DiagnosisPart, ALLOWED_STATUS_TRANSITIONS,
    AccessoryType, DeviceType
)
from customers.serializers import CustomerMinimalSerializer
from core.models import User


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
        fields = ['id', 'name', 'price', 'warranty_days', 'quantity']
        read_only_fields = ['id']


class JobCardSerializer(serializers.ModelSerializer):
    """Full job card serializer."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    customer = CustomerMinimalSerializer(read_only=True)
    customer_id = serializers.UUIDField(write_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    device_type_display = serializers.CharField(source='get_device_type_display', read_only=True)
    assigned_technician_name = serializers.CharField(
        source='assigned_technician.get_full_name', read_only=True
    )
    received_by_name = serializers.CharField(
        source='received_by.get_full_name', read_only=True
    )
    accessories = JobAccessorySerializer(many=True, read_only=True)
    photos = JobPhotoSerializer(many=True, read_only=True)
    notes = JobNoteSerializer(many=True, read_only=True)
    status_history = JobStatusHistorySerializer(many=True, read_only=True)
    diagnosis_parts = DiagnosisPartSerializer(many=True, read_only=True)
    allowed_transitions = serializers.SerializerMethodField()
    is_readonly = serializers.SerializerMethodField()
    total_parts_cost = serializers.DecimalField(
        source='get_total_parts_cost', max_digits=10, decimal_places=2, read_only=True
    )
    
    class Meta:
        model = JobCard
        fields = [
            'id', 'branch', 'branch_name', 'job_number',
            'customer', 'customer_id',
            'device_type', 'device_type_display', 'brand', 'model', 'serial_number',
            'customer_complaint', 'physical_condition',
            'status', 'status_display', 'allowed_transitions', 'is_readonly',
            'assigned_technician', 'assigned_technician_name',
            'received_by', 'received_by_name',
            'diagnosis_notes', 'estimated_cost', 'estimated_completion_date',
            'customer_approval_date', 'customer_rejection_reason',
            'completion_notes', 'actual_completion_date',
            'delivery_date', 'delivered_by',
            'is_urgent', 'is_warranty_repair', 'warranty_details',
            'total_parts_cost',
            'accessories', 'photos', 'notes', 'status_history', 'diagnosis_parts',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'job_number', 'status', 'received_by',
            'customer_approval_date', 'actual_completion_date',
            'delivery_date', 'delivered_by', 'created_at', 'updated_at'
        ]

    def get_allowed_transitions(self, obj):
        """Get list of allowed status transitions."""
        allowed = ALLOWED_STATUS_TRANSITIONS.get(obj.status, [])
        return [{'value': s, 'label': s.label} for s in allowed]

    def get_is_readonly(self, obj):
        """Check if job is in read-only terminal state."""
        return obj.is_terminal_status()

    def validate_branch(self, value):
        """Ensure user has access to branch."""
        request = self.context.get('request')
        if request and not request.user.has_branch_access(value):
            raise serializers.ValidationError("You do not have access to this branch.")
        return value


class JobCardCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating job cards."""
    customer_id = serializers.UUIDField()
    accessories = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )
    device_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    bios_password = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    
    class Meta:
        model = JobCard
        fields = [
            'branch', 'customer_id', 'device_type', 'brand', 'model',
            'serial_number', 'device_password', 'bios_password',
            'customer_complaint', 'physical_condition',
            'is_urgent', 'is_warranty_repair', 'warranty_details',
            'accessories'
        ]

    def validate_customer_id(self, value):
        """Validate customer exists and belongs to branch."""
        from customers.models import Customer
        
        branch_id = self.initial_data.get('branch')
        try:
            customer = Customer.objects.get(pk=value)
            if branch_id and str(customer.branch_id) != str(branch_id):
                raise serializers.ValidationError(
                    "Customer does not belong to the specified branch."
                )
            return value
        except Customer.DoesNotExist:
            raise serializers.ValidationError("Customer not found.")

    @transaction.atomic
    def create(self, validated_data):
        accessories_data = validated_data.pop('accessories', [])
        device_password = validated_data.pop('device_password', '')
        bios_password = validated_data.pop('bios_password', '')
        
        # Get customer
        from customers.models import Customer
        customer_id = validated_data.pop('customer_id')
        customer = Customer.objects.get(pk=customer_id)
        
        # Set received_by from request user
        request = self.context.get('request')
        validated_data['received_by'] = request.user
        validated_data['customer'] = customer
        
        # Create job card
        job = JobCard.objects.create(**validated_data)
        
        # Set passwords (encrypted)
        if device_password:
            job.device_password = device_password
        if bios_password:
            job.bios_password = bios_password
        job.save()
        
        # Create accessories
        for acc in accessories_data:
            JobAccessory.objects.create(
                job=job,
                accessory_type=acc.get('accessory_type'),
                description=acc.get('description', ''),
                condition=acc.get('condition', ''),
                is_present=acc.get('is_present', True)
            )
        
        # Create initial status history
        JobStatusHistory.objects.create(
            job=job,
            from_status=JobStatus.RECEIVED,
            to_status=JobStatus.RECEIVED,
            changed_by=request.user,
            notes='Job created'
        )
        
        # Trigger notification
        from notifications.services import NotificationService
        NotificationService.on_job_created(job)
        
        return job


class JobCardListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for job card listings."""
    customer_name = serializers.CharField(source='customer.get_full_name', read_only=True)
    customer_mobile = serializers.CharField(source='customer.mobile', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_technician_name = serializers.CharField(
        source='assigned_technician.get_full_name', read_only=True
    )
    
    class Meta:
        model = JobCard
        fields = [
            'id', 'job_number', 'branch_name', 'customer_name', 'customer_mobile',
            'device_type', 'brand', 'model', 'status', 'status_display',
            'is_urgent', 'assigned_technician_name',
            'estimated_completion_date', 'created_at'
        ]


class JobStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating job status."""
    new_status = serializers.ChoiceField(choices=JobStatus.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
    is_override = serializers.BooleanField(default=False)

    def validate_new_status(self, value):
        job = self.context.get('job')
        request = self.context.get('request')
        is_override = self.initial_data.get('is_override', False)
        
        if is_override:
            # Check if user can override
            from core.models import Role
            if request.user.role not in [Role.OWNER, Role.MANAGER]:
                raise serializers.ValidationError(
                    "Only owners and managers can override status transitions."
                )
            return value
        
        if not job.can_transition_to(value):
            allowed = [s.label for s in ALLOWED_STATUS_TRANSITIONS.get(job.status, [])]
            raise serializers.ValidationError(
                f"Cannot transition from {job.get_status_display()} to this status. "
                f"Allowed: {', '.join(allowed)}"
            )
        
        return value


class JobAssignTechnicianSerializer(serializers.Serializer):
    """Serializer for assigning technician to job."""
    technician_id = serializers.UUIDField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_technician_id(self, value):
        from core.models import Role
        
        try:
            technician = User.objects.get(pk=value, role=Role.TECHNICIAN, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError("Technician not found or inactive.")
        
        # Validate technician has access to job's branch
        job = self.context.get('job')
        if job and not technician.has_branch_access(job.branch):
            raise serializers.ValidationError(
                "Technician does not have access to this branch."
            )
        
        return value


    estimated_completion_date = serializers.DateField(required=False)





class JobDiagnosisSerializer(serializers.Serializer):
    """Serializer for technician diagnosis."""
    diagnosis_notes = serializers.CharField()
    estimated_cost = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False
    )
    estimated_completion_date = serializers.DateField(required=False)
    parts = DiagnosisPartSerializer(many=True, required=False)


class JobEstimateApprovalSerializer(serializers.Serializer):
    """Serializer for customer estimate approval/rejection."""
    approved = serializers.BooleanField()
    rejection_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        if not data['approved'] and not data.get('rejection_reason'):
            raise serializers.ValidationError({
                'rejection_reason': 'Reason is required when rejecting estimate.'
            })
        return data


class JobDeliverySerializer(serializers.Serializer):
    """Serializer for job delivery with OTP/signature verification."""
    otp = serializers.CharField(required=False)
    signature = serializers.ImageField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        # Either OTP or signature is mandatory
        if not data.get('otp') and not data.get('signature'):
            raise serializers.ValidationError(
                "Either OTP or customer signature is required for delivery."
            )
        
        # Verify OTP if provided
        if data.get('otp'):
            job = self.context.get('job')
            if not job.verify_delivery_otp(data['otp']):
                raise serializers.ValidationError({
                    'otp': 'Invalid OTP.'
                })
        
        return data


class DevicePasswordAccessSerializer(serializers.Serializer):
    """Serializer for accessing device passwords."""
    reason = serializers.CharField(
        help_text="Reason for accessing device password"
    )


class AccessoryTypeSerializer(serializers.Serializer):
    """Serializer for accessory types list."""
    value = serializers.CharField()
    label = serializers.CharField()


class DeviceTypeSerializer(serializers.Serializer):
    """Serializer for device types list."""
    value = serializers.CharField()
    label = serializers.CharField()
