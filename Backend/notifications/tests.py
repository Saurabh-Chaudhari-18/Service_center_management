from django.test import TestCase

# Create your tests here.

import pytest
from unittest.mock import patch


@pytest.mark.django_db
def test_custom_send_rejects_inaccessible_job(
    api_client, manager, branch, seed_permissions
):
    from core.models import Branch
    from customers.models import Customer
    from jobs.models import JobCard, JobStatus
    from notifications.models import NotificationLog

    other_branch = Branch.objects.create(
        organization=branch.organization,
        name='Other Branch',
        code='OTH',
        email='other@test.com',
        phone='+919999999997',
        address_line1='Elsewhere',
        city='Pune',
        state='Maharashtra',
        pincode='411001',
        state_code='27',
    )
    customer = Customer.objects.create(
        branch=other_branch,
        first_name='Other',
        last_name='Customer',
        mobile='9000000077',
    )
    job = JobCard.objects.create(
        branch=other_branch,
        customer=customer,
        brand='HP',
        model='EliteBook',
        customer_complaint='No power',
        status=JobStatus.RECEIVED,
        received_by=manager,
    )

    api_client.force_authenticate(user=manager)
    response = api_client.post(
        '/api/notifications/send/',
        {
            'channel': 'SMS',
            'recipient_mobile': '9000000077',
            'message': 'Private job update',
            'job_id': str(job.id),
        },
        format='json',
    )

    assert response.status_code == 400
    assert not NotificationLog.objects.filter(job=job).exists()


@pytest.mark.django_db
def test_outbox_publish_failure_stays_pending_for_recovery(branch):
    from notifications.models import NotificationChannel, NotificationLog, NotificationType
    from notifications.tasks import enqueue_notification

    log = NotificationLog.objects.create(
        branch=branch,
        notification_type=NotificationType.CUSTOM,
        channel=NotificationChannel.SMS,
        recipient_mobile='9000000001',
        message='Recover me',
    )
    with patch(
        'notifications.tasks.deliver_sms.delay',
        side_effect=ConnectionError('broker unavailable'),
    ):
        assert enqueue_notification(log.pk) is False

    log.refresh_from_db()
    assert log.status == 'PENDING'
    assert log.dispatched_at is None


@pytest.mark.django_db
def test_outbox_publish_marks_dispatch_time(branch):
    from notifications.models import NotificationChannel, NotificationLog, NotificationType
    from notifications.tasks import enqueue_notification

    log = NotificationLog.objects.create(
        branch=branch,
        notification_type=NotificationType.CUSTOM,
        channel=NotificationChannel.SMS,
        recipient_mobile='9000000002',
        message='Publish me',
    )
    with patch('notifications.tasks.deliver_sms.delay') as delay:
        assert enqueue_notification(log.pk) is True

    delay.assert_called_once_with(str(log.pk))
    log.refresh_from_db()
    assert log.dispatched_at is not None


@pytest.mark.django_db
def test_provider_failure_raises_for_celery_retry(branch, monkeypatch):
    from notifications.models import NotificationChannel, NotificationLog, NotificationType
    from notifications.tasks import NotificationDeliveryFailed, deliver_sms

    log = NotificationLog.objects.create(
        branch=branch,
        notification_type=NotificationType.CUSTOM,
        channel=NotificationChannel.SMS,
        recipient_mobile='9000000003',
        message='Retry me',
    )

    def fail_delivery(mobile, message, notification_log):
        notification_log.mark_failed('temporary provider failure')

    monkeypatch.setattr(
        'notifications.services.NotificationService._send_sms',
        fail_delivery,
    )
    with pytest.raises(NotificationDeliveryFailed):
        deliver_sms.run(str(log.pk))


@pytest.mark.django_db
def test_redelivered_task_does_not_repeat_provider_call(branch, monkeypatch):
    from notifications.models import NotificationChannel, NotificationLog, NotificationType
    from notifications.tasks import deliver_sms

    log = NotificationLog.objects.create(
        branch=branch,
        notification_type=NotificationType.CUSTOM,
        channel=NotificationChannel.SMS,
        recipient_mobile='9000000004',
        message='Only once',
        status='SENDING',
    )
    provider = patch('notifications.services.NotificationService._send_sms')
    with provider as send_sms:
        deliver_sms.run(str(log.pk))
    send_sms.assert_not_called()


@pytest.mark.django_db
def test_manual_retry_returns_to_outbox(
    branch, manager, api_client, django_capture_on_commit_callbacks
):
    from notifications.models import NotificationChannel, NotificationLog, NotificationType

    log = NotificationLog.objects.create(
        branch=branch,
        notification_type=NotificationType.CUSTOM,
        channel=NotificationChannel.SMS,
        recipient_mobile='9000000005',
        message='Retry asynchronously',
        status='FAILED',
        retry_count=1,
    )
    api_client.force_authenticate(user=manager)
    with django_capture_on_commit_callbacks(execute=True), patch(
        'notifications.tasks.enqueue_notification', return_value=True
    ) as enqueue:
        response = api_client.post(f'/api/notifications/logs/{log.pk}/retry/')

    assert response.status_code == 200
    enqueue.assert_called_once_with(log.pk)
    log.refresh_from_db()
    assert log.status == 'PENDING'
    assert log.dispatched_at is None
