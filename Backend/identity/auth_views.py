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
from identity.simplejwt_serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from core.serializers import EmptySerializer


def _set_refresh_cookie(response, refresh_token: str) -> None:
    """Store refresh token in an httpOnly cookie (API domain)."""
    max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
    cookie_samesite = settings.JWT_COOKIE_SAMESITE
    response.set_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite=cookie_samesite,
        path='/',
    )


def _set_access_cookie(response, access_token: str) -> None:
    max_age = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    cookie_samesite = settings.JWT_COOKIE_SAMESITE
    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite=cookie_samesite,
        path='/',
    )


def _clear_refresh_cookie(response) -> None:
    cookie_samesite = settings.JWT_COOKIE_SAMESITE
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path='/',
        samesite=cookie_samesite,
    )
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        path='/',
        samesite=cookie_samesite,
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
        access = response_data.pop('access', None)
        response_data['authenticated'] = bool(access)
        response = Response(response_data, status=status.HTTP_200_OK)
        if refresh:
            _set_refresh_cookie(response, refresh)
        if access:
            _set_access_cookie(response, access)
        return response


class ThrottledTokenRefreshView(TokenRefreshView):
    """Refresh endpoint — accepts refresh token from body or httpOnly cookie."""
    throttle_scope = 'token_refresh'
    serializer_class = TokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        refresh = request.data.get('refresh') or request.COOKIES.get(
            settings.JWT_REFRESH_COOKIE_NAME
        )
        if not refresh:
            return Response({'authenticated': False}, status=status.HTTP_200_OK)

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200 and refresh:
            access = response.data.pop('access', None)
            new_refresh = response.data.get('refresh')
            if new_refresh:
                _set_refresh_cookie(response, new_refresh)
                response.data.pop('refresh', None)
            if access:
                _set_access_cookie(response, access)
            response.data['authenticated'] = bool(access)
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
