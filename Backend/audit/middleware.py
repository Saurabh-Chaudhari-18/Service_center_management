"""
Audit middleware for request tracking.
"""

from django.utils.deprecation import MiddlewareMixin
import threading

# Thread-local storage for request context
_request_local = threading.local()


def get_current_request():
    """Get the current request from thread-local storage."""
    return getattr(_request_local, 'request', None)


def get_current_user():
    """Get the current user from the request."""
    request = get_current_request()
    if request and hasattr(request, 'user') and request.user.is_authenticated:
        return request.user
    return None


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware to store request context for audit logging.
    Makes request available to model save/delete methods.
    """

    def process_request(self, request):
        """Store request in thread-local."""
        _request_local.request = request

    def process_response(self, request, response):
        """Clear thread-local after request."""
        if hasattr(_request_local, 'request'):
            del _request_local.request
        return response

    def process_exception(self, request, exception):
        """Clear thread-local on exception."""
        if hasattr(_request_local, 'request'):
            del _request_local.request
        return None
