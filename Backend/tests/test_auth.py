"""
Authentication flow tests.

Covers: login, wrong credentials, inactive user, token refresh,
bearer token usage, and unauthenticated rejection.

All tests go through the HTTP layer — no model methods called directly.
"""
import pytest

TOKEN_URL = '/api/auth/token/'
REFRESH_URL = '/api/auth/token/refresh/'
JOBS_URL = '/api/jobs/jobs/'


@pytest.mark.django_db
class TestLogin:

    def test_valid_credentials_return_access_and_refresh_tokens(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 200
        assert 'access' in resp.data
        assert 'refresh' in resp.data
        assert len(resp.data['access']) > 20

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

    def _get_tokens(self, api_client, owner):
        resp = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        assert resp.status_code == 200
        return resp.data['access'], resp.data['refresh']

    def test_valid_refresh_token_returns_new_access_token(self, api_client, owner):
        access1, refresh = self._get_tokens(api_client, owner)
        resp = api_client.post(REFRESH_URL, {'refresh': refresh}, format='json')
        assert resp.status_code == 200
        assert 'access' in resp.data

    def test_refresh_returns_different_access_token(self, api_client, owner):
        access1, refresh = self._get_tokens(api_client, owner)
        resp = api_client.post(REFRESH_URL, {'refresh': refresh}, format='json')
        assert resp.data['access'] != access1

    def test_invalid_refresh_token_returns_401(self, api_client):
        resp = api_client.post(REFRESH_URL, {'refresh': 'not.a.token'}, format='json')
        assert resp.status_code == 401

    def test_missing_refresh_token_returns_400(self, api_client):
        resp = api_client.post(REFRESH_URL, {}, format='json')
        assert resp.status_code == 400

    def test_refresh_for_deleted_user_returns_401(self, api_client, owner):
        _, refresh = self._get_tokens(api_client, owner)
        owner.delete()
        resp = api_client.post(REFRESH_URL, {'refresh': refresh}, format='json')
        assert resp.status_code == 401


@pytest.mark.django_db
class TestBearerTokenAccess:

    def test_unauthenticated_request_returns_401(self, api_client, branch):
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 401

    def test_valid_bearer_token_grants_access(self, api_client, owner, branch, seed_permissions):
        login = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 200

    def test_malformed_bearer_token_returns_401(self, api_client, branch):
        api_client.credentials(HTTP_AUTHORIZATION='Bearer garbage.token.here')
        resp = api_client.get(JOBS_URL, HTTP_X_BRANCH_ID=str(branch.id))
        assert resp.status_code == 401

    def test_bearer_token_without_branch_header_still_authenticates(self, api_client, owner, seed_permissions):
        login = api_client.post(TOKEN_URL, {'email': owner.email, 'password': 'testpass123'}, format='json')
        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {login.data["access"]}')
        resp = api_client.get(JOBS_URL)
        # Should be 200 or 400 (missing branch), never 401
        assert resp.status_code != 401
