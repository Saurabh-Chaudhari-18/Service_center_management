"""
Celery tasks for async notification delivery.

Each task receives the NotificationLog id (already persisted) and calls
the appropriate send helper. The log row is the durability record —
if a worker crashes mid-send, CELERY_TASK_ACKS_LATE + REJECT_ON_WORKER_LOST
will re-queue the task and retry.
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


def _get_log(log_id):
    from notifications.models import NotificationLog
    try:
        return NotificationLog.objects.get(id=str(log_id))
    except NotificationLog.DoesNotExist:
        logger.error(f"NotificationLog {log_id} not found — task skipped")
        return None


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name='notifications.deliver_sms',
)
def deliver_sms(self, log_id):
    """Send SMS via TextBee for the given NotificationLog id."""
    log = _get_log(log_id)
    if not log or log.status != 'PENDING':
        return
    from notifications.services import NotificationService
    NotificationService._send_sms(log.recipient_mobile, log.message, log)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name='notifications.deliver_whatsapp',
)
def deliver_whatsapp(self, log_id):
    """Send WhatsApp message for the given NotificationLog id."""
    log = _get_log(log_id)
    if not log or log.status != 'PENDING':
        return
    from notifications.services import NotificationService
    NotificationService._send_whatsapp(log.recipient_mobile, log.message, log)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    name='notifications.deliver_email',
)
def deliver_email(self, log_id, email_address, subject, html_message=None):
    """Send email for the given NotificationLog id."""
    log = _get_log(log_id)
    if not log or log.status != 'PENDING':
        return
    from notifications.services import NotificationService
    NotificationService._send_email(
        email_address,
        subject,
        log.message,
        log,
        html_message=html_message,
        invoice=log.invoice if not log.credit_note_id else None,
        credit_note=log.credit_note,
    )
