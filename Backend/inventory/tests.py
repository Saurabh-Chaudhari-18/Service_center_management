import pytest
from decimal import Decimal

from core.exceptions import InsufficientInventory
from inventory.models import InventoryItem, InventoryAdjustment, Purchase, StockTransfer
from inventory.serializers import StockTransferSerializer


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _make_item(branch, name="LCD Screen", quantity=10, selling_price="500.00", cost_price="300.00"):
    return InventoryItem.objects.create(
        branch=branch,
        name=name,
        cost_price=Decimal(cost_price),
        selling_price=Decimal(selling_price),
        quantity=quantity,
        low_stock_threshold=3,
        gst_rate=Decimal("18.00"),
    )


@pytest.mark.django_db
class TestStockTransfers:
    def test_transfer_requires_items(self, branch, owner):
        from core.models import Branch
        other = Branch.objects.create(
            organization=branch.organization, name='Other', code='OTH', email='other@example.com',
            phone='+919000000001', address_line1='Other street', city='Pune', state='Maharashtra', pincode='411001',
        )
        serializer = StockTransferSerializer(data={
            'from_branch': str(branch.id), 'to_branch': str(other.id), 'items': [],
        }, context={'request': type('Request', (), {'user': owner})()})
        assert serializer.is_valid(), serializer.errors
        with pytest.raises(Exception, match='at least one item'):
            serializer.save(initiated_by=owner)


# ─── add_stock / deduct_stock ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestStockOperations:
    def test_add_stock_increases_quantity(self, branch, owner):
        item = _make_item(branch, quantity=5)
        item.add_stock(3, reason="Restock", user=owner)
        assert item.quantity == 8

    def test_add_stock_creates_audit_record(self, branch, owner):
        item = _make_item(branch, quantity=5)
        item.add_stock(3, reason="Restock", user=owner)
        adj = item.adjustments.latest("created_at")
        assert adj.adjustment_type == "ADD"
        assert adj.quantity == 3
        assert adj.old_quantity == 5
        assert adj.new_quantity == 8

    def test_deduct_stock_reduces_quantity(self, branch, owner):
        item = _make_item(branch, quantity=10)
        item.deduct_stock(4, reason="Used in repair", user=owner)
        assert item.quantity == 6

    def test_deduct_stock_creates_audit_record(self, branch, owner):
        item = _make_item(branch, quantity=10)
        item.deduct_stock(4, reason="Used in repair", user=owner)
        adj = item.adjustments.latest("created_at")
        assert adj.adjustment_type == "DEDUCT"
        assert adj.quantity == 4
        assert adj.old_quantity == 10
        assert adj.new_quantity == 6

    def test_add_stock_zero_raises(self, branch, owner):
        item = _make_item(branch)
        with pytest.raises(ValueError):
            item.add_stock(0, reason="bad", user=owner)

    def test_add_stock_negative_raises(self, branch, owner):
        item = _make_item(branch)
        with pytest.raises(ValueError):
            item.add_stock(-1, reason="bad", user=owner)


@pytest.mark.django_db
class TestInsufficientStock:
    def test_deduct_more_than_available_raises(self, branch, owner):
        item = _make_item(branch, quantity=2)
        with pytest.raises(InsufficientInventory):
            item.deduct_stock(5, reason="Test", user=owner)

    def test_quantity_unchanged_after_failed_deduct(self, branch, owner):
        item = _make_item(branch, quantity=2)
        try:
            item.deduct_stock(5, reason="Test", user=owner)
        except InsufficientInventory:
            pass
        item.refresh_from_db()
        assert item.quantity == 2


# ─── Adjustment immutability ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestAdjustmentImmutability:
    def test_updating_adjustment_raises(self, branch, owner):
        item = _make_item(branch)
        item.add_stock(1, reason="init", user=owner)
        adj = item.adjustments.latest("created_at")
        adj.reason = "tampered"
        with pytest.raises(ValueError, match="immutable"):
            adj.save()


# ─── is_low_stock property ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestLowStockProperty:
    def test_above_threshold_not_low(self, branch):
        item = _make_item(branch, quantity=10)
        assert item.is_low_stock is False

    def test_at_threshold_is_low(self, branch):
        # threshold defaults to 3; quantity=3 → is_low_stock (<=)
        item = _make_item(branch, quantity=3)
        assert item.is_low_stock is True

    def test_below_threshold_is_low(self, branch):
        item = _make_item(branch, quantity=1)
        assert item.is_low_stock is True


# ─── adjust_stock ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAdjustStock:
    def test_adjust_to_higher_creates_manual(self, branch, owner):
        item = _make_item(branch, quantity=5)
        item.adjust_stock(15, reason="Cycle count correction", user=owner)
        assert item.quantity == 15
        adj = item.adjustments.latest("created_at")
        assert adj.adjustment_type == "MANUAL"
        assert adj.is_manual_adjustment is True

    def test_adjust_to_lower_creates_correction(self, branch, owner):
        item = _make_item(branch, quantity=10)
        item.adjust_stock(4, reason="Shrinkage found", user=owner)
        assert item.quantity == 4
        adj = item.adjustments.latest("created_at")
        assert adj.adjustment_type == "CORRECTION"

    def test_adjust_negative_raises(self, branch, owner):
        item = _make_item(branch)
        with pytest.raises(ValueError):
            item.adjust_stock(-1, reason="bad", user=owner)


# ─── Purchase payment status ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestPurchasePaymentStatus:
    def _make_purchase(self, branch, total, paid):
        import datetime

        p = Purchase(
            branch=branch,
            vendor_name="Test Vendor",
            purchase_date=datetime.date.today(),
            total_amount=Decimal(str(total)),
            paid_amount=Decimal(str(paid)),
        )
        p.save()
        return p

    def test_pending_when_nothing_paid(self, branch):
        p = self._make_purchase(branch, total="1000.00", paid="0.00")
        assert p.status == "PENDING"

    def test_partial_when_some_paid(self, branch):
        p = self._make_purchase(branch, total="1000.00", paid="500.00")
        assert p.status == "PARTIAL"

    def test_paid_when_fully_paid(self, branch):
        p = self._make_purchase(branch, total="1000.00", paid="1000.00")
        assert p.status == "PAID"

    def test_balance_due_calculation(self, branch):
        p = self._make_purchase(branch, total="1000.00", paid="600.00")
        assert p.balance_due == Decimal("400.00")

    def test_is_fully_paid_true(self, branch):
        p = self._make_purchase(branch, total="500.00", paid="500.00")
        assert p.is_fully_paid is True

    def test_is_fully_paid_false(self, branch):
        p = self._make_purchase(branch, total="500.00", paid="400.00")
        assert p.is_fully_paid is False
