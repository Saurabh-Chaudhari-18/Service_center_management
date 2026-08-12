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


from jobs.serializer_modules.common import *  # noqa: F401,F403

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
    outsourced_repairs = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()
    is_readonly = serializers.SerializerMethodField()
    total_parts_cost = serializers.DecimalField(
        source='get_total_parts_cost', max_digits=10, decimal_places=2, read_only=True
    )

    physical_condition_display = serializers.SerializerMethodField()
    engineer_diagnosis_display = serializers.SerializerMethodField()

    class Meta:
        model = JobCard
        fields = [
            'id', 'branch', 'branch_name', 'job_number', 'tracking_pin',
            'customer', 'customer_id',
            'device_type', 'device_type_display', 'brand', 'model', 'serial_number',
            'customer_complaint', 'physical_condition', 'physical_condition_display',
            'engineer_diagnosis', 'engineer_diagnosis_display',
            'additional_comments',
            'status', 'status_display', 'allowed_transitions', 'is_readonly',
            'assigned_technician', 'assigned_technician_name',
            'received_by', 'received_by_name',
            'diagnosis_notes', 'estimated_cost', 'estimated_completion_date',
            'customer_approval_date', 'customer_rejection_reason',
            'completion_notes', 'actual_completion_date',
            'delivery_date', 'delivered_by',
            'is_urgent', 'is_warranty_repair', 'warranty_details',
            'total_parts_cost', 'received_date',
            'accessories', 'photos', 'notes', 'status_history', 'diagnosis_parts',
            'outsourced_repairs',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'job_number', 'tracking_pin', 'status', 'received_by',
            'customer_approval_date', 'actual_completion_date',
            'delivery_date', 'delivered_by', 'created_at', 'updated_at'
        ]

    def get_allowed_transitions(self, obj) -> list:
        """Get list of allowed status transitions."""
        allowed = ALLOWED_STATUS_TRANSITIONS.get(obj.status, [])
        return [{'value': s, 'label': s.label} for s in allowed]

    def get_is_readonly(self, obj) -> bool:
        """Check if job is in read-only terminal state."""
        request = self.context.get('request')
        if request and request.user.role == 'OWNER':
            return False
        return obj.is_terminal_status()

    def validate_branch(self, value):
        """Ensure user has access to branch."""
        request = self.context.get('request')
        if request and not request.user.has_branch_access(value):
            raise serializers.ValidationError("You do not have access to this branch.")
        return value

    def _resolve_dropdown_ids(self, json_data):
        """Resolve dropdown option IDs to labels."""
        if not json_data or not isinstance(json_data, dict):
            # Legacy text data
            if isinstance(json_data, str):
                return json_data
            return ''

        selected_ids = json_data.get('selected', [])
        other_text = json_data.get('other_text', '')

        if not selected_ids:
            return other_text or ''

        options = DropdownOption.objects.filter(
            id__in=selected_ids
        ).values_list('label', flat=True)
        labels = list(options)

        if other_text:
            labels.append(f'Others: {other_text}')

        return ', '.join(labels)

    def get_physical_condition_display(self, obj) -> str:
        return self._resolve_dropdown_ids(obj.physical_condition)

    def get_engineer_diagnosis_display(self, obj) -> str:
        return self._resolve_dropdown_ids(obj.engineer_diagnosis)

    def get_outsourced_repairs(self, obj) -> list:
        """Serialize outsourced repair records (lazy import to avoid forward reference)."""
        repairs = obj.outsourced_repairs.all()
        if not repairs.exists():
            return []
        from jobs.serializer_modules.outsourcing import OutsourcedRepairSerializer

        return OutsourcedRepairSerializer(repairs, many=True).data


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
            'id', 'job_number', 'tracking_pin', 'status', 'branch', 'customer_id', 'device_type', 'brand', 'model',
            'serial_number', 'device_password', 'bios_password',
            'customer_complaint', 'physical_condition', 'engineer_diagnosis',
            'diagnosis_notes',
            'is_urgent', 'is_warranty_repair', 'warranty_details',
            'accessories', 'additional_comments', 'estimated_cost', 'received_date'
        ]
        read_only_fields = ['id', 'job_number', 'tracking_pin', 'status']

    def validate_customer_id(self, value):
        """Validate customer exists and belongs to branch."""
        from customers.models import Customer

        branch_id = self.initial_data.get('branch')
        try:
            customer = Customer.objects.get(pk=value)
            request = self.context.get('request')
            if request and not request.user.has_branch_access(customer.branch):
                raise serializers.ValidationError("Customer not found.")
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

        # Persist outbox rows atomically with the job. Provider task publication
        # remains commit-aware inside NotificationService.
        from notifications.services import NotificationService
        NotificationService.on_job_created(job)

        return job



class JobCardUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for full job card updates (Owner only).
    Allows updating accessories and other read-only fields.
    """
    accessories = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        write_only=True
    )
    customer_id = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = JobCard
        fields = [
            'id', 'job_number', 'branch', 'customer_id',
            'device_type', 'brand', 'model', 'serial_number',
            'customer_complaint', 'physical_condition', 'engineer_diagnosis',
            'diagnosis_notes',
            'estimated_cost', 'estimated_completion_date',
            'is_urgent', 'is_warranty_repair', 'warranty_details',
            'accessories', 'additional_comments', 'received_date'
        ]
        read_only_fields = ['id', 'job_number', 'branch']

    @transaction.atomic
    def update(self, instance, validated_data):
        accessories_data = validated_data.pop('accessories', None)
        customer_id = validated_data.pop('customer_id', None)

        # Update customer if provided
        if customer_id:
            from customers.models import Customer
            instance.customer = Customer.objects.get(pk=customer_id)

        # Update standard fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update accessories if provided
        if accessories_data is not None:
            # Delete existing and recreate (simplest approach for full update)
            instance.accessories.all().delete()
            for acc in accessories_data:
                JobAccessory.objects.create(
                    job=instance,
                    accessory_type=acc.get('accessory_type'),
                    description=acc.get('description', ''),
                    condition=acc.get('condition', ''),
                    is_present=acc.get('is_present', True)
                )

        return instance


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
            'device_type', 'brand', 'model', 'customer_complaint', 'additional_comments',
            'status', 'status_display',
            'is_urgent', 'assigned_technician_name',
            'estimated_completion_date', 'received_date', 'created_at'
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

        new_status = JobStatus(value)
        if not job.can_transition_to(new_status):
            allowed = [s.label for s in ALLOWED_STATUS_TRANSITIONS.get(job.status, [])]
            allowed_text = ', '.join(allowed) if allowed else 'no further transitions'
            raise serializers.ValidationError(
                f"Cannot transition from {job.get_status_display()} to {new_status.label}. "
                f"Allowed: {allowed_text}."
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
    otp = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    signature = serializers.ImageField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    def validate(self, data):
        job = self.context.get('job')
        otp = (data.get('otp') or '').strip()
        signature = data.get('signature')

        if not otp and not signature:
            raise serializers.ValidationError(
                'Enter the customer delivery OTP or capture a customer signature.'
            )

        if otp:
            if not job or not job.delivery_otp:
                raise serializers.ValidationError({'otp': 'No active delivery OTP exists. Resend the OTP and try again.'})
            valid, reason = job.verify_delivery_otp(otp)
            if not valid:
                messages = {
                    'missing': 'No active delivery OTP exists. Resend the OTP and try again.',
                    'expired': 'The delivery OTP has expired. Resend it and try again.',
                    'locked': 'Too many incorrect attempts. Resend the OTP to continue.',
                    'incorrect': 'The delivery OTP is incorrect.',
                }
                raise serializers.ValidationError({'otp': messages[reason]})

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


# =====================================================
# Pickup Request Serializers
# =====================================================
