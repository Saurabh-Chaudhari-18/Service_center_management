"""Custom SimpleJWT serializers — handle edge cases the stock serializers omit."""

from django.contrib.auth import get_user_model

from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer as BaseTokenRefreshSerializer

User = get_user_model()


class TokenRefreshSerializer(BaseTokenRefreshSerializer):
    """Turn stale refresh tokens (user deleted / DB wiped) into 401 instead of 500."""

    def validate(self, attrs):
        try:
            return super().validate(attrs)
        except User.DoesNotExist:
            raise AuthenticationFailed(
                self.error_messages['no_active_account'],
                code='no_active_account',
            )
