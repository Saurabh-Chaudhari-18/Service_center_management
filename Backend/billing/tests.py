import uuid

import pytest
from decimal import Decimal

from billing.models import Invoice, InvoiceLineItem, InvoiceStatus


@pytest.mark.django_db
class TestGSTMath:
    """GST computation matches Indian split (CGST/SGST vs IGST)."""

    def _make_invoice(self, branch, owner, interstate=False):
        return Invoice.objects.create(
            branch=branch,
            invoice_number=f'TEST-{uuid.uuid4().hex[:16]}',
            customer_name='Test Customer',
            customer_mobile='9999999999',
            customer_address='Test Address, Mumbai',
            is_interstate=interstate,
            status=InvoiceStatus.DRAFT,
            created_by=owner,
        )

    def test_intrastate_uses_cgst_sgst(self, branch, owner):
        inv = self._make_invoice(branch, owner, interstate=False)
        InvoiceLineItem.objects.create(
            invoice=inv,
            item_type='SERVICE',
            description='Screen Replacement',
            quantity=1,
            unit_price=Decimal('1000.00'),
            gst_rate=Decimal('18.00'),
        )
        inv.refresh_from_db()
        assert inv.cgst_total == Decimal('90.00')
        assert inv.sgst_total == Decimal('90.00')
        assert inv.igst_total == Decimal('0.00')
        assert inv.total_amount == Decimal('1180.00')

    def test_interstate_uses_igst(self, branch, owner):
        inv = self._make_invoice(branch, owner, interstate=True)
        InvoiceLineItem.objects.create(
            invoice=inv,
            item_type='SERVICE',
            description='Screen Replacement',
            quantity=1,
            unit_price=Decimal('1000.00'),
            gst_rate=Decimal('18.00'),
        )
        inv.refresh_from_db()
        assert inv.igst_total == Decimal('180.00')
        assert inv.cgst_total == Decimal('0.00')
        assert inv.sgst_total == Decimal('0.00')
        assert inv.total_amount == Decimal('1180.00')

    def test_zero_gst_item(self, branch, owner):
        inv = self._make_invoice(branch, owner)
        InvoiceLineItem.objects.create(
            invoice=inv,
            item_type='LABOUR',
            description='Labour',
            quantity=2,
            unit_price=Decimal('500.00'),
            gst_rate=Decimal('0.00'),
        )
        inv.refresh_from_db()
        assert inv.total_amount == Decimal('1000.00')
        assert inv.total_tax == Decimal('0.00')

    def test_line_item_computes_amount(self, branch, owner):
        inv = self._make_invoice(branch, owner)
        line = InvoiceLineItem.objects.create(
            invoice=inv,
            item_type='SERVICE',
            description='Repair',
            quantity=3,
            unit_price=Decimal('100.00'),
            gst_rate=Decimal('0.00'),
        )
        assert line.amount == Decimal('300.00')

    def test_finalized_invoice_rejects_delete(self, branch, owner, api_client):
        inv = self._make_invoice(branch, owner)
        inv.is_finalized = True
        inv.save(update_fields=['is_finalized'])
        api_client.force_authenticate(user=owner)
        response = api_client.delete(f'/api/billing/invoices/{inv.id}/')
        assert response.status_code == 409


@pytest.mark.django_db
class TestInvoiceSequence:
    """Branch invoice numbers are unique and include branch prefix."""

    def test_sequential_invoice_numbers(self, branch):
        n1 = branch.get_next_invoice_number()
        n2 = branch.get_next_invoice_number()
        assert n1 != n2
        assert branch.invoice_prefix in n1
        assert branch.code in n1
