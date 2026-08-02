"""
JWT authentication views with login throttling, audit logging, and secure cookies.
"""

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from audit.services import AuditLogService
from core.simplejwt_serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from core.serializers import EmptySerializer


def _set_refresh_cookie(response, refresh_token: str) -> None:
    """Store refresh token in an httpOnly cookie (API domain)."""
    max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='None' if not settings.DEBUG else 'Lax',
        path='/',
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path='/',
        samesite='None' if not settings.DEBUG else 'Lax',
    )


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login endpoint with scoped rate limiting and login audit trail."""
    throttle_scope = 'login'
    serializer_class = TokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        from rest_framework.exceptions import AuthenticationFailed

        serializer = self.get_serializer(data=request.data)
        email = request.data.get('email', '')

        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed:
            AuditLogService.log_login(
                email=email,
                success=False,
                failure_reason='Invalid credentials',
                request=request,
            )
            raise

        AuditLogService.log_login(
            email=email,
            success=True,
            user=serializer.user,
            request=request,
        )

        response_data = dict(serializer.validated_data)
        refresh = response_data.pop('refresh', None)
        response = Response(response_data, status=status.HTTP_200_OK)
        if refresh:
            _set_refresh_cookie(response, refresh)
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    """Refresh endpoint — accepts refresh token from body or httpOnly cookie."""
    throttle_scope = 'token_refresh'
    serializer_class = TokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = request.data.get('refresh') or request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )
        if response.status_code == 200 and refresh:
            new_refresh = response.data.get('refresh')
            if new_refresh:
                _set_refresh_cookie(response, new_refresh)
                response.data.pop('refresh', None)
        return response


class ThrottledTokenVerifyView(TokenVerifyView):
    """Token verify with standard authentication."""
    throttle_scope = 'login'


class LogoutView(APIView):
    """Blacklist refresh token and clear auth cookie."""
    permission_classes = [IsAuthenticated]
    serializer_class = EmptySerializer

    def post(self, request):
        refresh = (
            request.data.get('refresh')
            or request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
        )
        if refresh:
            try:
                RefreshToken(refresh).blacklist()
            except Exception:
                pass

        response = Response({'message': 'Logged out successfully.'})
        _clear_refresh_cookie(response)
        return response


class ThrottledPublicTrackingMixin:
    """Mixin for public endpoints that need scoped throttling."""
    throttle_scope = 'public_track'
