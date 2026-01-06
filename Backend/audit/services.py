"""
Audit services for logging operations.
"""

import logging
from django.utils import timezone
from audit.models import AuditLog, LoginLog, DataExportLog

logger = logging.getLogger(__name__)


class AuditLogService:
    """
    Service for creating audit log entries.
    All logs are immutable once created.
    """

    @staticmethod
    def log(user, action, model_name, object_id, details=None, 
            old_values=None, new_values=None, request=None):
        """
        Create an audit log entry.
        
        Args:
            user: User performing the action
            action: Action type (e.g., 'CREATE', 'UPDATE', 'DELETE')
            model_name: Name of the model being affected
            object_id: ID of the affected object
            details: Additional details (dict)
            old_values: Previous values (dict, for updates)
            new_values: New values (dict, for updates)
            request: HTTP request object (for IP/user agent)
        """
        try:
            log = AuditLog(
                user=user,
                action=action.upper(),
                model_name=model_name,
                object_id=str(object_id),
                details=details or {},
                old_values=old_values or {},
                new_values=new_values or {},
            )
            
            if request:
                log.ip_address = AuditLogService._get_client_ip(request)
                log.user_agent = request.META.get('HTTP_USER_AGENT', '')[:500]
                log.request_path = request.path[:500]
                log.request_method = request.method
            
            log.save()
            logger.info(f"Audit log: {action} on {model_name}:{object_id} by {user}")
            return log
            
        except Exception as e:
            logger.error(f"Failed to create audit log: {str(e)}")
            return None

    @staticmethod
    def log_create(user, obj, request=None, details=None):
        """Log object creation."""
        return AuditLogService.log(
            user=user,
            action='CREATE',
            model_name=obj.__class__.__name__,
            object_id=str(obj.pk),
            new_values=AuditLogService._get_model_dict(obj),
            details=details,
            request=request
        )

    @staticmethod
    def log_update(user, obj, old_values, request=None, details=None):
        """Log object update."""
        return AuditLogService.log(
            user=user,
            action='UPDATE',
            model_name=obj.__class__.__name__,
            object_id=str(obj.pk),
            old_values=old_values,
            new_values=AuditLogService._get_model_dict(obj),
            details=details,
            request=request
        )

    @staticmethod
    def log_delete(user, obj, request=None, details=None):
        """Log object deletion."""
        return AuditLogService.log(
            user=user,
            action='DELETE',
            model_name=obj.__class__.__name__,
            object_id=str(obj.pk),
            old_values=AuditLogService._get_model_dict(obj),
            details=details,
            request=request
        )

    @staticmethod
    def log_status_change(user, obj, old_status, new_status, request=None, notes=''):
        """Log status change."""
        return AuditLogService.log(
            user=user,
            action='STATUS_CHANGE',
            model_name=obj.__class__.__name__,
            object_id=str(obj.pk),
            old_values={'status': old_status},
            new_values={'status': new_status},
            details={'notes': notes},
            request=request
        )

    @staticmethod
    def log_login(email, success, user=None, failure_reason='', request=None):
        """Log login attempt."""
        try:
            log = LoginLog(
                user=user,
                email=email,
                success=success,
                failure_reason=failure_reason,
            )
            
            if request:
                log.ip_address = AuditLogService._get_client_ip(request)
                log.user_agent = request.META.get('HTTP_USER_AGENT', '')
            
            log.save()
            return log
            
        except Exception as e:
            logger.error(f"Failed to log login: {str(e)}")
            return None

    @staticmethod
    def log_export(user, export_type, report_name, parameters=None,
                   record_count=0, file_size=0):
        """Log data export."""
        try:
            return DataExportLog.objects.create(
                user=user,
                export_type=export_type,
                report_name=report_name,
                parameters=parameters or {},
                record_count=record_count,
                file_size=file_size
            )
        except Exception as e:
            logger.error(f"Failed to log export: {str(e)}")
            return None

    @staticmethod
    def _get_client_ip(request):
        """Extract client IP from request."""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    @staticmethod
    def _get_model_dict(obj):
        """Convert model instance to dictionary for logging."""
        try:
            from django.forms.models import model_to_dict
            data = model_to_dict(obj)
            # Convert non-serializable values
            for key, value in data.items():
                if hasattr(value, 'pk'):
                    data[key] = str(value.pk)
                elif hasattr(value, 'isoformat'):
                    data[key] = value.isoformat()
            return data
        except Exception:
            return {'pk': str(obj.pk)}


class AuditQueryService:
    """
    Service for querying audit logs.
    """

    @staticmethod
    def get_object_history(model_name, object_id):
        """Get full audit history for an object."""
        return AuditLog.objects.filter(
            model_name=model_name,
            object_id=str(object_id)
        ).order_by('-timestamp')

    @staticmethod
    def get_user_actions(user, from_date=None, to_date=None):
        """Get all actions performed by a user."""
        queryset = AuditLog.objects.filter(user=user)
        
        if from_date:
            queryset = queryset.filter(timestamp__gte=from_date)
        if to_date:
            queryset = queryset.filter(timestamp__lte=to_date)
        
        return queryset.order_by('-timestamp')

    @staticmethod
    def get_recent_activity(branch=None, limit=100):
        """Get recent activity, optionally filtered by branch."""
        queryset = AuditLog.objects.all()
        
        # Filter by branch if models have branch relationship
        # This would require branch info in the audit log
        
        return queryset.order_by('-timestamp')[:limit]
