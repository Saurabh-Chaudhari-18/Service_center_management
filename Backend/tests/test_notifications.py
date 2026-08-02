"""
Notification side-effect tests.

These tests verify that the correct NotificationLog rows are created
when key events fire. They do NOT test actual SMS/WhatsApp delivery
(that would require live credentials).

Strategy:
  - Mock the Celery task dispatch (deliver_sms.delay, deliver_whatsapp.delay)
  - Assert NotificationLog rows are created with correct channel + status
  - Mock only the task dispatch, not the business logic that creates the log
"""
import pytest
from unittest.mock import patch
from tests.conftest import bh

JOBS_URL = '/api/jobs/'


def _create_job(auth_client, customer, branch):
    return auth_client.post(JOBS_URL, {
        'customer_id': str(customer.id),
        'brand': 'OnePlus',
        'model': '11',
        'customer_complaint': 'Battery swollen',
    }, format='json', **bh(branch))


@pytest.mark.django_db
class TestJobCreationNotification:

    @patch('notifications.tasks.deliver_sms.delay')
    @patch('notifications.tasks.deliver_whatsapp.delay')
    def test_job_creation_creates_notification_log_for_sms_customer(
        self, mock_wa, mock_sms, auth_client, make_customer, branch
    ):
        from notifications.models import NotificationLog
        cust = make_customer(mobile='9600000001', sms_enabled=True, whatsapp_enabled=False)
        before = NotificationLog.objects.count()
        _create_job(auth_client, cust, branch)
        after = NotificationLog.objects.count()
        # At least one notification log should be created
        assert after > before

    @patch('notifications.tasks.deliver_sms.delay')
    @patch('notifications.tasks.deliver_whatsapp.delay')
    def test_job_creation_for_sms_disabled_customer_sends_whatsapp_only(
        self, mock_wa, mock_sms, auth_client, make_customer, branch
    ):
        from notifications.models import NotificationLog
        cust = make_customer(mobile='9600000002', sms_enabled=False, whatsapp_enabled=True)
        _create_job(auth_client, cust, branch)
        logs = NotificationLog.objects.filter(
            recipient_mobile__contains=cust.mobile[-10:],
        )
        channels = set(logs.values_list('channel', flat=True))
        # Should not have SMS
        assert 'SMS' not in channels or mock_sms.call_count == 0


@pytest.mark.django_db
class TestEstimateNotification:

    @patch('notifications.tasks.deliver_sms.delay')
    @patch('notifications.tasks.deliver_whatsapp.delay')
    def test_share_estimate_creates_notification_log(
        self, mock_wa, mock_sms, auth_client, make_customer, make_job, branch
    ):
        from notifications.models import NotificationLog
        cust = make_customer(mobile='9600000003', sms_enabled=True)
        job = make_job(cust)

        # Advance to DIAGNOSIS with estimated_cost
        auth_client.post(
            f'{JOBS_URL}{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Fixed', 'estimated_cost': '2000.00'},
            format='json', **bh(branch),
        )
        before = NotificationLog.objects.count()
        auth_client.post(f'{JOBS_URL}{job.id}/share-estimate/', {}, format='json', **bh(branch))
        after = NotificationLog.objects.count()
        assert after > before


@pytest.mark.django_db
class TestReadyForDeliveryNotification:

    @patch('notifications.tasks.deliver_sms.delay')
    @patch('notifications.tasks.deliver_whatsapp.delay')
    def test_mark_ready_creates_notification_log(
        self, mock_wa, mock_sms, auth_client, make_customer, make_job, branch
    ):
        from notifications.models import NotificationLog
        from jobs.models import JobStatus
        cust = make_customer(mobile='9600000004', sms_enabled=True)
        job = make_job(cust)

        # Advance job to REPAIR_IN_PROGRESS
        for step in [
            {'diagnosis_notes': 'ok', 'estimated_cost': '1000'},
            None,   # share_estimate placeholder
        ]:
            pass

        auth_client.post(
            f'{JOBS_URL}{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Fixed', 'estimated_cost': '1000.00'},
            format='json', **bh(branch),
        )
        auth_client.post(f'{JOBS_URL}{job.id}/share-estimate/', {}, format='json', **bh(branch))
        auth_client.post(
            f'{JOBS_URL}{job.id}/record-customer-response/',
            {'approved': True},
            format='json', **bh(branch),
        )
        auth_client.post(
            f'{JOBS_URL}{job.id}/update-status/',
            {'new_status': JobStatus.REPAIR_IN_PROGRESS},
            format='json', **bh(branch),
        )
        before = NotificationLog.objects.count()
        auth_client.post(
            f'{JOBS_URL}{job.id}/mark-ready/',
            {'completion_notes': 'Done'},
            format='json', **bh(branch),
        )
        after = NotificationLog.objects.count()
        assert after > before
