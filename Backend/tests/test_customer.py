"""
Customer management integration tests.

Business rules verified:
  - Mobile number is unique per branch (same mobile → 400)
  - Same mobile allowed in different branches (→ 201)
  - Branch isolation: customers of other branches not visible
  - search_by_mobile returns correct customer
  - service_history returns all jobs for the customer
  - Customer with open jobs cannot be anonymised (Task 12)
"""
import pytest
from customers.models import Customer
from tests.conftest import bh

CUSTOMERS_URL = '/api/customers/customers/'


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateCustomer:

    def test_create_customer_returns_201(self, auth_client, branch):
        resp = auth_client.post(CUSTOMERS_URL, {
            'first_name': 'Amit',
            'last_name': 'Patel',
            'mobile': '9100000001',
        }, format='json', **bh(branch))
        assert resp.status_code == 201

    def test_create_customer_without_mobile_returns_400(self, auth_client, branch):
        resp = auth_client.post(CUSTOMERS_URL, {
            'first_name': 'No',
            'last_name': 'Phone',
        }, format='json', **bh(branch))
        assert resp.status_code == 400

    def test_duplicate_mobile_same_branch_returns_400(self, auth_client, branch):
        auth_client.post(CUSTOMERS_URL, {
            'first_name': 'First',
            'mobile': '9100000002',
        }, format='json', **bh(branch))
        resp = auth_client.post(CUSTOMERS_URL, {
            'first_name': 'Duplicate',
            'mobile': '9100000002',
        }, format='json', **bh(branch))
        assert resp.status_code == 400

    def test_same_mobile_in_different_branch_is_allowed(self, auth_client, org, branch):
        from core.models import Branch
        other = Branch.objects.create(
            organization=org, name='Branch B', code='BBB',
            email='bbb@test.com', phone='+919000000099',
            address_line1='Z', city='Nagpur', state='Maharashtra',
            pincode='440001', gstin='27AABCT1332L3ZV', state_code='27',
        )
        auth_client.post(CUSTOMERS_URL, {
            'first_name': 'Original',
            'mobile': '9100000003',
        }, format='json', **bh(branch))
        resp = auth_client.post(CUSTOMERS_URL, {
            'first_name': 'Duplicate in other branch',
            'mobile': '9100000003',
        }, format='json', HTTP_X_BRANCH_ID=str(other.id))
        assert resp.status_code == 201

    def test_customer_created_with_correct_branch(self, auth_client, branch):
        resp = auth_client.post(CUSTOMERS_URL, {
            'first_name': 'Branch',
            'last_name': 'Check',
            'mobile': '9100000004',
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        cust = Customer.objects.get(id=resp.data['id'])
        assert cust.branch == branch


# ─────────────────────────────────────────────────────────────────────────────
# Search by mobile
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSearchByMobile:

    def test_search_by_mobile_returns_correct_customer(
        self, auth_client, make_customer, branch
    ):
        cust = make_customer(mobile='9200000001')
        resp = auth_client.get(
            f'{CUSTOMERS_URL}search_by_mobile/',
            {'mobile': '9200000001'},
            **bh(branch),
        )
        assert resp.status_code == 200
        # Response may be a single object or a list
        data = resp.data
        if isinstance(data, list):
            ids = [str(c['id']) for c in data]
            assert str(cust.id) in ids
        else:
            assert str(data['id']) == str(cust.id)

    def test_search_returns_nothing_for_unknown_mobile(self, auth_client, branch):
        resp = auth_client.get(
            f'{CUSTOMERS_URL}search_by_mobile/',
            {'mobile': '0000000000'},
            **bh(branch),
        )
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            data = resp.data
            count = len(data) if isinstance(data, list) else (0 if not data else 1)
            assert count == 0

    def test_search_does_not_return_other_branch_customer(
        self, auth_client, make_customer, org, branch
    ):
        from core.models import Branch
        other = Branch.objects.create(
            organization=org, name='Other', code='OTH',
            email='oth@test.com', phone='+919000000098',
            address_line1='A', city='Delhi', state='Delhi',
            pincode='110001', gstin='07AABCT1332L1ZV', state_code='07',
        )
        cust = make_customer(mobile='9200000002', b=other)
        resp = auth_client.get(
            f'{CUSTOMERS_URL}search_by_mobile/',
            {'mobile': '9200000002'},
            **bh(branch),
        )
        if resp.status_code == 200:
            data = resp.data
            ids = [str(c['id']) for c in data] if isinstance(data, list) else []
            assert str(cust.id) not in ids


# ─────────────────────────────────────────────────────────────────────────────
# Service history
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestServiceHistory:

    def test_service_history_returns_jobs_for_customer(
        self, auth_client, make_customer, make_job, branch
    ):
        cust = make_customer()
        j1 = make_job(cust)
        j2 = make_job(cust)
        resp = auth_client.get(
            f'{CUSTOMERS_URL}{cust.id}/service_history/',
            **bh(branch),
        )
        assert resp.status_code == 200
        job_ids = [str(j['id']) for j in resp.data.get('results', resp.data)]
        assert str(j1.id) in job_ids
        assert str(j2.id) in job_ids

    def test_service_history_does_not_include_other_customer_jobs(
        self, auth_client, make_customer, make_job, branch
    ):
        cust1 = make_customer(mobile='9300000001')
        cust2 = make_customer(mobile='9300000002')
        j_for_cust2 = make_job(cust2)
        resp = auth_client.get(
            f'{CUSTOMERS_URL}{cust1.id}/service_history/',
            **bh(branch),
        )
        assert resp.status_code == 200
        job_ids = [str(j['id']) for j in resp.data.get('results', resp.data)]
        assert str(j_for_cust2.id) not in job_ids


# ─────────────────────────────────────────────────────────────────────────────
# Branch isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCustomerBranchIsolation:

    def test_customer_from_other_branch_not_in_list(
        self, api_client, owner, org, branch, seed_permissions
    ):
        from core.models import Branch
        other = Branch.objects.create(
            organization=org, name='Hidden', code='HID',
            email='hid@test.com', phone='+919000000097',
            address_line1='B', city='Chennai', state='Tamil Nadu',
            pincode='600001', gstin='33AABCT1332L1ZV', state_code='33',
        )
        hidden_cust = Customer.objects.create(
            branch=other, first_name='Hidden', mobile='9400000001',
        )
        api_client.force_authenticate(user=owner)
        resp = api_client.get(CUSTOMERS_URL, **bh(branch))
        assert resp.status_code == 200
        ids = [str(c['id']) for c in resp.data.get('results', resp.data)]
        assert str(hidden_cust.id) not in ids


# ─────────────────────────────────────────────────────────────────────────────
# Customer anonymisation (Task 12)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCustomerAnonymisation:

    def test_anonymise_customer_with_no_open_jobs_returns_200(
        self, auth_client, make_customer, branch
    ):
        cust = make_customer(mobile='9500000001')
        resp = auth_client.post(
            f'{CUSTOMERS_URL}{cust.id}/request_deletion/',
            {},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200

    def test_anonymised_customer_pii_is_scrubbed(
        self, auth_client, make_customer, branch
    ):
        cust = make_customer(mobile='9500000002')
        auth_client.post(
            f'{CUSTOMERS_URL}{cust.id}/request_deletion/',
            {},
            format='json', **bh(branch),
        )
        cust.refresh_from_db()
        assert cust.mobile != '9500000002'
        assert 'deleted' in cust.first_name.lower() or cust.first_name == ''

    def test_anonymise_customer_with_open_jobs_returns_409(
        self, auth_client, make_customer, make_job, branch
    ):
        from jobs.models import JobStatus
        cust = make_customer(mobile='9500000003')
        make_job(cust, status=JobStatus.REPAIR_IN_PROGRESS)
        resp = auth_client.post(
            f'{CUSTOMERS_URL}{cust.id}/request_deletion/',
            {},
            format='json', **bh(branch),
        )
        assert resp.status_code == 409
