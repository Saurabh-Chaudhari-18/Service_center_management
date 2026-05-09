import pytest

from core.models import Role, RolePermission
from django.core.cache import cache


@pytest.mark.django_db
class TestRBACMatrix:
    """Verify that RolePermission.get_permissions_for_role returns expected values."""

    def setup_method(self):
        cache.clear()

    def test_owner_has_full_billing(self, seed_permissions):
        perms = RolePermission.get_permissions_for_role(Role.OWNER)
        assert perms['canViewBilling'] is True
        assert perms['canCreateInvoices'] is True

    def test_technician_cannot_view_billing(self, seed_permissions):
        perms = RolePermission.get_permissions_for_role(Role.TECHNICIAN)
        assert perms['canViewBilling'] is False
        assert perms['canCreateInvoices'] is False

    def test_accountant_cannot_create_jobs(self, seed_permissions):
        perms = RolePermission.get_permissions_for_role(Role.ACCOUNTANT)
        assert perms['canCreateJobCards'] is False
        assert perms['canViewBilling'] is True

    def test_receptionist_can_create_jobs(self, seed_permissions):
        perms = RolePermission.get_permissions_for_role(Role.RECEPTIONIST)
        assert perms['canCreateJobCards'] is True
        assert perms['canViewJobCards'] is True

    def test_owner_can_manage_users(self, seed_permissions):
        perms = RolePermission.get_permissions_for_role(Role.OWNER)
        assert perms['canManageUsers'] is True

    def test_missing_role_returns_all_false(self):
        perms = RolePermission.get_permissions_for_role('NONEXISTENT')
        assert all(v is False for v in perms.values())

    def test_permissions_cached(self, seed_permissions):
        RolePermission.get_permissions_for_role(Role.OWNER)
        cached = cache.get(f'role_perms_{Role.OWNER}')
        assert cached is not None
        assert cached['canViewBilling'] is True


@pytest.mark.django_db
class TestBranchIsolation:
    """Users must not see data from branches they cannot access."""

    def test_user_cannot_access_other_branch_jobs(self, api_client, make_user, branch, org):
        from core.models import Branch

        other_branch = Branch.objects.create(
            organization=org,
            name='Other Branch',
            code='DEL',
            email='del@test.com',
            phone='+919999999997',
            address_line1='456 Other St',
            city='Delhi',
            state='Delhi',
            pincode='110001',
            gstin='07AABCT1332L1ZV',
            state_code='07',
        )
        user_branch1 = make_user(role=Role.TECHNICIAN, branch=branch)
        api_client.force_authenticate(user=user_branch1)

        from customers.models import Customer
        from jobs.models import JobCard, JobStatus

        customer = Customer.objects.create(
            branch=other_branch,
            first_name='Other',
            last_name='Customer',
            mobile='9876543210',
        )
        job = JobCard.objects.create(
            branch=other_branch,
            customer=customer,
            brand='Apple',
            model='iPhone 13',
            customer_complaint='Screen cracked',
            status=JobStatus.RECEIVED,
            received_by=user_branch1,
        )

        response = api_client.get('/api/jobs/jobs/', HTTP_X_BRANCH_ID=str(branch.id))
        payload = response.data
        job_ids = [j['id'] for j in payload.get('results', payload)]
        assert str(job.id) not in job_ids
