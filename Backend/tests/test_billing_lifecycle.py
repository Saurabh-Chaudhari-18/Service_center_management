"""
Invoice lifecycle integration tests.

Covers the full billing flow:
  DRAFT → (add line items) → finalize → PENDING
        → record_payment (partial) → PARTIAL
        → record_payment (balance) → PAID

Business rules enforced:
  - Finalized invoice cannot be modified
  - Any invoice DELETE returns 409 (GST 8-year retention — Task 11)
  - Cancel blocked if paid_amount > 0
  - Cancel requires a reason
  - GST split: CGST+SGST for intrastate, IGST for interstate
  - All standard rates: 0%, 5%, 12%, 18%, 28%
"""
import pytest
from decimal import Decimal
from billing.models import Invoice, InvoiceLineItem, InvoiceStatus, Payment, CreditNote
from billing.serializers import InvoiceListSerializer, CreditNoteSerializer
from marketing.models import CustomerLedgerEntry
from notifications.models import NotificationLog, NotificationType
from tests.conftest import bh

INVOICES_URL = '/api/billing/invoices/'


def _add_line(auth_client, invoice, branch, **kwargs):
    defaults = {
        'item_type': 'SERVICE',
        'description': 'LCD Replacement',
        'quantity': 1,
        'unit_price': '1000.00',
        'gst_rate': '18.00',
    }
    defaults.update(kwargs)
    return auth_client.post(
        f'{INVOICES_URL}{invoice.id}/add-line-item/',
        defaults,
        format='json', **bh(branch),
    )


@pytest.mark.django_db
class TestCreditNotes:
    def test_credit_note_gets_number_and_gst_totals(self, invoice, owner):
        invoice.total_amount = Decimal('1180.00')
        invoice.subtotal = Decimal('1000.00')
        invoice.cgst_total = Decimal('90.00')
        invoice.sgst_total = Decimal('90.00')
        invoice.is_finalized = True
        invoice.status = InvoiceStatus.PENDING
        invoice.save(update_fields=['total_amount', 'subtotal', 'cgst_total', 'sgst_total', 'is_finalized', 'status'])
        serializer = CreditNoteSerializer(data={
            'invoice': str(invoice.id),
            'amount': '100.00',
            'reason': 'Returned service',
        }, context={'request': type('Request', (), {'user': owner})()})
        assert serializer.is_valid(), serializer.errors
        note = serializer.save(created_by=owner)
        assert note.credit_note_number.startswith('CN')
        assert note.total_amount == Decimal('118.00')

    def test_cumulative_credit_cannot_exceed_invoice(self, invoice, owner):
        invoice.total_amount = Decimal('118.00')
        invoice.subtotal = Decimal('100.00')
        invoice.cgst_total = Decimal('9.00')
        invoice.sgst_total = Decimal('9.00')
        invoice.is_finalized = True
        invoice.status = InvoiceStatus.PENDING
        invoice.save(update_fields=['total_amount', 'subtotal', 'cgst_total', 'sgst_total', 'is_finalized', 'status'])
        CreditNote.objects.create(
            branch=invoice.branch, invoice=invoice, credit_note_number='CN-OLD',
            amount=Decimal('50.00'), total_amount=Decimal('59.00'), created_by=owner,
        )
        serializer = CreditNoteSerializer(data={
            'invoice': str(invoice.id), 'amount': '60.00', 'reason': 'Too much',
        }, context={'request': type('Request', (), {'user': owner})()})
        assert not serializer.is_valid()
        assert 'amount' in serializer.errors

    def test_creation_queues_customer_delivery_and_pdf(self, auth_client, invoice, customer, branch, monkeypatch):
        invoice.customer = customer
        invoice.customer_email = 'customer@example.com'
        invoice.total_amount = Decimal('118.00')
        invoice.subtotal = Decimal('100.00')
        invoice.cgst_total = Decimal('9.00')
        invoice.sgst_total = Decimal('9.00')
        invoice.is_finalized = True
        invoice.status = InvoiceStatus.PENDING
        invoice.save()
        monkeypatch.setattr('notifications.tasks.deliver_whatsapp.delay', lambda *args: None)
        monkeypatch.setattr('notifications.tasks.deliver_email.delay', lambda *args: None)

        response = auth_client.post('/api/billing/credit-notes/', {
            'invoice': str(invoice.id), 'amount': '50.00', 'reason': 'Service correction',
        }, format='json', **bh(branch))

        assert response.status_code == 201
        note = CreditNote.objects.get(pk=response.data['id'])
        assert response.data['customer_delivery']['status'] == 'QUEUED'
        assert NotificationLog.objects.filter(
            credit_note=note, notification_type=NotificationType.CREDIT_NOTE_ISSUED,
        ).exists()
        pdf = auth_client.get(f'/api/billing/credit-notes/{note.id}/download-pdf/', **bh(branch))
        assert pdf.status_code == 200
        assert pdf['Content-Type'] == 'application/pdf'

    def test_manual_customer_delivery_explains_missing_channel(self, auth_client, invoice, branch):
        invoice.total_amount = Decimal('118.00')
        invoice.subtotal = Decimal('100.00')
        invoice.cgst_total = Decimal('9.00')
        invoice.sgst_total = Decimal('9.00')
        invoice.is_finalized = True
        invoice.status = InvoiceStatus.PENDING
        invoice.save()
        note = CreditNote.objects.create(
            branch=branch, invoice=invoice, credit_note_number='CN-NO-CHANNEL',
            amount=Decimal('50.00'), total_amount=Decimal('59.00'),
            reason='Correction', created_by=invoice.created_by,
        )

        response = auth_client.post(
            f'/api/billing/credit-notes/{note.id}/send-to-customer/', {}, format='json', **bh(branch),
        )
        assert response.status_code == 400
        assert response.data['delivery']['reason'] == 'no_customer_channel'

    def test_idempotency_key_prevents_duplicate_credit_note(
        self, auth_client, invoice, branch
    ):
        invoice.total_amount = Decimal('118.00')
        invoice.subtotal = Decimal('100.00')
        invoice.cgst_total = Decimal('9.00')
        invoice.sgst_total = Decimal('9.00')
        invoice.is_finalized = True
        invoice.status = InvoiceStatus.PENDING
        invoice.save()
        headers = {**bh(branch), 'HTTP_IDEMPOTENCY_KEY': 'credit-attempt-1'}
        payload = {
            'invoice': str(invoice.id),
            'amount': '50.00',
            'reason': 'Service correction',
        }

        first = auth_client.post(
            '/api/billing/credit-notes/', payload, format='json', **headers
        )
        second = auth_client.post(
            '/api/billing/credit-notes/', payload, format='json', **headers
        )

        assert first.status_code == 201
        assert second.status_code == 200
        assert first.data['id'] == second.data['id']
        assert CreditNote.objects.filter(invoice=invoice).count() == 1


# ─────────────────────────────────────────────────────────────────────────────
# Create invoice
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateInvoice:

    def test_create_invoice_returns_201_in_draft(self, auth_client, branch):
        resp = auth_client.post(INVOICES_URL, {
            'customer_name': 'Raj Sharma',
            'customer_mobile': '9876543210',
            'customer_address': '42 MG Road, Mumbai',
            'is_interstate': False,
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        assert resp.data['status'] == InvoiceStatus.DRAFT

    def test_create_invoice_generates_invoice_number(self, auth_client, branch):
        resp = auth_client.post(INVOICES_URL, {
            'customer_name': 'Priya Nair',
            'customer_mobile': '9876543211',
            'customer_address': 'Kochi, Kerala',
            'is_interstate': False,
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        assert resp.data.get('invoice_number') not in ('', None)

    def test_invoice_numbers_are_unique(self, auth_client, branch):
        def _create():
            return auth_client.post(INVOICES_URL, {
                'customer_name': 'Test User',
                'customer_mobile': '9000000000',
                'customer_address': 'Somewhere',
                'is_interstate': False,
            }, format='json', **bh(branch))
        r1, r2 = _create(), _create()
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.data['invoice_number'] != r2.data['invoice_number']

    def test_job_invoice_inherits_customer_account(self, make_invoice, job):
        inv = make_invoice(job=job)

        assert inv.customer == job.customer

    def test_invoice_list_includes_branch_name(self, make_invoice, branch):
        inv = make_invoice()
        inv.refresh_from_db()

        data = InvoiceListSerializer(inv).data

        assert data['branch_name'] == branch.name
    def test_create_invoice_missing_customer_name_returns_400(self, auth_client, branch):
        resp = auth_client.post(INVOICES_URL, {
            'customer_mobile': '9876543212',
            'customer_address': 'Somewhere',
        }, format='json', **bh(branch))
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Add line items & GST math
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestLineItemGSTMath:

    def test_intrastate_18pct_produces_cgst_sgst_split(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=False)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        inv.refresh_from_db()
        assert inv.cgst_total == Decimal('90.00')
        assert inv.sgst_total == Decimal('90.00')
        assert inv.igst_total == Decimal('0.00')
        assert inv.total_amount == Decimal('1180.00')

    def test_interstate_18pct_produces_igst(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=True)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        inv.refresh_from_db()
        assert inv.igst_total == Decimal('180.00')
        assert inv.cgst_total == Decimal('0.00')
        assert inv.sgst_total == Decimal('0.00')
        assert inv.total_amount == Decimal('1180.00')

    def test_zero_gst_produces_no_tax(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch, unit_price='500.00', gst_rate='0.00', quantity=2)
        inv.refresh_from_db()
        assert inv.total_tax == Decimal('0.00')
        assert inv.total_amount == Decimal('1000.00')

    def test_5pct_gst_intrastate(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=False)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='5.00')
        inv.refresh_from_db()
        assert inv.cgst_total == Decimal('25.00')
        assert inv.sgst_total == Decimal('25.00')
        assert inv.total_amount == Decimal('1050.00')

    def test_12pct_gst_interstate(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=True)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='12.00')
        inv.refresh_from_db()
        assert inv.igst_total == Decimal('120.00')
        assert inv.total_amount == Decimal('1120.00')

    def test_28pct_gst_intrastate(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=False)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='28.00')
        inv.refresh_from_db()
        assert inv.cgst_total == Decimal('140.00')
        assert inv.sgst_total == Decimal('140.00')
        assert inv.total_amount == Decimal('1280.00')

    def test_multiple_line_items_totals_are_summed(self, auth_client, make_invoice, branch):
        inv = make_invoice(is_interstate=False)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        _add_line(auth_client, inv, branch, description='Labour', unit_price='500.00', gst_rate='18.00')
        inv.refresh_from_db()
        assert inv.subtotal == Decimal('1500.00')
        assert inv.cgst_total == Decimal('135.00')
        assert inv.sgst_total == Decimal('135.00')
        assert inv.total_amount == Decimal('1770.00')

    def test_quantity_multiplied_into_amount(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch, unit_price='200.00', quantity=3, gst_rate='0.00')
        inv.refresh_from_db()
        assert inv.subtotal == Decimal('600.00')

    def test_add_line_item_returns_201(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        resp = _add_line(auth_client, inv, branch)
        assert resp.status_code == 201


# ─────────────────────────────────────────────────────────────────────────────
# Finalization
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInvoiceFinalization:

    def test_finalize_sets_is_finalized_and_status_pending(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch)
        resp = auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.is_finalized is True
        assert inv.status == InvoiceStatus.PENDING

    def test_finalize_creates_customer_ledger_credit(self, auth_client, make_invoice, branch, customer):
        inv = make_invoice(customer=customer)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')

        resp = auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))

        assert resp.status_code == 200
        entry = CustomerLedgerEntry.objects.get(
            reference_type='INVOICE',
            reference_id=str(inv.id),
        )
        assert entry.customer == customer
        assert entry.entry_type == 'CREDIT'
        assert entry.amount == Decimal('1180.00')
        assert entry.running_balance == Decimal('1180.00')

    def test_finalize_is_idempotent(self, auth_client, make_invoice, branch, customer):
        inv = make_invoice(customer=customer)
        _add_line(auth_client, inv, branch)
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        resp = auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        assert resp.status_code == 200
        assert CustomerLedgerEntry.objects.filter(
            reference_type='INVOICE', reference_id=str(inv.id)
        ).count() == 1

    def test_finalize_rolls_back_if_notification_outbox_fails(
        self, auth_client, make_invoice, branch, customer, monkeypatch
    ):
        inv = make_invoice(customer=customer, customer_email='notify@example.com')
        _add_line(auth_client, inv, branch, unit_price='100.00')
        monkeypatch.setattr(
            'notifications.models.NotificationLog.objects.create',
            lambda **kwargs: (_ for _ in ()).throw(RuntimeError('outbox unavailable')),
        )

        response = auth_client.post(
            f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch)
        )

        assert response.status_code >= 400
        inv.refresh_from_db()
        assert inv.is_finalized is False
        assert not CustomerLedgerEntry.objects.filter(
            reference_type='INVOICE', reference_id=str(inv.id)
        ).exists()

    def test_add_line_item_to_finalized_invoice_is_blocked(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch)
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        # Attempt to add another line item after finalization
        resp = _add_line(auth_client, inv, branch, description='Post-finalize item')
        assert resp.status_code in (400, 403)

    def test_finalized_invoice_delete_returns_409(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch)
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        resp = auth_client.delete(f'{INVOICES_URL}{inv.id}/', **bh(branch))
        assert resp.status_code == 409

    def test_any_invoice_delete_returns_409(self, auth_client, invoice, branch):
        # Task 11: ALL invoices blocked from deletion for GST compliance
        resp = auth_client.delete(f'{INVOICES_URL}{invoice.id}/', **bh(branch))
        assert resp.status_code == 409


# ─────────────────────────────────────────────────────────────────────────────
# Payments
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPayments:

    def _finalized_invoice(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        inv.refresh_from_db()
        return inv

    def test_full_payment_sets_status_to_paid(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        resp = auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(inv.total_amount), 'payment_method': 'CASH'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == InvoiceStatus.PAID

    def test_payment_creates_customer_ledger_debit(self, auth_client, make_invoice, branch, customer):
        inv = make_invoice(customer=customer)
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))

        resp = auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': '180.00', 'payment_method': 'UPI'},
            format='json', **bh(branch),
        )

        assert resp.status_code == 200
        entry = CustomerLedgerEntry.objects.get(reference_type='PAYMENT')
        assert entry.customer == customer
        assert entry.entry_type == 'DEBIT'
        assert entry.amount == Decimal('180.00')
        assert entry.running_balance == Decimal('1000.00')

    def test_partial_payment_sets_status_to_partial(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        partial = str(inv.total_amount / 2)
        resp = auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': partial, 'payment_method': 'UPI'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        inv.refresh_from_db()
        assert inv.status == InvoiceStatus.PARTIAL

    def test_two_partial_payments_reach_paid(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        half = inv.total_amount / 2
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(half), 'payment_method': 'CASH'},
            format='json', **bh(branch),
        )
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(half), 'payment_method': 'CASH'},
            format='json', **bh(branch),
        )
        inv.refresh_from_db()
        assert inv.status == InvoiceStatus.PAID

    def test_payment_creates_payment_row(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(inv.total_amount), 'payment_method': 'CARD'},
            format='json', **bh(branch),
        )
        assert Payment.objects.filter(invoice=inv).count() == 1

    def test_payment_updates_paid_amount(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        amount = Decimal('500.00')
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(amount), 'payment_method': 'NEFT'},
            format='json', **bh(branch),
        )
        inv.refresh_from_db()
        assert inv.paid_amount >= amount

    def test_payment_idempotency_key_prevents_duplicate_charge(
        self, auth_client, make_invoice, branch
    ):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        headers = {**bh(branch), 'HTTP_IDEMPOTENCY_KEY': 'payment-attempt-1'}
        payload = {'amount': '100.00', 'payment_method': 'UPI'}

        first = auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/', payload,
            format='json', **headers,
        )
        second = auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/', payload,
            format='json', **headers,
        )

        assert first.status_code == 200
        assert second.status_code == 200
        inv.refresh_from_db()
        assert inv.payments.count() == 1
        assert inv.paid_amount == Decimal('100.00')

    def test_payments_endpoint_lists_payments(self, auth_client, make_invoice, branch):
        inv = self._finalized_invoice(auth_client, make_invoice, branch)
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(inv.total_amount), 'payment_method': 'CASH'},
            format='json', **bh(branch),
        )
        resp = auth_client.get(f'{INVOICES_URL}{inv.id}/payments/', **bh(branch))
        assert resp.status_code == 200
        assert len(resp.data) == 1


# ─────────────────────────────────────────────────────────────────────────────
# Cancel invoice
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCancelInvoice:

    def test_cancel_draft_invoice_succeeds(self, auth_client, invoice, branch):
        resp = auth_client.post(
            f'{INVOICES_URL}{invoice.id}/cancel/',
            {'reason': 'Customer changed mind'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        invoice.refresh_from_db()
        assert invoice.status == InvoiceStatus.CANCELLED

    def test_cancel_requires_reason(self, auth_client, invoice, branch):
        resp = auth_client.post(
            f'{INVOICES_URL}{invoice.id}/cancel/',
            {},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_cancel_invoice_with_payment_returns_400(self, auth_client, make_invoice, branch):
        inv = make_invoice()
        _add_line(auth_client, inv, branch, unit_price='1000.00', gst_rate='18.00')
        auth_client.post(f'{INVOICES_URL}{inv.id}/finalize/', {}, format='json', **bh(branch))
        inv.refresh_from_db()
        auth_client.post(
            f'{INVOICES_URL}{inv.id}/record-payment/',
            {'amount': str(inv.total_amount), 'payment_method': 'CASH'},
            format='json', **bh(branch),
        )
        resp = auth_client.post(
            f'{INVOICES_URL}{inv.id}/cancel/',
            {'reason': 'Try to cancel paid'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_cancelled_invoice_remains_in_list(self, auth_client, invoice, branch):
        auth_client.post(
            f'{INVOICES_URL}{invoice.id}/cancel/',
            {'reason': 'Duplicate entry'},
            format='json', **bh(branch),
        )
        resp = auth_client.get(INVOICES_URL, **bh(branch))
        ids = [str(i['id']) for i in resp.data.get('results', resp.data)]
        assert str(invoice.id) in ids


# ─────────────────────────────────────────────────────────────────────────────
# Edit history
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestEditHistory:

    def test_add_line_item_creates_edit_history(self, auth_client, invoice, branch):
        from billing.models import InvoiceEditHistory
        _add_line(auth_client, invoice, branch)
        assert InvoiceEditHistory.objects.filter(invoice=invoice).exists()

    def test_edit_history_endpoint_returns_list(self, auth_client, invoice, branch):
        _add_line(auth_client, invoice, branch)
        resp = auth_client.get(f'{INVOICES_URL}{invoice.id}/edit-history/', **bh(branch))
        assert resp.status_code == 200
        assert isinstance(resp.data, list)
