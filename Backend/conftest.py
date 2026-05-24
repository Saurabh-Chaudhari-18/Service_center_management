import uuid

import pytest
from django.contrib.auth import get_user_model

from core.models import Organization, Branch, Role, RolePermission

User = get_user_model()


@pytest.fixture
def org(db):
    return Organization.objects.create(
        name='Test Org',
        legal_name='Test Org Pvt Ltd',
        email='org@test.com',
        phone='+919999999999',
        address_line1='123 Main St',
        city='Mumbai',
        state='Maharashtra',
        pincode='400001',
        pan_number='AABCT1332L',
    )


@pytest.fixture
def branch(org):
    return Branch.objects.create(
        organization=org,
        name='Main Branch',
        code='MUM',
        email='mum@test.com',
        phone='+919999999998',
        address_line1='123 Main St',
        city='Mumbai',
        state='Maharashtra',
        pincode='400001',
        gstin='27AABCT1332L1ZV',
        state_code='27',
    )


@pytest.fixture
def make_user(branch):
    def _make(role=Role.TECHNICIAN, **kwargs):
        uid = uuid.uuid4().hex[:10]
        assign_branch = kwargs.pop('branch', None)
        defaults = dict(
            email=f'{role.lower()}_{uid}@test.com',
            password='testpass123',
            first_name='Test',
            last_name=role.title(),
            role=role,
            organization=branch.organization,
            is_active=True,
        )
        defaults.update(kwargs)
        user = User.objects.create_user(**defaults)
        user.branches.set([assign_branch] if assign_branch is not None else [branch])
        return user

    return _make


@pytest.fixture
def owner(make_user):
    return make_user(role=Role.OWNER)


@pytest.fixture
def technician(make_user):
    return make_user(role=Role.TECHNICIAN)


@pytest.fixture
def accountant(make_user):
    return make_user(role=Role.ACCOUNTANT)


@pytest.fixture
def manager(make_user):
    return make_user(role=Role.MANAGER)


@pytest.fixture
def receptionist(make_user):
    return make_user(role=Role.RECEPTIONIST)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def auth_client(api_client, owner):
    api_client.force_authenticate(user=owner)
    return api_client


@pytest.fixture
def seed_permissions(db):
    """Ensure RolePermission rows exist (mirrors data migration 0005)."""
    defaults = {
        Role.OWNER: dict(
            can_view_dashboard=True,
            can_view_job_cards=True,
            can_create_job_cards=True,
            can_edit_job_cards=True,
            can_view_inventory=True,
            can_manage_inventory=True,
            can_view_billing=True,
            can_create_invoices=True,
            can_view_reports=True,
            can_manage_branches=True,
            can_manage_users=True,
            can_view_pickups=True,
        ),
        Role.TECHNICIAN: dict(
            can_view_dashboard=True,
            can_view_job_cards=True,
            can_create_job_cards=False,
            can_edit_job_cards=True,
            can_view_inventory=False,
            can_manage_inventory=False,
            can_view_billing=False,
            can_create_invoices=False,
            can_view_reports=False,
            can_manage_branches=False,
            can_manage_users=False,
            can_view_pickups=True,
        ),
        Role.ACCOUNTANT: dict(
            can_view_dashboard=True,
            can_view_job_cards=False,
            can_create_job_cards=False,
            can_edit_job_cards=False,
            can_view_inventory=False,
            can_manage_inventory=False,
            can_view_billing=True,
            can_create_invoices=True,
            can_view_reports=True,
            can_manage_branches=False,
            can_manage_users=False,
            can_view_pickups=False,
        ),
        Role.RECEPTIONIST: dict(
            can_view_dashboard=True,
            can_view_job_cards=True,
            can_create_job_cards=True,
            can_edit_job_cards=True,
            can_view_inventory=False,
            can_manage_inventory=False,
            can_view_billing=False,
            can_create_invoices=False,
            can_view_reports=False,
            can_manage_branches=False,
            can_manage_users=False,
            can_view_pickups=True,
        ),
        Role.MANAGER: dict(
            can_view_dashboard=True,
            can_view_job_cards=True,
            can_create_job_cards=True,
            can_edit_job_cards=True,
            can_view_inventory=True,
            can_manage_inventory=True,
            can_view_billing=True,
            can_create_invoices=True,
            can_view_reports=True,
            can_manage_branches=False,
            can_manage_users=False,
            can_view_pickups=True,
        ),
        Role.SUPER_ADMIN: dict(
            can_view_dashboard=True,
            can_view_job_cards=True,
            can_create_job_cards=True,
            can_edit_job_cards=True,
            can_view_inventory=True,
            can_manage_inventory=True,
            can_view_billing=True,
            can_create_invoices=True,
            can_view_reports=True,
            can_manage_branches=True,
            can_manage_users=True,
            can_view_pickups=True,
        ),
    }
    for role, perms in defaults.items():
        RolePermission.objects.update_or_create(role=role, defaults=perms)
