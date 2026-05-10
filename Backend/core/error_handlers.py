"""
Unified API error envelope for DRF responses.

Shape: { "success": false, "error": { "code", "message", "status_code", ... } }
Validation errors also include "fields" (DRF serializer errors dict).
"""

from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None

    status_code = response.status_code
    raw = response.data

    code = getattr(exc, 'default_code', 'error')
    if hasattr(exc, 'default_code'):
        code = exc.default_code

    if isinstance(exc, ValidationError):
        # May be dict (field errors), list, or nested structure
        if isinstance(raw, dict):
            return Response(
                {
                    'success': False,
                    'error': {
                        'code': 'validation_error',
                        'message': 'Input validation failed.',
                        'fields': raw,
                        'status_code': status_code,
                    },
                },
                status=status_code,
                headers=dict(response.items()),
            )
        detail = raw if isinstance(raw, (list, str)) else str(raw)
        if isinstance(detail, list):
            message = '; '.join(str(x) for x in detail)
        else:
            message = str(detail)
        return Response(
            {
                'success': False,
                'error': {
                    'code': code,
                    'message': message,
                    'status_code': status_code,
                },
            },
            status=status_code,
            headers=dict(response.items()),
        )

    message = ''
    detail = raw
    if isinstance(raw, dict) and 'detail' in raw:
        detail = raw['detail']

    if isinstance(detail, list):
        message = '; '.join(str(x) for x in detail)
    elif isinstance(detail, dict):
        message = str(detail)
    else:
        message = str(detail)

    return Response(
        {
            'success': False,
            'error': {
                'code': code,
                'message': message,
                'status_code': status_code,
            },
        },
        status=status_code,
        headers=dict(response.items()),
    )
