"""Atomic application workflows for invoices and customer balances."""

from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from audit.services import AuditLogService
from core.exceptions import BusinessRuleViolation
from marketing.services import append_customer_ledger_entry
from notifications.services import NotificationService


class BillingWorkflowService:
    @staticmethod
    def finalize(invoice_instance, user):
        from billing.models import Invoice, InvoiceStatus

        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice_instance.pk)
            if invoice.is_finalized:
                invoice_instance.refresh_from_db()
                return False
            if not invoice.line_items.exists():
                raise BusinessRuleViolation('Cannot finalize invoice without line items.')
            invoice.calculate_totals()
            invoice.is_finalized = True
            invoice.finalized_at = timezone.now()
            invoice.finalized_by = user
            invoice.status = InvoiceStatus.PENDING
            invoice.save()
            AuditLogService.log(
                user=user,
                action='INVOICE_FINALIZED',
                model_name='Invoice',
                object_id=str(invoice.pk),
                details={
                    'invoice_number': invoice.invoice_number,
                    'total_amount': str(invoice.total_amount),
                },
                strict=True,
            )
            if invoice.balance_due > Decimal('0') and invoice.customer_id:
                append_customer_ledger_entry(
                    branch=invoice.branch,
                    customer=invoice.customer,
                    entry_type='CREDIT',
                    amount=invoice.balance_due,
                    description=f'Invoice generated - {invoice.invoice_number}',
                    reference_type='INVOICE',
                    reference_id=invoice.pk,
                    entry_date=invoice.invoice_date,
                    created_by=user,
                    notes=f'Auto-generated from Invoice {invoice.invoice_number}',
                )
            NotificationService.on_invoice_created(invoice)
        invoice_instance.refresh_from_db()
        return True

    @staticmethod
    def record_payment(
        invoice_instance,
        amount,
        payment_method,
        user,
        reference='',
        notes='',
        idempotency_key=None,
    ):
        from billing.models import Invoice, InvoiceStatus, Payment

        if amount <= 0:
            raise BusinessRuleViolation('Payment amount must be positive.')
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice_instance.pk)
            if idempotency_key:
                existing = Payment.objects.filter(
                    invoice=invoice, idempotency_key=idempotency_key
                ).first()
                if existing:
                    if (
                        existing.amount != amount
                        or existing.payment_method != payment_method
                        or existing.reference != reference
                        or existing.notes != notes
                    ):
                        raise BusinessRuleViolation(
                            'This idempotency key was already used with different payment data.'
                        )
                    invoice_instance.refresh_from_db()
                    return existing
            if invoice.status == InvoiceStatus.CANCELLED:
                raise BusinessRuleViolation('Cannot record payment on cancelled invoice.')
            if amount > invoice.balance_due:
                raise BusinessRuleViolation(
                    f'Payment amount exceeds balance due ({invoice.balance_due}).'
                )
            payment = Payment.objects.create(
                invoice=invoice,
                amount=amount,
                payment_method=payment_method,
                reference=reference,
                notes=notes,
                received_by=user,
                idempotency_key=idempotency_key,
            )
            invoice.paid_amount += amount
            invoice._update_payment_status()
            invoice.save(update_fields=['paid_amount', 'status', 'updated_at'])
            AuditLogService.log(
                user=user,
                action='PAYMENT_RECEIVED',
                model_name='Payment',
                object_id=str(payment.pk),
                details={
                    'invoice_number': invoice.invoice_number,
                    'amount': str(amount),
                    'method': payment_method,
                    'new_balance': str(invoice.balance_due),
                },
                strict=True,
            )
            if invoice.customer_id:
                append_customer_ledger_entry(
                    branch=invoice.branch,
                    customer=invoice.customer,
                    entry_type='DEBIT',
                    amount=amount,
                    description=f'Payment received - {payment_method}',
                    reference_type='PAYMENT',
                    reference_id=str(payment.pk),
                    created_by=user,
                    notes=f'Auto-generated payment against Invoice {invoice.invoice_number}',
                )
            invoice_instance.refresh_from_db()
            return payment
