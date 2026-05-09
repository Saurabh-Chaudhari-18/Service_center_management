"""
Billing RBAC enforcement tests.

Rules:
  - Technician: NO billing access (all invoice endpoints → 403)
  - Receptionist: NO billing access (all invoice endpoints → 403)
  - Accountant: full billing access
  - Manager: billing access (configurable — depends on can_view_billing)
  - Owner: full billing access, can cancel
"""
import pytest
from tests.conftest import bh

INVOICES_URL = '/api/billing/invoices/'


def _client_for(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
class TestTechnicianBillingAccess:

    def test_technician_cannot_list_invoices(self, api_client, technician, branch, seed_permissions):
        _client_for(api_client, technician)
        resp = api_client.get(INVOICES_URL, **bh(branch))
        assert resp.status_code == 403

    def test_technician_cannot_create_invoice(self, api_client, technician, branch, seed_permissions):
        _client_for(api_client, technician)
        resp = api_client.post(INVOICES_URL, {
            'customer_name': 'Test',
            'customer_mobile': '9999999999',
            'customer_address': 'Somewhere',
            'is_interstate': False,
        }, format='json', **bh(branch))
        assert resp.status_code == 403

    def test_technician_cannot_view_invoice_detail(
        self, api_client, technician, invoice, branch, seed_permissions
    ):
        _client_for(api_client, technician)
        resp = api_client.get(f'{INVOICES_URL}{invoice.id}/', **bh(branch))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestReceptionistBillingAccess:

    def test_receptionist_cannot_list_invoices(self, api_client, receptionist, branch, seed_permissions):
        _client_for(api_client, receptionist)
        resp = api_client.get(INVOICES_URL, **bh(branch))
        assert resp.status_code == 403

    def test_receptionist_cannot_create_invoice(self, api_client, receptionist, branch, seed_permissions):
        _client_for(api_client, receptionist)
        resp = api_client.post(INVOICES_URL, {
            'customer_name': 'Test',
            'customer_mobile': '9111111111',
            'customer_address': 'Somewhere',
            'is_interstate': False,
        }, format='json', **bh(branch))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAccountantBillingAccess:

    def test_accountant_can_list_invoices(self, api_client, accountant, branch, seed_permissions):
        _client_for(api_client, accountant)
        resp = api_client.get(INVOICES_URL, **bh(branch))
        assert resp.status_code == 200

    def test_accountant_can_create_invoice(self, api_client, accountant, branch, seed_permissions):
        _client_for(api_client, accountant)
        resp = api_client.post(INVOICES_URL, {
            'customer_name': 'Accountant Customer',
            'customer_mobile': '9222222222',
            'customer_address': 'Mumbai',
            'is_interstate': False,
        }, format='json', **bh(branch))
        assert resp.status_code == 201

    def test_accountant_can_finalize_invoice(self, api_client, accountant, invoice, branch, seed_permissions):
        from billing.models import InvoiceLineItem
        InvoiceLineItem.objects.create(
            invoice=invoice,
            item_type='SERVICE',
            description='Repair service',
            quantity=1,
            unit_price='500.00',
            gst_rate='18.00',
        )
        _client_for(api_client, accountant)
        resp = api_client.post(f'{INVOICES_URL}{invoice.id}/finalize/', {}, format='json', **bh(branch))
        assert resp.status_code == 200


@pytest.mark.django_db
class TestOwnerBillingAccess:

    def test_owner_can_cancel_invoice(self, auth_client, invoice, branch):
        resp = auth_client.post(
            f'{INVOICES_URL}{invoice.id}/cancel/',
            {'reason': 'Testing cancellation'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200

    def test_owner_can_view_invoices(self, auth_client, branch):
        resp = auth_client.get(INVOICES_URL, **bh(branch))
        assert resp.status_code == 200
