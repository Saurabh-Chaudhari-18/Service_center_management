"""
Notification ViewSets.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.utils import timezone

from notifications.models import (
    NotificationLog, NotificationTemplate, InternalAlert,
    NotificationType, NotificationChannel
)
from notifications.serializers import (
    NotificationLogSerializer, NotificationTemplateSerializer,
    InternalAlertSerializer, SendNotificationSerializer,
    NotificationTypeSerializer, NotificationChannelSerializer
)
from core.permissions import IsBranchMember, IsOwnerOrManager, BranchScopedMixin


class NotificationTemplateViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for managing notification templates."""
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['notification_type', 'channel', 'is_active']
    branch_field = 'branch'

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return NotificationTemplate.objects.none()
        
        return NotificationTemplate.objects.filter(
            branch__in=user.get_accessible_branches()
        )

    @action(detail=False, methods=['post'])
    def create_defaults(self, request):
        """Create default templates for a branch."""
        branch_id = request.data.get('branch_id')
        
        if not branch_id:
            return Response(
                {'error': 'branch_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from core.models import Branch
        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            return Response(
                {'error': 'Branch not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        if not request.user.has_branch_access(branch):
            return Response(
                {'error': 'Access denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Create default templates
        default_templates = [
            {
                'notification_type': NotificationType.JOB_CREATED,
                'channel': NotificationChannel.SMS,
                'template_text': (
                    "Dear {customer_name}, your device has been received at {branch_name}. "
                    "Job Number: {job_number}. We will update you shortly."
                )
            },
            {
                'notification_type': NotificationType.JOB_READY,
                'channel': NotificationChannel.SMS,
                'template_text': (
                    "Dear {customer_name}, your device is ready for pickup! "
                    "Job: {job_number}. Please visit {branch_name}."
                )
            },
            {
                'notification_type': NotificationType.DELIVERY_OTP,
                'channel': NotificationChannel.SMS,
                'template_text': (
                    "Your delivery OTP for Job {job_number} is {otp}. "
                    "Please share with our staff during pickup."
                )
            },
        ]
        
        created_count = 0
        for template_data in default_templates:
            _, created = NotificationTemplate.objects.get_or_create(
                branch=branch,
                notification_type=template_data['notification_type'],
                channel=template_data['channel'],
                defaults={'template_text': template_data['template_text']}
            )
            if created:
                created_count += 1
        
        return Response({
            'message': f'Created {created_count} default templates.'
        })


class NotificationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for notification logs."""
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['notification_type', 'channel', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return NotificationLog.objects.none()
        
        return NotificationLog.objects.filter(
            branch__in=user.get_accessible_branches()
        ).select_related('job', 'invoice')

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a failed notification."""
        log = self.get_object()
        
        if log.status != 'FAILED':
            return Response(
                {'error': 'Only failed notifications can be retried.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if log.retry_count >= 3:
            return Response(
                {'error': 'Maximum retry attempts reached.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Retry sending
        from notifications.services import NotificationService
        
        log.status = 'PENDING'
        log.last_retry_at = timezone.now()
        log.save()
        
        if log.channel == NotificationChannel.SMS:
            NotificationService._send_sms(log.recipient_mobile, log.message, log)
        elif log.channel == NotificationChannel.WHATSAPP:
            NotificationService._send_whatsapp(log.recipient_mobile, log.message, log)
        
        return Response({'message': 'Notification retry initiated.'})


class InternalAlertViewSet(viewsets.ModelViewSet):
    """ViewSet for internal alerts."""
    serializer_class = InternalAlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['alert_type', 'priority', 'is_read', 'is_dismissed']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return InternalAlert.objects.none()
        
        return InternalAlert.objects.filter(
            branch__in=user.get_accessible_branches()
        )

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark an alert as read."""
        alert = self.get_object()
        alert.mark_read(request.user)
        return Response({'message': 'Alert marked as read.'})

    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss an alert."""
        alert = self.get_object()
        alert.is_dismissed = True
        alert.save(update_fields=['is_dismissed', 'updated_at'])
        return Response({'message': 'Alert dismissed.'})

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all unread alerts as read."""
        alerts = self.get_queryset().filter(is_read=False)
        count = alerts.count()
        
        for alert in alerts:
            alert.mark_read(request.user)
        
        return Response({'message': f'{count} alerts marked as read.'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread alerts."""
        count = self.get_queryset().filter(is_read=False, is_dismissed=False).count()
        return Response({'count': count})


class SendNotificationView(viewsets.ViewSet):
    """ViewSet for sending custom notifications."""
    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    @action(detail=False, methods=['post'])
    def send(self, request):
        """Send a custom notification."""
        serializer = SendNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        # Get job if provided
        job = None
        if 'job_id' in data:
            from jobs.models import JobCard
            try:
                job = JobCard.objects.get(pk=data['job_id'])
            except JobCard.DoesNotExist:
                pass
        
        # Create log entry
        log = NotificationLog.objects.create(
            branch=request.user.get_accessible_branches().first(),
            notification_type=NotificationType.CUSTOM,
            channel=data['channel'],
            recipient_mobile=data.get('recipient_mobile', ''),
            recipient_email=data.get('recipient_email', ''),
            recipient_name=data.get('recipient_name', ''),
            subject=data.get('subject', ''),
            message=data['message'],
            job=job,
            sent_by=request.user,
            status='PENDING'
        )
        
        # Send notification
        from notifications.services import NotificationService
        
        if data['channel'] == NotificationChannel.SMS:
            NotificationService._send_sms(data['recipient_mobile'], data['message'], log)
        elif data['channel'] == NotificationChannel.WHATSAPP:
            NotificationService._send_whatsapp(data['recipient_mobile'], data['message'], log)
        
        return Response({
            'message': 'Notification sent.',
            'log_id': str(log.id)
        })


class NotificationEnumsView(viewsets.ViewSet):
    """ViewSet for notification enums."""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def types(self, request):
        """Get all notification types."""
        types = [{'value': nt.value, 'label': nt.label} for nt in NotificationType]
        return Response(types)

    @action(detail=False, methods=['get'])
    def channels(self, request):
        """Get all notification channels."""
        channels = [{'value': nc.value, 'label': nc.label} for nc in NotificationChannel]
        return Response(channels)
