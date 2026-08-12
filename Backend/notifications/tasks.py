"""Durable Celery delivery and recovery tasks for notification outbox rows."""

import logging
from datetime import timedelta

from celery import shared_task
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)


class NotificationDeliveryFailed(Exception):
    pass


def enqueue_notification(log_id):
    """Publish an outbox row, leaving it recoverable when broker publish fails."""
    from notifications.models import NotificationChannel, NotificationLog

    log = NotificationLog.objects.get(pk=log_id)
    if log.status in ('SENT', 'DELIVERED'):
        return False
    try:
        if log.channel == NotificationChannel.SMS:
            deliver_sms.delay(str(log.pk))
        elif log.channel == NotificationChannel.WHATSAPP:
            deliver_whatsapp.delay(str(log.pk))
        elif log.channel == NotificationChannel.EMAIL:
            deliver_email.delay(str(log.pk))
        else:
            return False
    except Exception:
        logger.exception('Could not publish notification outbox row %s', log.pk)
        return False
    NotificationLog.objects.filter(pk=log.pk).update(dispatched_at=timezone.now())
    return True


def _claim_delivery(log_id):
    """Claim exactly once; a crash leaves SENDING for manual reconciliation."""
    from notifications.models import NotificationLog

    with transaction.atomic():
        try:
            log = NotificationLog.objects.select_for_update().get(pk=log_id)
        except NotificationLog.DoesNotExist:
            return None
        if log.status in ('SENDING', 'SENT', 'DELIVERED') or log.retry_count >= 3:
            return None
        log.status = 'SENDING'
        log.last_retry_at = timezone.now()
        log.save(update_fields=['status', 'last_retry_at', 'updated_at'])
        return log


def _raise_if_failed(log):
    log.refresh_from_db()
    _sync_service_reminder(log)
    if log.status == 'FAILED' and log.retry_count < 3:
        raise NotificationDeliveryFailed(log.error_message or 'Provider delivery failed')


def _sync_service_reminder(log):
    reminder_id = (log.delivery_context or {}).get('service_reminder_id')
    if not reminder_id:
        return
    from marketing.models import ServiceReminder

    if log.status == 'SENT':
        ServiceReminder.objects.filter(pk=reminder_id).update(
            status='SENT', sent_at=timezone.now(), error_message=''
        )
    elif log.status == 'FAILED' and log.retry_count >= 3:
        ServiceReminder.objects.filter(pk=reminder_id).update(
            status='FAILED', error_message=log.error_message
        )


def _deliver_with_retry(log, sender):
    """Turn both provider-reported and unexpected failures into Celery retries."""
    try:
        sender()
    except Exception as exc:
        log.refresh_from_db()
        if log.status == 'SENDING':
            log.mark_failed(str(exc))
    _raise_if_failed(log)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(NotificationDeliveryFailed,),
    name='notifications.deliver_sms',
)
def deliver_sms(self, log_id):
    log = _claim_delivery(log_id)
    if not log:
        return
    from notifications.services import NotificationService

    _deliver_with_retry(
        log,
        lambda: NotificationService._send_sms(log.recipient_mobile, log.message, log),
    )


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(NotificationDeliveryFailed,),
    name='notifications.deliver_whatsapp',
)
def deliver_whatsapp(self, log_id):
    log = _claim_delivery(log_id)
    if not log:
        return
    from notifications.services import NotificationService

    _deliver_with_retry(
        log,
        lambda: NotificationService._send_whatsapp(log.recipient_mobile, log.message, log),
    )


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(NotificationDeliveryFailed,),
    name='notifications.deliver_email',
)
def deliver_email(self, log_id):
    log = _claim_delivery(log_id)
    if not log:
        return
    from notifications.services import NotificationService

    def send_email():
        context = log.delivery_context or {}
        job_pdf = None
        job_pdf_filename = None
        if log.job_id and log.notification_type == 'JOB_CREATED':
            from jobs.services import JobCardService

            job_pdf = JobCardService.generate_job_card_pdf(log.job)
            job_pdf_filename = f"{log.job.job_number.replace('/', '-')}.pdf"
        NotificationService._send_email(
            log.recipient_email,
            log.subject or 'Service Center Notification',
            log.message,
            log,
            html_message=context.get('html_message') or None,
            invoice=log.invoice if not log.credit_note_id else None,
            credit_note=log.credit_note,
            job_pdf=job_pdf,
            job_pdf_filename=job_pdf_filename,
        )

    _deliver_with_retry(log, send_email)


@shared_task(name='notifications.dispatch_pending')
def dispatch_pending_notifications(batch_size=200):
    """Recover committed outbox rows that were never successfully published."""
    from notifications.models import NotificationLog

    stale_before = timezone.now() - timedelta(minutes=10)
    candidate_ids = list(
        NotificationLog.objects.filter(
            status='PENDING',
            retry_count__lt=3,
        ).filter(
            dispatched_at__isnull=True
        ).values_list('pk', flat=True)[:batch_size]
    )
    published = 0
    for log_id in candidate_ids:
        with transaction.atomic():
            log = NotificationLog.objects.select_for_update().get(pk=log_id)
            if log.status != 'PENDING' or log.dispatched_at is not None:
                continue
            published += int(enqueue_notification(log.pk))

    # A separate stale-dispatch query is intentionally diagnostic only: blindly
    # republishing accepted broker messages would increase duplicate delivery.
    stale = NotificationLog.objects.filter(
        status='PENDING', dispatched_at__lt=stale_before
    ).count()
    if stale:
        logger.warning('%s notification tasks remain pending after broker dispatch', stale)
    return published


@shared_task(name='system.background_pipeline_heartbeat')
def background_pipeline_heartbeat():
    """A Beat-enqueued worker heartbeat proves scheduler and worker are both live."""
    cache.set('background_pipeline_heartbeat', timezone.now().isoformat(), 180)
    return True
