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

    def get_allowed_transitions(self, obj):
        """Get list of allowed status transitions."""
        allowed = ALLOWED_STATUS_TRANSITIONS.get(obj.status, [])
        return [{'value': s, 'label': s.label} for s in allowed]

    def get_is_readonly(self, obj):
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

    def get_physical_condition_display(self, obj):
        return self._resolve_dropdown_ids(obj.physical_condition)

    def get_engineer_diagnosis_display(self, obj):
        return self._resolve_dropdown_ids(obj.engineer_diagnosis)

    def get_outsourced_repairs(self, obj):
        """Serialize outsourced repair records (lazy import to avoid forward reference)."""
        repairs = obj.outsourced_repairs.all()
        if not repairs.exists():
            return []
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
        
        # Trigger notification (non-blocking: notification failure must never
        # prevent a job from being created — e.g. Celery/Redis may be down)
        try:
            from notifications.services import NotificationService
            NotificationService.on_job_created(job)
        except Exception as notify_err:
            import logging
            logging.getLogger(__name__).warning(
                f"Job {job.job_number} created successfully but notification failed: {notify_err}"
            )

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
            'device_type', 'brand', 'model', 'status', 'status_display',
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
        
        # User requested to allow all status transitions, removing strict validation
        # if not job.can_transition_to(value):
        #     allowed = [s.label for s in ALLOWED_STATUS_TRANSITIONS.get(job.status, [])]
        #     raise serializers.ValidationError(
        #         f"Cannot transition from {job.get_status_display()} to this status. "
        #         f"Allowed: {', '.join(allowed)}"
        #     )
        
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
        # Verification disabled for now (bypass OTP/Signature check)
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

    def get_assigned_technician_name(self, obj):
        if obj.assigned_technician:
            return obj.assigned_technician.get_full_name()
        return None

    def get_allowed_transitions(self, obj):
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

    def get_assigned_technician_name(self, obj):
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
    """Read serializer for outsourced repair records."""
    vendor_name = serializers.CharField(source='vendor.name', read_only=True)
    vendor_phone = serializers.CharField(source='vendor.phone', read_only=True)
    vendor_city = serializers.CharField(source='vendor.city', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    repair_outcome_display = serializers.CharField(source='get_repair_outcome_display', read_only=True)
    sent_by_name = serializers.CharField(source='sent_by.get_full_name', read_only=True)
    received_by_name = serializers.SerializerMethodField()

    class Meta:
        model = OutsourcedRepair
        fields = [
            'id', 'job', 'branch', 'vendor', 'vendor_name', 'vendor_phone', 'vendor_city',
            'reason', 'sent_date', 'estimated_cost', 'expected_return_date',
            'notes', 'sent_by', 'sent_by_name',
            'status', 'status_display',
            'return_date', 'actual_cost', 'repair_outcome', 'repair_outcome_display',
            'vendor_notes', 'vendor_invoice_number',
            'received_by', 'received_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'job', 'branch', 'sent_by', 'created_at', 'updated_at']

    def get_received_by_name(self, obj):
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
        try:
            OutsourceVendor.objects.get(pk=value, is_active=True)
        except OutsourceVendor.DoesNotExist:
            raise serializers.ValidationError("Vendor not found or inactive.")
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
