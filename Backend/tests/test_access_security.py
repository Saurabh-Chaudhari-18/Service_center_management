"""
Access control security regression tests.
"""

import pytest

from core.models import Role

ORG_URL = '/api/core/organizations/'
USERS_URL = '/api/core/users/'
EXPENSES_URL = '/api/expenses/'
TOKEN_URL = '/api/auth/token/'


@pytest.mark.django_db
class TestOrganizationCreateRestriction:

    def test_technician_cannot_create_organization(self, api_client, technician, seed_permissions):
        api_client.force_authenticate(user=technician)
        resp = api_client.post(ORG_URL, {
            'name': 'Rogue Org',
            'owner_email': 'rogue@example.com',
            'owner_password': 'SecurePass123!',
            'owner_first_name': 'Rogue',
            'owner_last_name': 'User',
        }, format='json')
        assert resp.status_code == 403

    def test_super_admin_can_create_organization(self, api_client, make_user, seed_permissions):
        super_admin = make_user(role=Role.SUPER_ADMIN, organization=None)
        api_client.force_authenticate(user=super_admin)
        resp = api_client.post(ORG_URL, {
            'name': 'New Org',
            'legal_name': 'New Org Pvt Ltd',
            'email': 'neworg@example.com',
            'phone': '+919999999991',
            'address_line1': '1 Test Street',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'pincode': '400001',
            'country': 'India',
            'pan_number': 'AABCT1332M',
            'owner_email': 'newowner@example.com',
            'owner_password': 'SecurePass123!',
            'owner_first_name': 'New',
            'owner_last_name': 'Owner',
        }, format='json')
        assert resp.status_code == 201, resp.data


@pytest.mark.django_db
class TestUserRoleEscalation:

    def test_owner_cannot_promote_user_to_super_admin(
        self, api_client, owner, technician, seed_permissions,
    ):
        api_client.force_authenticate(user=owner)
        resp = api_client.patch(
            f'{USERS_URL}{technician.pk}/',
            {'role': Role.SUPER_ADMIN},
            format='json',
        )
        assert resp.status_code == 400

    def test_manager_cannot_promote_user_to_owner(
        self, api_client, manager, technician, seed_permissions,
    ):
        api_client.force_authenticate(user=manager)
        resp = api_client.patch(
            f'{USERS_URL}{technician.pk}/',
            {'role': Role.OWNER},
            format='json',
        )
        assert resp.status_code in (400, 403)

    def test_user_cannot_change_own_role(self, api_client, technician, seed_permissions):
        api_client.force_authenticate(user=technician)
        resp = api_client.patch(
            f'{USERS_URL}{technician.pk}/',
            {'role': Role.OWNER},
            format='json',
        )
        assert resp.status_code in (400, 403)


@pytest.mark.django_db
class TestFinanceAccessControl:

    def test_technician_cannot_create_expense(
        self, api_client, technician, branch, seed_permissions,
    ):
        api_client.force_authenticate(user=technician)
        resp = api_client.post(
            EXPENSES_URL,
            {
                'branch': str(branch.id),
                'title': 'Unauthorized',
                'amount': '100.00',
                'category': 'RENT',
                'expense_date': '2026-05-24',
            },
            format='json',
            HTTP_X_BRANCH_ID=str(branch.id),
        )
        assert resp.status_code == 403

    def test_accountant_can_create_expense(
        self, api_client, accountant, branch, seed_permissions,
    ):
        api_client.force_authenticate(user=accountant)
        resp = api_client.post(
            EXPENSES_URL,
            {
                'branch': str(branch.id),
                'title': 'Office rent',
                'amount': '5000.00',
                'category': 'RENT',
                'expense_date': '2026-05-24',
            },
            format='json',
            HTTP_X_BRANCH_ID=str(branch.id),
        )
        assert resp.status_code == 201


@pytest.mark.django_db
class TestLoginAudit:

    def test_failed_login_creates_login_log(self, api_client, owner):
        from audit.models import LoginLog

        before = LoginLog.objects.count()
        api_client.post(
            TOKEN_URL,
            {'email': owner.email, 'password': 'wrong-password'},
            format='json',
        )
        assert LoginLog.objects.count() == before + 1
        assert LoginLog.objects.latest('created_at').success is False

    def test_successful_login_creates_login_log(self, api_client, owner):
        from audit.models import LoginLog

        before = LoginLog.objects.count()
        resp = api_client.post(
            TOKEN_URL,
            {'email': owner.email, 'password': 'testpass123'},
            format='json',
        )
        assert resp.status_code == 200
        assert LoginLog.objects.count() == before + 1
        assert LoginLog.objects.latest('created_at').success is True
