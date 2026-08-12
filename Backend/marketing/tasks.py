"""Periodic service reminder delivery."""

from celery import shared_task
from django.db import transaction
from django.utils import timezone


@shared_task(name='marketing.process_due_service_reminders')
def process_due_service_reminders():
    from marketing.models import ServiceReminder
    from notifications.models import NotificationChannel, NotificationLog, NotificationType
    from notifications.services import NotificationService

    delivered = 0
    due_ids = list(ServiceReminder.objects.filter(
        status='PENDING', scheduled_date__lte=timezone.localdate(),
    ).values_list('id', flat=True)[:200])
    for reminder_id in due_ids:
        with transaction.atomic():
            reminder = ServiceReminder.objects.select_for_update().select_related(
                'job', 'customer', 'branch', 'branch__reminder_config',
            ).get(pk=reminder_id)
            if reminder.status != 'PENDING':
                continue
            config = reminder.branch.reminder_config
            days = (timezone.localdate() - reminder.job.delivery_date.date()).days
            context = {
                'customer_name': reminder.customer.get_full_name(),
                'days': days,
                'device_type': reminder.job.get_device_type_display(),
                'branch_name': reminder.branch.name,
                'job_number': reminder.job.job_number,
            }
            message = config.reminder_message
            for key, value in context.items():
                message = message.replace(f'{{{key}}}', str(value))
            log = NotificationLog.objects.create(
                branch=reminder.branch,
                notification_type=NotificationType.CUSTOM,
                channel=reminder.channel,
                recipient_mobile=reminder.customer.mobile,
                recipient_name=reminder.customer.get_full_name(),
                message=message,
                job=reminder.job,
            )
            if reminder.channel == NotificationChannel.WHATSAPP:
                NotificationService._send_whatsapp(log.recipient_mobile, log.message, log)
            else:
                NotificationService._send_sms(log.recipient_mobile, log.message, log)
            log.refresh_from_db()
            if log.status == 'SENT':
                reminder.status = 'SENT'
                reminder.sent_at = timezone.now()
                delivered += 1
            else:
                reminder.status = 'FAILED'
                reminder.error_message = log.error_message
            reminder.save(update_fields=['status', 'sent_at', 'error_message', 'updated_at'])
    return delivered
