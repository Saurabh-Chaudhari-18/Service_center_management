"""
Shared factory fixtures for the integration test suite.
Root Backend/conftest.py already provides: org, branch, make_user,
owner, technician, accountant, receptionist, api_client, auth_client,
seed_permissions.
"""
import uuid
import pytest
from decimal import Decimal


def bh(branch):
    """Return HTTP header dict for X-Branch-ID."""
    return {'HTTP_X_BRANCH_ID': str(branch.id)}


# ── Customer factory ────────────────────────────────────────────────────────

@pytest.fixture
def make_customer(branch):
    from customers.models import Customer
    _n = {'v': 0}

    def _make(mobile=None, b=None, **kwargs):
        _n['v'] += 1
        return Customer.objects.create(
            branch=b or branch,
            first_name=kwargs.pop('first_name', 'Test'),
            last_name=kwargs.pop('last_name', 'Customer'),
            mobile=mobile or f'90000{_n["v"]:05d}',
            **kwargs,
        )
    return _make


@pytest.fixture
def customer(make_customer):
    return make_customer()


# ── Job factory ─────────────────────────────────────────────────────────────

@pytest.fixture
def make_job(branch, owner):
    from jobs.models import JobCard, JobStatus

    def _make(cust, received_by=None, status=JobStatus.RECEIVED, **kwargs):
        return JobCard.objects.create(
            branch=branch,
            customer=cust,
            brand=kwargs.pop('brand', 'Samsung'),
            model=kwargs.pop('model', 'Galaxy S21'),
            customer_complaint=kwargs.pop('customer_complaint', 'Screen cracked'),
            status=status,
            received_by=received_by or owner,
            **kwargs,
        )
    return _make


@pytest.fixture
def job(make_job, customer):
    return make_job(customer)


# ── Invoice factory ─────────────────────────────────────────────────────────

@pytest.fixture
def make_invoice(branch, owner):
    from billing.models import Invoice, InvoiceStatus

    def _make(is_interstate=False, **kwargs):
        return Invoice.objects.create(
            branch=branch,
            invoice_number=f'INV-{uuid.uuid4().hex[:12].upper()}',
            customer_name='Test Customer',
            customer_mobile='9999999999',
            customer_address='123 Test Street, Mumbai',
            is_interstate=is_interstate,
            status=InvoiceStatus.DRAFT,
            created_by=owner,
            **kwargs,
        )
    return _make


@pytest.fixture
def invoice(make_invoice):
    return make_invoice()


# ── Inventory item factory ──────────────────────────────────────────────────

@pytest.fixture
def make_inventory_item(branch):
    from inventory.models import InventoryItem
    _n = {'v': 0}

    def _make(quantity=10, **kwargs):
        _n['v'] += 1
        return InventoryItem.objects.create(
            branch=branch,
            name=kwargs.pop('name', f'Test Part {_n["v"]}'),
            sku=f'SKU{_n["v"]:04d}',
            cost_price=Decimal('100.00'),
            selling_price=Decimal('150.00'),
            gst_rate=Decimal('18.00'),
            quantity=quantity,
            **kwargs,
        )
    return _make
