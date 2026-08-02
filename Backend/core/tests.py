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

        response = api_client.get('/api/jobs/', HTTP_X_BRANCH_ID=str(branch.id))
        payload = response.data
        job_ids = [j['id'] for j in payload.get('results', payload)]
        assert str(job.id) not in job_ids

    def test_unsafe_body_cannot_select_unassigned_branch(
        self, api_client, make_user, branch, org, seed_permissions,
    ):
        from core.models import Branch
        from customers.models import Customer

        other_branch = Branch.objects.create(
            organization=org, name='Body Branch', code='BLR',
            email='blr@test.com', phone='+919999999996',
            address_line1='789 Other St', city='Bengaluru',
            state='Karnataka', pincode='560001',
            gstin='29AABCT1332L1ZV', state_code='29',
        )
        receptionist = make_user(role=Role.RECEPTIONIST, branch=branch)
        api_client.force_authenticate(user=receptionist)

        response = api_client.post('/api/customers/', {
            'branch': str(other_branch.id),
            'first_name': 'Cross',
            'last_name': 'Branch',
            'mobile': '9888888888',
        }, format='json', HTTP_X_BRANCH_ID=str(branch.id))

        assert response.status_code == 403
        assert not Customer.objects.filter(first_name='Cross', last_name='Branch').exists()

    def test_invoice_rejects_customer_from_another_branch(
        self, api_client, make_user, branch, org, seed_permissions,
    ):
        from core.models import Branch
        from customers.models import Customer
        from billing.models import Invoice

        other_branch = Branch.objects.create(
            organization=org, name='Invoice Branch', code='CHE',
            email='che@test.com', phone='+919999999995',
            address_line1='100 Other St', city='Chennai',
            state='Tamil Nadu', pincode='600001',
            gstin='33AABCT1332L1ZV', state_code='33',
        )
        other_customer = Customer.objects.create(
            branch=other_branch, first_name='Other', last_name='Invoice',
            mobile='+919777777777',
        )
        accountant = make_user(role=Role.ACCOUNTANT, branch=branch)
        api_client.force_authenticate(user=accountant)

        response = api_client.post('/api/billing/invoices/', {
            'customer_id': str(other_customer.id),
            'customer_name': 'Other Invoice',
            'is_interstate': False,
        }, format='json', HTTP_X_BRANCH_ID=str(branch.id))

        assert response.status_code == 400
        assert not Invoice.objects.filter(customer_name='Other Invoice').exists()
