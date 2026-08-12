from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal

import pytest
from django.db import close_old_connections, connections


def _parallel(callables):
    with ThreadPoolExecutor(max_workers=len(callables)) as pool:
        futures = [pool.submit(fn) for fn in callables]
        return [future.result(timeout=20) for future in futures]


@pytest.mark.django_db(transaction=True)
def test_parallel_job_transition_records_only_one_change(job, technician, monkeypatch):
    from jobs.models import JobCard, JobStatus, JobStatusHistory

    monkeypatch.setattr(
        'notifications.services.NotificationService.on_job_status_change',
        lambda *args, **kwargs: None,
    )

    def transition():
        close_old_connections()
        try:
            JobCard.objects.get(pk=job.pk).transition_status(
                JobStatus.DIAGNOSIS, technician, notes='parallel request'
            )
            return 'changed'
        except Exception as exc:
            return type(exc).__name__
        finally:
            connections.close_all()

    outcomes = _parallel([transition, transition])

    job.refresh_from_db()
    assert job.status == JobStatus.DIAGNOSIS
    assert outcomes.count('changed') == 1
    assert JobStatusHistory.objects.filter(job=job).count() == 1


@pytest.mark.django_db
def test_job_transition_rolls_back_when_outbox_cannot_persist(
    job, technician, monkeypatch
):
    from jobs.models import JobStatus, JobStatusHistory

    monkeypatch.setattr(
        'notifications.models.NotificationLog.objects.create',
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError('outbox unavailable')),
    )

    with pytest.raises(RuntimeError, match='outbox unavailable'):
        job.transition_status(JobStatus.DIAGNOSIS, technician)

    job.refresh_from_db()
    assert job.status == JobStatus.RECEIVED
    assert not JobStatusHistory.objects.filter(job=job).exists()


@pytest.mark.django_db(transaction=True)
def test_parallel_payments_cannot_overpay_or_lose_invoice_total(
    invoice, owner, customer
):
    from billing.models import Invoice, InvoiceStatus, PaymentMethod

    Invoice.objects.filter(pk=invoice.pk).update(
        customer=customer,
        is_finalized=True,
        status=InvoiceStatus.PENDING,
        total_amount=Decimal('1000.00'),
        paid_amount=Decimal('0.00'),
    )

    def pay(key):
        close_old_connections()
        try:
            locked_invoice = Invoice.objects.get(pk=invoice.pk)
            locked_invoice.record_payment(
                Decimal('600.00'), PaymentMethod.UPI, owner,
                idempotency_key=key,
            )
            return 'paid'
        except Exception as exc:
            return type(exc).__name__
        finally:
            connections.close_all()

    outcomes = _parallel([
        lambda: pay('parallel-payment-1'),
        lambda: pay('parallel-payment-2'),
    ])

    invoice.refresh_from_db()
    assert outcomes.count('paid') == 1
    assert invoice.payments.count() == 1
    assert invoice.paid_amount == Decimal('600.00')
    assert invoice.balance_due == Decimal('400.00')


@pytest.mark.django_db(transaction=True)
def test_parallel_ledger_entries_have_serial_running_balances(customer, owner, branch):
    from marketing.services import append_customer_ledger_entry

    def append(reference):
        close_old_connections()
        try:
            entry = append_customer_ledger_entry(
                customer=customer,
                branch=branch,
                entry_type='CREDIT',
                amount=Decimal('100.00'),
                description='Parallel charge',
                reference_type='ADJUSTMENT',
                reference_id=reference,
                created_by=owner,
            )
            return entry.running_balance
        finally:
            connections.close_all()

    balances = _parallel([
        lambda: append('parallel-ledger-1'),
        lambda: append('parallel-ledger-2'),
    ])

    assert set(balances) == {Decimal('100.00'), Decimal('200.00')}


@pytest.mark.django_db(transaction=True)
def test_parallel_universal_numbers_use_locked_sequences(customer, owner):
    from billing.models import Invoice
    from jobs.models import JobCard

    def create_job(index):
        close_old_connections()
        try:
            return JobCard.objects.create(
                branch=None,
                customer=customer,
                brand='Parallel',
                model=f'Job {index}',
                customer_complaint='Numbering test',
                received_by=owner,
            ).job_number
        finally:
            connections.close_all()

    def create_invoice(index):
        close_old_connections()
        try:
            return Invoice.objects.create(
                branch=None,
                customer_name='Parallel Customer',
                customer_mobile='9999999999',
                customer_address='',
                created_by=owner,
            ).invoice_number
        finally:
            connections.close_all()

    job_numbers = _parallel([lambda i=i: create_job(i) for i in range(4)])
    invoice_numbers = _parallel([lambda i=i: create_invoice(i) for i in range(4)])

    assert len(set(job_numbers)) == 4
    assert len(set(invoice_numbers)) == 4
