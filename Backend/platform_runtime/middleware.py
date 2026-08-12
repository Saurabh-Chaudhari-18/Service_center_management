"""
Request correlation middleware.

Injects an X-Request-ID header into every request (generating one if absent)
and echoes it back in the response. This lets you join Django logs with
frontend Sentry events and nginx access logs by searching for the same ID.
"""

import uuid
from django.utils.deprecation import MiddlewareMixin
from tenancy.db_context import reset_tenant_context


REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"
RESPONSE_HEADER = "X-Request-ID"


class RequestIDMiddleware(MiddlewareMixin):
    """Attach a correlation ID to every request/response cycle."""

    def process_request(self, request):
        # Accept an ID forwarded by the frontend/load-balancer, or mint a new one.
        request_id = request.META.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        request.request_id = request_id

    def process_response(self, request, response):
        request_id = getattr(request, "request_id", None)
        if request_id:
            response[RESPONSE_HEADER] = request_id
        reset_tenant_context()
        return response

    def process_exception(self, request, exception):
        reset_tenant_context()
        return None
