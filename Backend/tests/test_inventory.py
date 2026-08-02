"""
Inventory management integration tests.

Business rules verified:
  - Stock cannot go negative (InsufficientInventory → 400/409)
  - Every stock change creates an InventoryAdjustment row
  - Part approval atomically deducts stock
  - Insufficient stock blocks part approval
  - Branch isolation: items are not visible across branches
"""
import pytest
from decimal import Decimal
from inventory.models import InventoryItem, InventoryAdjustment
from tests.conftest import bh

ITEMS_URL = '/api/inventory/items/'


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateInventoryItem:

    def test_create_item_returns_201(self, auth_client, branch):
        resp = auth_client.post(ITEMS_URL, {
            'name': 'LCD Screen 15.6"',
            'sku': 'LCD-15-001',
            'cost_price': '800.00',
            'selling_price': '1200.00',
            'gst_rate': '18.00',
        }, format='json', **bh(branch))
        assert resp.status_code == 201

    def test_create_item_starts_with_zero_stock(self, auth_client, branch):
        resp = auth_client.post(ITEMS_URL, {
            'name': 'Keyboard USB',
            'sku': 'KB-USB-001',
            'cost_price': '200.00',
            'selling_price': '350.00',
            'gst_rate': '18.00',
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        assert resp.data.get('quantity', 0) == 0

    def test_missing_name_returns_400(self, auth_client, branch):
        resp = auth_client.post(ITEMS_URL, {
            'sku': 'NO-NAME',
            'cost_price': '100.00',
            'selling_price': '150.00',
        }, format='json', **bh(branch))
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Add stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAddStock:

    def test_add_stock_increases_quantity(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=0)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/add-stock/',
            {'quantity': 10, 'reason': 'Initial stock'},
            format='json', **bh(branch),
        )
        item.refresh_from_db()
        assert item.quantity == 10

    def test_add_stock_creates_adjustment_row(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=0)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/add-stock/',
            {'quantity': 5, 'reason': 'Restock'},
            format='json', **bh(branch),
        )
        assert InventoryAdjustment.objects.filter(item=item).exists()

    def test_add_stock_cumulates(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=0)
        auth_client.post(f'{ITEMS_URL}{item.id}/add-stock/', {'quantity': 5, 'reason': 'Batch 1'}, format='json', **bh(branch))
        auth_client.post(f'{ITEMS_URL}{item.id}/add-stock/', {'quantity': 3, 'reason': 'Batch 2'}, format='json', **bh(branch))
        item.refresh_from_db()
        assert item.quantity == 8

    def test_add_zero_quantity_returns_400(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        resp = auth_client.post(
            f'{ITEMS_URL}{item.id}/add-stock/',
            {'quantity': 0},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_add_negative_quantity_returns_400(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        resp = auth_client.post(
            f'{ITEMS_URL}{item.id}/add-stock/',
            {'quantity': -3},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Deduct stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDeductStock:

    def test_deduct_stock_decreases_quantity(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=10)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/deduct-stock/',
            {'quantity': 3, 'reason': 'Used in repair'},
            format='json', **bh(branch),
        )
        item.refresh_from_db()
        assert item.quantity == 7

    def test_deduct_stock_creates_adjustment_row(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=10)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/deduct-stock/',
            {'quantity': 2, 'reason': 'Job usage'},
            format='json', **bh(branch),
        )
        adj = InventoryAdjustment.objects.filter(item=item).latest('created_at')
        assert adj is not None

    def test_deduct_more_than_available_returns_400_or_409(
        self, auth_client, make_inventory_item, branch
    ):
        item = make_inventory_item(quantity=2)
        resp = auth_client.post(
            f'{ITEMS_URL}{item.id}/deduct-stock/',
            {'quantity': 10, 'reason': 'Overdeduct'},
            format='json', **bh(branch),
        )
        assert resp.status_code in (400, 409)

    def test_deduct_more_than_available_does_not_change_stock(
        self, auth_client, make_inventory_item, branch
    ):
        item = make_inventory_item(quantity=2)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/deduct-stock/',
            {'quantity': 10, 'reason': 'Overdeduct test'},
            format='json', **bh(branch),
        )
        item.refresh_from_db()
        assert item.quantity == 2  # unchanged

    def test_stock_cannot_go_negative(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        auth_client.post(f'{ITEMS_URL}{item.id}/deduct-stock/', {'quantity': 5, 'reason': 'Full deduct'}, format='json', **bh(branch))
        resp = auth_client.post(
            f'{ITEMS_URL}{item.id}/deduct-stock/',
            {'quantity': 1, 'reason': 'Exceed zero test'},
            format='json', **bh(branch),
        )
        assert resp.status_code in (400, 409)
        item.refresh_from_db()
        assert item.quantity == 0


# ─────────────────────────────────────────────────────────────────────────────
# Adjust stock
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAdjustStock:

    def test_adjust_stock_sets_exact_quantity(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        auth_client.post(
            f'{ITEMS_URL}{item.id}/adjust-stock/',
            {'new_quantity': 20, 'reason': 'Physical count correction'},
            format='json', **bh(branch),
        )
        item.refresh_from_db()
        assert item.quantity == 20

    def test_adjust_stock_creates_adjustment_row(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        before = InventoryAdjustment.objects.filter(item=item).count()
        auth_client.post(
            f'{ITEMS_URL}{item.id}/adjust-stock/',
            {'new_quantity': 15, 'reason': 'Audit correction fix'},
            format='json', **bh(branch),
        )
        after = InventoryAdjustment.objects.filter(item=item).count()
        assert after == before + 1

    def test_adjust_stock_missing_reason_returns_400(self, auth_client, make_inventory_item, branch):
        item = make_inventory_item(quantity=5)
        resp = auth_client.post(
            f'{ITEMS_URL}{item.id}/adjust-stock/',
            {'new_quantity': 10},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Low stock alert
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLowStock:

    def test_low_stock_endpoint_returns_items_below_threshold(
        self, auth_client, make_inventory_item, branch
    ):
        low = make_inventory_item(quantity=1)
        ok = make_inventory_item(quantity=100)
        resp = auth_client.get(f'{ITEMS_URL}low-stock/', **bh(branch))
        assert resp.status_code == 200
        data = resp.data if isinstance(resp.data, list) else resp.data.get('results', resp.data)
        ids = [str(i['id']) for i in data]
        assert str(low.id) in ids
        assert str(ok.id) not in ids


# ─────────────────────────────────────────────────────────────────────────────
# Part approval stock deduction
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPartApprovalStockDeduction:

    def test_approve_part_request_with_inventory_item_deducts_stock(
        self, auth_client, job, make_inventory_item, owner, branch
    ):
        from jobs.models import PartRequest
        item = make_inventory_item(quantity=10)
        pr = PartRequest.objects.create(
            job=job,
            part_name=item.name,
            quantity=2,
            requested_by=owner,
            status='PENDING',
            inventory_item=item,
        )
        auth_client.post(f'/api/jobs/part-requests/{pr.id}/approve/', {}, format='json')
        item.refresh_from_db()
        assert item.quantity == 8

    def test_approve_part_request_with_insufficient_stock_returns_400_or_409(
        self, auth_client, job, make_inventory_item, owner
    ):
        from jobs.models import PartRequest
        item = make_inventory_item(quantity=1)
        pr = PartRequest.objects.create(
            job=job,
            part_name=item.name,
            quantity=5,
            requested_by=owner,
            status='PENDING',
            inventory_item=item,
        )
        resp = auth_client.post(f'/api/jobs/part-requests/{pr.id}/approve/', {}, format='json')
        assert resp.status_code in (400, 409)

    def test_insufficient_stock_approval_does_not_change_stock(
        self, auth_client, job, make_inventory_item, owner
    ):
        from jobs.models import PartRequest
        item = make_inventory_item(quantity=1)
        pr = PartRequest.objects.create(
            job=job,
            part_name=item.name,
            quantity=5,
            requested_by=owner,
            status='PENDING',
            inventory_item=item,
        )
        auth_client.post(f'/api/jobs/part-requests/{pr.id}/approve/', {}, format='json')
        item.refresh_from_db()
        assert item.quantity == 1  # unchanged


# ─────────────────────────────────────────────────────────────────────────────
# Branch isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInventoryBranchIsolation:

    def test_item_from_other_branch_not_visible(
        self, api_client, owner, org, branch, make_inventory_item, seed_permissions
    ):
        from core.models import Branch
        from inventory.models import InventoryItem
        other = Branch.objects.create(
            organization=org, name='Isolated Branch', code='ISO',
            email='iso@test.com', phone='+919000000001',
            address_line1='Y', city='Pune', state='Maharashtra',
            pincode='411001', gstin='27AABCT1332L2ZV', state_code='27',
        )
        other_item = InventoryItem.objects.create(
            branch=other, name='Secret Part', sku='SEC-001',
            cost_price=Decimal('50.00'), selling_price=Decimal('80.00'),
            gst_rate=Decimal('18.00'), quantity=5,
        )
        api_client.force_authenticate(user=owner)
        resp = api_client.get(ITEMS_URL, **bh(branch))
        ids = [str(i['id']) for i in resp.data.get('results', resp.data)]
        assert str(other_item.id) not in ids
