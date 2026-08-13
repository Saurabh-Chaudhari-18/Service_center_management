"""
Authentication flow tests.

Covers: login, wrong credentials, inactive user, token refresh,
bearer token usage, and unauthenticated rejection.

All tests go through the HTTP layer — no model methods called directly.
"""
import pytest
from django.conf import settings
from django.test import override_settings

TOKEN_URL = '/api/auth/token/'
REFRESH_URL = '/api/auth/token/refresh/'
JOBS_URL = '/api/jobs/'


@pytest.mark.django_db
class TestLogin:

    def test_valid_credentials_return_access_and_secure_refresh_cookie(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 200
        assert resp.data['authenticated'] is True
        assert 'access' not in resp.data
        assert 'refresh' not in resp.data
        cookie = resp.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        assert cookie.value
        assert cookie['httponly'] is True
        access_cookie = resp.cookies[settings.JWT_ACCESS_COOKIE_NAME]
        assert access_cookie.value
        assert access_cookie['httponly'] is True

    @override_settings(DEBUG=False, JWT_COOKIE_SAMESITE='None', JWT_COOKIE_SECURE=True)
    def test_production_login_cookies_support_cross_site_requests(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 200

        refresh_cookie = resp.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        access_cookie = resp.cookies[settings.JWT_ACCESS_COOKIE_NAME]
        assert refresh_cookie['samesite'] == 'None'
        assert refresh_cookie['secure'] is True
        assert access_cookie['samesite'] == 'None'
        assert access_cookie['secure'] is True

    @override_settings(DEBUG=True, JWT_COOKIE_SAMESITE='Lax', JWT_COOKIE_SECURE=False)
    def test_hosted_frontend_origin_forces_cross_site_cookies(self, api_client, owner):
        resp = api_client.post(
            TOKEN_URL,
            {'email': owner.email, 'password': 'testpass123'},
            format='json',
            HTTP_ORIGIN='https://service-center-management.vercel.app',
        )
        assert resp.status_code == 200

        refresh_cookie = resp.cookies[settings.JWT_REFRESH_COOKIE_NAME]
        access_cookie = resp.cookies[settings.JWT_ACCESS_COOKIE_NAME]
        assert refresh_cookie['samesite'] == 'None'
        assert refresh_cookie['secure'] is True
        assert access_cookie['samesite'] == 'None'
        assert access_cookie['secure'] is True

    def test_wrong_password_returns_401(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'WRONG'}, format='json')
        assert resp.status_code == 401

    def test_nonexistent_email_returns_401(self, api_client):
        resp = api_client.post(TOKEN_URL, {'email': 'ghost@test.com', 'password': 'any'}, format='json')
        assert resp.status_code == 401

    def test_inactive_user_cannot_login(self, api_client, make_user):
        from core.models import Role
        inactive = make_user(role=Role.TECHNICIAN, is_active=False)
        resp = api_client.post(TOKEN_URL, {'email': inactive.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 401

    def test_missing_password_returns_400(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email}, format='json')
        assert resp.status_code == 400

    def test_missing_email_returns_400(self, api_client):
        resp = api_client.post(TOKEN_URL, {'password': 'testpass123'}, format='json')
        assert resp.status_code == 400

    def test_empty_body_returns_400(self, api_client):
        resp = api_client.post(TOKEN_URL, {}, format='json')
        assert resp.status_code == 400


@pytest.mark.django_db
class TestTokenRefresh:

    def _login(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 200
        assert settings.JWT_REFRESH_COOKIE_NAME in resp.cookies
        return resp.cookies[settings.JWT_ACCESS_COOKIE_NAME].value

    def test_valid_refresh_token_returns_new_access_token(self, api_client, owner):
        access1 = self._login(api_client, owner)
        resp = api_client.post(REFRESH_URL, {}, format='json')
        assert resp.status_code == 200
        assert resp.data['authenticated'] is True
        assert settings.JWT_ACCESS_COOKIE_NAME in resp.cookies

    def test_refresh_returns_different_access_token(self, api_client, owner):
        access1 = self._login(api_client, owner)
        resp = api_client.post(REFRESH_URL, {}, format='json')
        assert resp.cookies[settings.JWT_ACCESS_COOKIE_NAME].value != access1

    def test_invalid_refresh_token_returns_401(self, api_client):
        resp = api_client.post(REFRESH_URL, {'refresh': 'not.a.token'}, format='json')
        assert resp.status_code == 401

    def test_missing_refresh_token_returns_unauthenticated_session(self, api_client):
        resp = api_client.post(REFRESH_URL, {}, format='json')
        assert resp.status_code == 200
        assert resp.data == {'authenticated': False}

    def test_refresh_for_deleted_user_returns_401(self, api_client, owner):
        from audit.models import LoginLog

        self._login(api_client, owner)
        LoginLog.objects.filter(user=owner).delete()
        owner.delete()
        resp = api_client.post(REFRESH_URL, {}, format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestBearerTokenAccess:

    def test_unauthenticated_request_returns_401(self, api_client, branch):
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 401

    def test_valid_bearer_token_grants_access(self, api_client, owner, branch, seed_permissions):
        login = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        api_client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {login.cookies[settings.JWT_ACCESS_COOKIE_NAME].value}'
        )
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 200

    def test_malformed_bearer_token_returns_401(self, api_client, branch):
        api_client.credentials(HTTP_AUTHORIZATION='Bearer garbage.token.here')
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 401

    def test_bearer_token_without_branch_header_still_authenticates(self, api_client, owner, seed_permissions):
        login = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        api_client.credentials(
            HTTP_AUTHORIZATION=f'Bearer {login.cookies[settings.JWT_ACCESS_COOKIE_NAME].value}'
        )
        resp = api_client.get(JOBS_URL)
        # Should be 200 or 400 (missing branch), never 401
        assert resp.status_code != 401

    def test_http_only_access_cookie_grants_access(
        self, api_client, owner, branch, seed_permissions
    ):
        login = api_client.post(
            TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json'
        )
        assert settings.JWT_ACCESS_COOKIE_NAME in login.cookies
        response = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert response.status_code == 200
