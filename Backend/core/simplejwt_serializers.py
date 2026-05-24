"""Custom SimpleJWT serializers — handle edge cases the stock serializers omit."""

from django.conf import settings
from django.contrib.auth import get_user_model

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer as BaseTokenObtainPairSerializer,
    TokenRefreshSerializer as BaseTokenRefreshSerializer,
)

User = get_user_model()


class TokenObtainPairSerializer(BaseTokenObtainPairSerializer):
    """Email-based login using the custom User model."""

    username_field = User.USERNAME_FIELD


class TokenRefreshSerializer(BaseTokenRefreshSerializer):
    """Turn stale refresh tokens (user deleted / DB wiped) into 401 instead of 500."""

    def validate(self, attrs):
        request = self.context.get('request')
        if request and not attrs.get('refresh'):
            cookie_refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME)
            if cookie_refresh:
                attrs = {**attrs, 'refresh': cookie_refresh}

        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise AuthenticationFailed(
                self.error_messages['no_active_account'],
                code='no_active_account',
            )
