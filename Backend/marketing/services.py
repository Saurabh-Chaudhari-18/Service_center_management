"""Automation helpers for service reminders."""

from datetime import timedelta

from marketing.models import ReminderConfig, ServiceReminder


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
