import pytest
from django.db import IntegrityError

from customers.models import Customer


# ─── Helpers ────────────────────────────────────────────────────────────────


def _make_customer(branch, mobile="9000000001", first_name="Test", last_name="Customer"):
    return Customer.objects.create(
        branch=branch,
        first_name=first_name,
        last_name=last_name,
        mobile=mobile,
    )


# ─── Model unit tests ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCustomerModel:
    def test_get_full_name(self, branch):
        c = _make_customer(branch, first_name="Asha", last_name="Rao")
        assert c.get_full_name() == "Asha Rao"

    def test_get_full_name_no_last_name(self, branch):
        c = Customer.objects.create(branch=branch, first_name="Ravi", mobile="9100000001")
        assert c.get_full_name() == "Ravi"

    def test_str(self, branch):
        c = _make_customer(branch, mobile="9200000001", first_name="Jay", last_name="Dev")
        assert "Jay Dev" in str(c)
        assert "9200000001" in str(c)

    def test_get_service_history_empty(self, branch):
        c = _make_customer(branch, mobile="9300000001")
        assert list(c.get_service_history()) == []

    def test_get_pending_jobs_empty(self, branch):
        c = _make_customer(branch, mobile="9400000001")
        assert list(c.get_pending_jobs()) == []

    def test_get_total_spent_no_invoices(self, branch):
        c = _make_customer(branch, mobile="9500000001")
        assert c.get_total_spent() == 0


# ─── Uniqueness constraints ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestCustomerBranchConstraint:
    def test_duplicate_mobile_same_branch_raises(self, branch):
        _make_customer(branch, mobile="9600000001")
        with pytest.raises(IntegrityError):
            _make_customer(branch, mobile="9600000001")

    def test_same_mobile_different_branch_allowed(self, org, branch):
        from core.models import Branch

        branch2 = Branch.objects.create(
            organization=org,
            name="Branch 2",
            code="B2",
            email="b2@test.com",
            phone="+919999999990",
            address_line1="456 Side St",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
            gstin="27AABCT1332L1ZW",
            state_code="27",
        )
        c1 = _make_customer(branch, mobile="9700000001")
        c2 = _make_customer(branch2, mobile="9700000001")
        assert c1.pk != c2.pk


# ─── API tests ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCustomerAPI:
    LIST_URL = "/api/customers/"

    def test_list_requires_auth(self, api_client):
        resp = api_client.get(self.LIST_URL)
        assert resp.status_code == 401

    def test_list_returns_branch_customers(self, auth_client, branch, seed_permissions):
        _make_customer(branch, mobile="9800000001")
        _make_customer(branch, mobile="9800000002")
        resp = auth_client.get(self.LIST_URL)
        assert resp.status_code == 200
        data = resp.json()
        results = data.get("results", data)
        assert len(results) >= 2

    def test_create_customer(self, auth_client, branch, seed_permissions):
        payload = {
            "first_name": "Priya",
            "last_name": "Sharma",
            "mobile": "9810000001",
            "branch": str(branch.id),
        }
        resp = auth_client.post(self.LIST_URL, payload, format="json")
        assert resp.status_code == 201
        assert resp.json()["first_name"] == "Priya"

    def test_create_duplicate_mobile_same_branch_returns_400(
        self, auth_client, branch, seed_permissions
    ):
        _make_customer(branch, mobile="9810000002")
        payload = {
            "first_name": "Other",
            "last_name": "Person",
            "mobile": "9810000002",
            "branch": str(branch.id),
        }
        resp = auth_client.post(self.LIST_URL, payload, format="json")
        assert resp.status_code in (400, 409)

    def test_retrieve_customer(self, auth_client, branch, seed_permissions):
        c = _make_customer(branch, mobile="9810000003")
        resp = auth_client.get(f"{self.LIST_URL}{c.id}/")
        assert resp.status_code == 200
        assert resp.json()["id"] == str(c.id)

    def test_update_customer(self, auth_client, branch, seed_permissions):
        c = _make_customer(branch, mobile="9810000004")
        resp = auth_client.patch(
            f"{self.LIST_URL}{c.id}/", {"last_name": "Updated"}, format="json"
        )
        assert resp.status_code == 200
        assert resp.json()["last_name"] == "Updated"

    def test_search_by_mobile(self, auth_client, branch, seed_permissions):
        _make_customer(branch, mobile="9820000001")
        resp = auth_client.get(f"{self.LIST_URL}search-by-mobile/?mobile=9820000001")
        assert resp.status_code == 200
        results = resp.json()
        assert any("9820000001" in r["mobile"] for r in results)


# ─── Deletion / anonymization ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestCustomerRequestDeletion:
    def test_anonymises_pii(self, auth_client, branch, seed_permissions):
        c = _make_customer(branch, mobile="9830000001", first_name="Vivek", last_name="Shah")
        resp = auth_client.post(f"/api/customers/{c.id}/request-deletion/")
        assert resp.status_code == 200
        c.refresh_from_db()
        # PII should be replaced; original name no longer stored
        assert "Vivek" not in c.first_name
        assert "Shah" not in c.last_name

    def test_blocked_when_open_jobs_exist(self, auth_client, branch, owner, seed_permissions):
        from jobs.models import JobCard, JobStatus

        c = _make_customer(branch, mobile="9830000002")
        JobCard.objects.create(
            branch=branch,
            customer=c,
            brand="Dell",
            model="Inspiron",
            customer_complaint="Won't boot",
            status=JobStatus.RECEIVED,
            received_by=owner,
        )
        resp = auth_client.post(f"/api/customers/{c.id}/request-deletion/")
        assert resp.status_code == 409
