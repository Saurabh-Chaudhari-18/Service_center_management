"""
Core serializers for Organization, Branch, and User management.
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from core.models import Organization, Branch, User, Role, UserSession


class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for Organization model."""
    branches_count = serializers.SerializerMethodField()
    users_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'legal_name', 'email', 'phone', 'website',
            'address_line1', 'address_line2', 'city', 'state', 'pincode',
            'country', 'pan_number', 'logo', 'is_active',
            'branches_count', 'users_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_branches_count(self, obj):
        return obj.branches.filter(is_active=True).count()

    def get_users_count(self, obj):
        return obj.users.filter(is_active=True).count()


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating an Organization with initial owner."""
    owner_email = serializers.EmailField(write_only=True)
    owner_password = serializers.CharField(write_only=True, validators=[validate_password])
    owner_first_name = serializers.CharField(write_only=True, max_length=150)
    owner_last_name = serializers.CharField(write_only=True, max_length=150)
    owner_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'legal_name', 'email', 'phone', 'website',
            'address_line1', 'address_line2', 'city', 'state', 'pincode',
            'country', 'pan_number', 'logo', 'is_active',
            'owner_email', 'owner_password', 'owner_first_name',
            'owner_last_name', 'owner_phone',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    @transaction.atomic
    def create(self, validated_data):
        # Extract owner data
        owner_data = {
            'email': validated_data.pop('owner_email'),
            'password': validated_data.pop('owner_password'),
            'first_name': validated_data.pop('owner_first_name'),
            'last_name': validated_data.pop('owner_last_name'),
            'phone': validated_data.pop('owner_phone', ''),
        }
        
        # Create organization
        organization = Organization.objects.create(**validated_data)
        
        # Create owner user
        User.objects.create_user(
            email=owner_data['email'],
            password=owner_data['password'],
            first_name=owner_data['first_name'],
            last_name=owner_data['last_name'],
            phone=owner_data['phone'],
            organization=organization,
            role=Role.OWNER,
        )
        
        return organization


class BranchSerializer(serializers.ModelSerializer):
    """Serializer for Branch model."""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    users_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Branch
        fields = [
            'id', 'organization', 'organization_name', 'name', 'code',
            'email', 'phone', 'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'gstin', 'state_code',
            'invoice_prefix', 'invoice_current_number',
            'jobcard_prefix', 'jobcard_current_number',
            'sms_enabled', 'whatsapp_enabled', 'default_gst_rate',
            'is_active', 'users_count', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'organization', 'invoice_current_number',
            'jobcard_current_number', 'created_at', 'updated_at'
        ]

    def get_users_count(self, obj):
        return obj.users.filter(is_active=True).count()

    def validate_gstin(self, value):
        """Validate and extract state code from GSTIN."""
        from core.utils import validate_gstin
        if not validate_gstin(value):
            raise serializers.ValidationError("Invalid GSTIN format.")
        return value.upper()

    def validate(self, data):
        """Ensure state_code matches GSTIN."""
        gstin = data.get('gstin', '')
        state_code = data.get('state_code', '')
        
        if gstin and state_code:
            gstin_state = gstin[:2]
            if gstin_state != state_code:
                raise serializers.ValidationError({
                    'state_code': f"State code must match GSTIN prefix ({gstin_state})."
                })
        
        return data

    def create(self, validated_data):
        # Set organization from request user's organization
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['organization'] = request.user.organization
        return super().create(validated_data)


class BranchMinimalSerializer(serializers.ModelSerializer):
    """Minimal branch serializer for nested representations."""
    
    class Meta:
        model = Branch
        fields = ['id', 'name', 'code', 'city']


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    branches = BranchMinimalSerializer(many=True, read_only=True)
    branch_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Branch.objects.all(),
        write_only=True,
        source='branches',
        required=False
    )
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'organization', 'organization_name', 'role',
            'branches', 'branch_ids', 'is_active', 'last_login',
            'date_joined', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'organization', 'last_login', 'date_joined',
            'created_at', 'updated_at'
        ]

    def validate_branch_ids(self, branches):
        """Ensure all branches belong to user's organization."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            org = request.user.organization
            for branch in branches:
                if branch.organization != org:
                    raise serializers.ValidationError(
                        f"Branch {branch.name} does not belong to your organization."
                    )
        return branches


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new User."""
    password = serializers.CharField(
        write_only=True,
        validators=[validate_password],
        style={'input_type': 'password'}
    )
    password_confirm = serializers.CharField(
        write_only=True,
        style={'input_type': 'password'}
    )
    branch_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Branch.objects.all(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = User
        fields = [
            'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'phone', 'role',
            'branch_ids', 'is_active'
        ]

    def validate(self, data):
        if data.get('password') != data.get('password_confirm'):
            raise serializers.ValidationError({
                'password_confirm': "Passwords do not match."
            })
        return data

    def validate_role(self, value):
        """Only owners can create other owners."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            if value == Role.OWNER and request.user.role != Role.OWNER:
                raise serializers.ValidationError(
                    "Only owners can create owner accounts."
                )
        return value

    def validate_branch_ids(self, branches):
        """Ensure branches belong to organization."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            org = request.user.organization
            for branch in branches:
                if branch.organization != org:
                    raise serializers.ValidationError(
                        f"Branch {branch.name} does not belong to your organization."
                    )
        return branches

    @transaction.atomic
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        branch_ids = validated_data.pop('branch_ids', [])
        password = validated_data.pop('password')
        
        # Set organization from current user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['organization'] = request.user.organization
        
        user = User.objects.create_user(
            password=password,
            **validated_data
        )
        
        # Assign branches
        if branch_ids:
            user.branches.set(branch_ids)
        
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating User."""
    branch_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Branch.objects.all(),
        write_only=True,
        source='branches',
        required=False
    )
    
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'phone', 'role',
            'branch_ids', 'is_active'
        ]

    def validate_role(self, value):
        """Prevent demoting the last owner."""
        instance = self.instance
        if instance and instance.role == Role.OWNER and value != Role.OWNER:
            other_owners = User.objects.filter(
                organization=instance.organization,
                role=Role.OWNER,
                is_active=True
            ).exclude(pk=instance.pk).count()
            
            if other_owners == 0:
                raise serializers.ValidationError(
                    "Cannot demote the only owner. Add another owner first."
                )
        return value


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for password change."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(
        write_only=True,
        validators=[validate_password]
    )
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({
                'new_password_confirm': "Passwords do not match."
            })
        return data

    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class UserSessionSerializer(serializers.ModelSerializer):
    """Serializer for user sessions."""
    user_email = serializers.CharField(source='user.email', read_only=True)
    branch_name = serializers.CharField(source='current_branch.name', read_only=True)
    
    class Meta:
        model = UserSession
        fields = [
            'id', 'user', 'user_email', 'current_branch', 'branch_name',
            'ip_address', 'user_agent', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SetCurrentBranchSerializer(serializers.Serializer):
    """Serializer for setting current branch context."""
    branch_id = serializers.UUIDField()

    def validate_branch_id(self, value):
        from core.models import Branch
        try:
            branch = Branch.objects.get(pk=value, is_active=True)
        except Branch.DoesNotExist:
            raise serializers.ValidationError("Branch not found or inactive.")
        
        user = self.context['request'].user
        if not user.has_branch_access(branch):
            raise serializers.ValidationError("You do not have access to this branch.")
        
        return value
