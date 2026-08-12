"""Automation helpers for service reminders."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from customers.models import Customer
from marketing.models import CustomerLedgerEntry, ReminderConfig, ServiceReminder


def append_customer_ledger_entry(
    *,
    customer,
    branch,
    entry_type,
    amount,
    description,
    reference_type,
    reference_id,
    created_by,
    entry_date=None,
    notes='',
):
    """Append one ledger entry while serializing balance changes per customer."""
    with transaction.atomic():
        locked_customer = Customer.objects.select_for_update().get(pk=customer.pk)
        reference_id = str(reference_id or '')
        if reference_id:
            existing = CustomerLedgerEntry.objects.filter(
                customer=locked_customer,
                reference_type=reference_type,
                reference_id=reference_id,
            ).first()
            if existing:
                return existing

        last_entry = CustomerLedgerEntry.objects.filter(
            customer=locked_customer,
        ).order_by('-created_at').first()
        current_balance = last_entry.running_balance if last_entry else 0
        delta = amount if entry_type == 'CREDIT' else -amount
        entry = CustomerLedgerEntry.objects.create(
            branch=branch,
            customer=locked_customer,
            entry_type=entry_type,
            amount=amount,
            description=description,
            reference_type=reference_type,
            reference_id=reference_id,
            entry_date=entry_date or timezone.localdate(),
            running_balance=current_balance + delta,
            created_by=created_by,
            notes=notes,
        )
        return entry


def schedule_service_reminders(job):
    """Create the configured post-service reminders exactly once."""
    config, _ = ReminderConfig.objects.get_or_create(branch=job.branch)
    if not config.is_active or not job.customer_id or not job.delivery_date:
        return []
    channel = 'WHATSAPP' if config.send_whatsapp else 'SMS'
    if channel == 'WHATSAPP' and not job.customer.whatsapp_enabled:
        channel = 'SMS'
    if channel == 'SMS' and not job.customer.sms_enabled:
        return []
    created = []
    delivery_day = job.delivery_date.date()
    for reminder_type, days in (
        ('REMINDER_1', config.reminder_1_days),
        ('REMINDER_2', config.reminder_2_days),
        ('REMINDER_3', config.reminder_3_days),
    ):
        reminder, was_created = ServiceReminder.objects.get_or_create(
            job=job,
            reminder_type=reminder_type,
            defaults={
                'branch': job.branch,
                'customer': job.customer,
                'scheduled_date': delivery_day + timedelta(days=days),
                'channel': channel,
            },
        )
        if was_created:
            created.append(reminder)
    return created
