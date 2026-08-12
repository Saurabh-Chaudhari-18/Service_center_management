"""
Core ViewSets for Organization, Branch, and User management.
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from core.serializers import HealthCheckSerializer, ReadinessCheckSerializer


class HealthCheckView(APIView):
    """
    GET /api/healthz/
    Returns 200 when the app + database are reachable.
    Used by Docker HEALTHCHECK, load balancers, and uptime monitors.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = HealthCheckSerializer

    def get(self, request):
        from django.db import connection
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False

        if not db_ok:
            return Response({'status': 'unhealthy', 'db': False}, status=503)

        return Response({'status': 'ok', 'db': True})


class ReadinessCheckView(APIView):
    """Report whether required production dependencies are configured and reachable."""
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = ReadinessCheckSerializer

    def get(self, request):
        from datetime import datetime, timedelta
        from django.conf import settings
        from django.core.cache import cache
        from django.db import connection
        from django.utils import timezone

        checks = {}
        try:
            connection.ensure_connection()
            checks['database'] = {'ok': True}
        except Exception as exc:
            checks['database'] = {'ok': False, 'detail': type(exc).__name__}
        try:
            cache.set('readiness-probe', 'ok', 5)
            cache_operational = cache.get('readiness-probe') == 'ok'
            shared_cache = bool(getattr(settings, 'REDIS_AVAILABLE', False))
            checks['cache'] = {
                'ok': cache_operational and (settings.DEBUG or shared_cache),
                'backend': cache.__class__.__name__,
                'shared': shared_cache,
                'required': not settings.DEBUG,
            }
        except Exception as exc:
            checks['cache'] = {'ok': False, 'detail': type(exc).__name__, 'required': not settings.DEBUG}

        heartbeat_value = cache.get('background_pipeline_heartbeat')
        heartbeat_at = None
        if heartbeat_value:
            try:
                heartbeat_at = datetime.fromisoformat(heartbeat_value)
            except (TypeError, ValueError):
                heartbeat_at = None
        pipeline_ok = bool(
            heartbeat_at
            and timezone.now() - heartbeat_at < timedelta(minutes=3)
        )
        checks['task_queue'] = {
            'ok': pipeline_ok or settings.DEBUG,
            'required': not settings.DEBUG,
            'detail': 'Beat-to-worker heartbeat',
        }
        checks['scheduler'] = {
            'ok': pipeline_ok or settings.DEBUG,
            'required': not settings.DEBUG,
            'last_heartbeat': heartbeat_value,
        }

        if settings.WHATSAPP_PROVIDER == 'twilio':
            whatsapp_ok = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_FROM)
        else:
            whatsapp_ok = bool(settings.WHATSAPP_CLOUD_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)
        sms_ok = bool(settings.TEXTBEE_API_KEY and settings.TEXTBEE_DEVICE_ID)
        email_ok = bool(settings.EMAIL_HOST_USER and settings.EMAIL_HOST_PASSWORD)
        checks['customer_notifications'] = {
            'ok': whatsapp_ok or sms_ok or email_ok,
            'required': not settings.DEBUG,
            'channels': {'whatsapp': whatsapp_ok, 'sms': sms_ok, 'email': email_ok},
        }
        require_s3 = bool(getattr(settings, 'REQUIRE_S3_MEDIA', False))
        checks['media_storage'] = {
            'ok': bool(settings.USE_S3) or not require_s3,
            'required': require_s3,
            'backend': 's3' if settings.USE_S3 else 'local-volume',
        }
        checks['error_tracking'] = {'ok': bool(settings.SENTRY_DSN), 'required': False}
        checks['backup_configuration'] = {
            'ok': bool(getattr(settings, 'BACKUP_VERIFICATION_TOKEN', '')),
            'required': not settings.DEBUG,
            'detail': 'Set after a successful restore drill; database hosting alone is not backup verification.',
        }

        required_failures = [name for name, value in checks.items() if value.get('required', True) and not value['ok']]
        response_status = 503 if required_failures else 200
        return Response({'status': 'ready' if not required_failures else 'not_ready', 'checks': checks}, status=response_status)

from core.models import Organization, Branch, User, Role
from core.serializers import (
    OrganizationSerializer, OrganizationCreateSerializer,
    OrganizationBrandingSerializer,
    BranchSerializer, BranchMinimalSerializer,
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, SetCurrentBranchSerializer,
    KeyValueSerializer
)
from core.permissions import (
    IsOwner, IsOwnerOrManager, IsBranchMember, IsSuperAdmin,
    CanManageUsers, CanAssignBranches,
)
from audit.services import AuditLogService
