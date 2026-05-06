"""GST Module Serializers"""

from rest_framework import serializers
from .models import HSNCode, GSTPayment, GSTReturnStatus


class HSNCodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = HSNCode
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class GSTPaymentSerializer(serializers.ModelSerializer):
    total_paid = serializers.ReadOnlyField()
    created_by_name = serializers.CharField(
        source='created_by.get_full_name', read_only=True
    )
    period_display = serializers.SerializerMethodField()

    class Meta:
        model = GSTPayment
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']

    def get_period_display(self, obj):
        return obj.period_month.strftime('%B %Y')

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

    def get_period_display(self, obj):
        return obj.period_month.strftime('%B %Y')
