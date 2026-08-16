from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.authentication import SessionAuthentication

from tenancy.db_context import activate_tenant_context


class CookieJWTAuthentication(JWTAuthentication):
    """Authenticate either an API bearer token or the signed HTTP-only cookie."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            result = super().authenticate(request)
            if result:
                activate_tenant_context(result[0])
            return result

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            return None
        self._validate_browser_origin(request)
        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        activate_tenant_context(user)
        return user, validated_token

    @staticmethod
    def _validate_browser_origin(request):
        if request.method in ('GET', 'HEAD', 'OPTIONS', 'TRACE'):
            return
        origin = request.headers.get('Origin')
        if not origin:
            referer = request.headers.get('Referer')
            if referer:
                from urllib.parse import urlparse
                parsed = urlparse(referer)
                if parsed.scheme and parsed.netloc:
                    origin = f"{parsed.scheme}://{parsed.netloc}"
        if not origin:
            return

        allowed = set(getattr(settings, 'CORS_ALLOWED_ORIGINS', [])) | set(
            getattr(settings, 'CSRF_TRUSTED_ORIGINS', [])
        )
        if origin in allowed:
            return

        import re
        regexes = getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', [])
        for pattern in regexes:
            if re.match(pattern, origin):
                return

        import fnmatch
        for trusted in getattr(settings, 'CSRF_TRUSTED_ORIGINS', []):
            if '*' in trusted:
                if fnmatch.fnmatch(origin, trusted):
                    return

        if getattr(settings, 'CORS_ALLOW_ALL_ORIGINS', False) or getattr(settings, 'CORS_ORIGIN_ALLOW_ALL', False):
            return

        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            'Untrusted request origin rejected: origin=%s, allowed=%s, regexes=%s',
            origin, allowed, regexes,
        )
        raise AuthenticationFailed('Untrusted request origin.')


class TenantSessionAuthentication(SessionAuthentication):
    """Activate the same database tenant boundary for Django sessions."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            activate_tenant_context(result[0])
        return result
