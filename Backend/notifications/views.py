"""
Notification ViewSets.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.utils import timezone
from django.db import transaction

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
from core.serializers import KeyValueSerializer


class NotificationTemplateViewSet(BranchScopedMixin, viewsets.ModelViewSet):
    """ViewSet for managing notification templates."""
    serializer_class = NotificationTemplateSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['notification_type', 'channel', 'is_active']
    branch_field = 'branch'
    pagination_class = None
    queryset = NotificationTemplate.objects.all()

    def get_queryset(self):
        return super().get_queryset()

    @action(detail=False, methods=['post'], url_path='create-defaults')
    def create_defaults(self, request):
        """Create default templates for a branch."""
        branch_id = request.data.get('branch_id')
        
        if not branch_id:
            raise ValidationError('branch_id is required')

        from core.models import Branch
        try:
            branch = Branch.objects.get(pk=branch_id)
        except Branch.DoesNotExist:
            raise NotFound('Branch not found')

        if not request.user.has_branch_access(branch):
            raise PermissionDenied('Access denied')
        
        from notifications.defaults import ensure_default_notification_templates
        created_count = ensure_default_notification_templates(branch)
        
        return Response({
            'message': f'Created {created_count} default templates.'
        })


class NotificationLogViewSet(BranchScopedMixin, viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for notification logs."""
    serializer_class = NotificationLogSerializer
    permission_classes = [IsAuthenticated, IsBranchMember]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['notification_type', 'channel', 'status']
    ordering = ['-created_at']
    branch_field = 'branch'
    queryset = NotificationLog.objects.all()

    def get_queryset(self):
        return super().get_queryset().select_related('job', 'invoice')

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Retry a failed notification."""
        log = self.get_object()
        
        if log.status != 'FAILED':
            raise ValidationError('Only failed notifications can be retried.')

        if log.retry_count >= 3:
            raise ValidationError('Maximum retry attempts reached.')
        
        log.status = 'PENDING'
        log.last_retry_at = timezone.now()
        log.dispatched_at = None
        log.error_message = ''
        log.save(update_fields=[
            'status', 'last_retry_at', 'dispatched_at', 'error_message', 'updated_at'
        ])

        from notifications.tasks import enqueue_notification
        transaction.on_commit(lambda: enqueue_notification(log.pk), robust=True)
        
        return Response({'message': 'Notification retry initiated.'})


class InternalAlertViewSet(viewsets.ModelViewSet):
    """ViewSet for internal alerts."""
    serializer_class = InternalAlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['alert_type', 'priority', 'is_read', 'is_dismissed']
    ordering = ['-created_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'unread_count', 'mark_read', 'mark_all_read', 'dismiss']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsOwnerOrManager()]

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

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """Mark all unread alerts as read."""
        alerts = self.get_queryset().filter(is_read=False)
        count = alerts.count()
        
        for alert in alerts:
            alert.mark_read(request.user)
        
        return Response({'message': f'{count} alerts marked as read.'})

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """Get count of unread alerts."""
        count = self.get_queryset().filter(is_read=False, is_dismissed=False).count()
        return Response({'count': count})


class SendNotificationView(APIView):
    """APIView for sending custom notifications."""
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    serializer_class = SendNotificationSerializer

    def post(self, request):
        """Send a custom notification."""
        serializer = SendNotificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        data = serializer.validated_data
        
        accessible_branches = request.user.get_accessible_branches()
        branch = accessible_branches.first()
        if branch is None:
            raise PermissionDenied('You do not have access to an active branch.')

        # A linked job must belong to a branch the sender can access.
        job = None
        if 'job_id' in data:
            from jobs.models import JobCard
            try:
                job = JobCard.objects.get(
                    pk=data['job_id'],
                    branch__in=accessible_branches,
                )
            except JobCard.DoesNotExist:
                raise ValidationError({'job_id': 'Job not found or inaccessible.'})
            branch = job.branch

        # Create log entry
        log = NotificationLog.objects.create(
            branch=branch,
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
        
        from notifications.tasks import enqueue_notification
        transaction.on_commit(lambda: enqueue_notification(log.pk), robust=True)
        
        return Response({
            'message': 'Notification queued successfully.',
            'log_id': str(log.id)
        }, status=status.HTTP_202_ACCEPTED)


class NotificationEnumsView(viewsets.ViewSet):
    """ViewSet for notification enums."""
    permission_classes = [IsAuthenticated]
    serializer_class = KeyValueSerializer

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
