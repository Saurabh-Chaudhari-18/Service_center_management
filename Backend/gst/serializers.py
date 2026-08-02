"""GST Module Serializers"""

from rest_framework import serializers
from .models import HSNCode, GSTPayment, GSTReturnStatus


class HSNCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSNCode
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class GSTPaymentSerializer(serializers.ModelSerializer):
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    period_display = serializers.SerializerMethodField()

    class Meta:
        model = GSTPayment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_period_display(self, obj) -> str:
        return obj.period_month.strftime('%B %Y')

    def validate(self, attrs):
        branch = attrs.get('branch', getattr(self.instance, 'branch', None))
        if branch is None:
            raise serializers.ValidationError({'branch': 'A branch is required.'})
        return attrs

    def validate_branch(self, branch):
        request = self.context.get('request')
        if branch is None:
            raise serializers.ValidationError('A branch is required.')
        if request and not request.user.has_branch_access(branch):
            raise serializers.ValidationError("You do not have access to this branch.")
        return branch

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class GSTReturnStatusSerializer(serializers.ModelSerializer):
    filed_by_name = serializers.CharField(
        source='filed_by.get_full_name', read_only=True
    )
    period_display = serializers.SerializerMethodField()

    class Meta:
        model = GSTReturnStatus
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_period_display(self, obj) -> str:
        return obj.period_month.strftime('%B %Y')
