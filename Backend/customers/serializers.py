"""
Customer serializers.
"""

from rest_framework import serializers
from customers.models import Customer, CustomerDocument
from core.models import Branch


class CustomerDocumentSerializer(serializers.ModelSerializer):
    """Serializer for customer documents."""
    
    class Meta:
        model = CustomerDocument
        fields = [
            'id', 'customer', 'document_type', 'document_number',
            'file', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    """Serializer for Customer model."""
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    pending_jobs_count = serializers.SerializerMethodField()
    total_jobs_count = serializers.SerializerMethodField()
    documents = CustomerDocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = Customer
        fields = [
            'id', 'branch', 'branch_name', 'first_name', 'last_name',
            'full_name', 'email', 'mobile', 'alternate_mobile',
            'address_line1', 'address_line2', 'city', 'state',
            'pincode', 'state_code', 'gstin', 'company_name',
            'sms_enabled', 'whatsapp_enabled', 'notes', 'is_active',
            'pending_jobs_count', 'total_jobs_count', 'documents',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_pending_jobs_count(self, obj):
        return obj.get_pending_jobs().count()

    def get_total_jobs_count(self, obj):
        return obj.job_cards.count()

    def validate_mobile(self, value):
        """Normalize mobile number."""
        # Remove spaces and special characters
        normalized = ''.join(c for c in value if c.isdigit() or c == '+')
        
        # Add country code if not present
        if not normalized.startswith('+'):
            if len(normalized) == 10:
                normalized = '+91' + normalized
            elif len(normalized) == 11 and normalized.startswith('0'):
                normalized = '+91' + normalized[1:]
        
        return normalized

    def validate(self, data):
        """Check for duplicate mobile in same branch."""
        branch = data.get('branch')
        mobile = data.get('mobile')
        
        if branch and mobile:
            existing = Customer.objects.filter(
                branch=branch,
                mobile=mobile
            )
            
            # Exclude current instance if updating
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            
            if existing.exists():
                raise serializers.ValidationError({
                    'mobile': 'A customer with this mobile already exists in this branch.'
                })
        
        return data

    def validate_branch(self, value):
        """Ensure user has access to the branch."""
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            if not request.user.has_branch_access(value):
                raise serializers.ValidationError(
                    "You do not have access to this branch."
                )
        return value


class CustomerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating customers."""
    
    class Meta:
        model = Customer
        fields = [
            'branch', 'first_name', 'last_name', 'email', 'mobile',
            'alternate_mobile', 'address_line1', 'address_line2',
            'city', 'state', 'pincode', 'state_code', 'gstin',
            'company_name', 'sms_enabled', 'whatsapp_enabled', 'notes'
        ]

    def validate_mobile(self, value):
        """Normalize mobile number."""
        normalized = ''.join(c for c in value if c.isdigit() or c == '+')
        if not normalized.startswith('+'):
            if len(normalized) == 10:
                normalized = '+91' + normalized
        return normalized

    def validate(self, data):
        """Check for duplicate mobile in same branch."""
        branch = data.get('branch')
        mobile = data.get('mobile')
        
        if branch and mobile:
            if Customer.objects.filter(branch=branch, mobile=mobile).exists():
                raise serializers.ValidationError({
                    'mobile': 'A customer with this mobile already exists in this branch.'
                })
        
        return data


class CustomerMinimalSerializer(serializers.ModelSerializer):
    """Minimal customer serializer for nested representations."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = Customer
        fields = ['id', 'full_name', 'mobile']


class CustomerSearchSerializer(serializers.Serializer):
    """Serializer for customer search."""
    mobile = serializers.CharField(required=False)
    name = serializers.CharField(required=False)
    branch = serializers.UUIDField(required=False)


class CustomerServiceHistorySerializer(serializers.ModelSerializer):
    """Serializer for customer service history."""
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    total_spent = serializers.DecimalField(
        source='get_total_spent',
        max_digits=12,
        decimal_places=2,
        read_only=True
    )
    
    class Meta:
        model = Customer
        fields = [
            'id', 'full_name', 'mobile', 'total_spent'
        ]
