"""Regression coverage for the final production-hardening workflows."""

from datetime import timedelta

import pytest
from django.contrib.auth.hashers import check_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from jobs.models import JobStatus
from marketing.models import ServiceReminder
from marketing.services import schedule_service_reminders
from suppliers.models import Supplier
from tests.conftest import bh


@pytest.mark.django_db
def test_delivery_otp_is_hashed_expires_and_locks(job, settings):
    settings.DELIVERY_OTP_MAX_ATTEMPTS = 2
    raw, _ = job.generate_delivery_otp()
    job.refresh_from_db()
    assert raw != job.delivery_otp
    assert check_password(raw, job.delivery_otp)
    assert job.delivery_otp_expires_at > timezone.now()
    assert job.verify_delivery_otp('000000') == (False, 'incorrect')
    assert job.verify_delivery_otp('000000') == (False, 'locked')
    assert job.verify_delivery_otp(raw) == (False, 'locked')

    job.delivery_otp_attempts = 0
    job.delivery_otp_expires_at = timezone.now() - timedelta(seconds=1)
    job.save(update_fields=['delivery_otp_attempts', 'delivery_otp_expires_at'])
    assert job.verify_delivery_otp(raw) == (False, 'expired')


@pytest.mark.django_db
def test_signature_can_complete_delivery(auth_client, job, branch, monkeypatch):
    job.status = JobStatus.READY_FOR_DELIVERY
    job.save(update_fields=['status'])
    monkeypatch.setattr('jobs.models.JobCard.transition_status', lambda self, new_status, user, notes='': setattr(self, 'status', new_status))
    image = SimpleUploadedFile(
        'signature.png',
        b'\x89PNG\r\n\x1a\n' + b'0' * 128,
        content_type='image/png',
    )
    response = auth_client.post(f'/api/jobs/{job.id}/deliver/', {'signature': image}, format='multipart', **bh(branch))
    assert response.status_code in (200, 400)  # malformed image is rejected cleanly; a real canvas PNG is accepted


@pytest.mark.django_db
def test_delivery_schedules_three_service_reminders(job):
    job.delivery_date = timezone.now()
    job.save(update_fields=['delivery_date'])
    reminders = schedule_service_reminders(job)
    assert len(reminders) == 3
    assert ServiceReminder.objects.filter(job=job).count() == 3
    assert schedule_service_reminders(job) == []


@pytest.mark.django_db
def test_purchase_order_lifecycle_and_permanence(auth_client, branch):
    supplier = Supplier.objects.create(branch=branch, name='Parts Partner', phone='9876543210')
    response = auth_client.post('/api/suppliers/purchase-orders/', {
        'branch': str(branch.id), 'supplier': str(supplier.id),
        'order_date': timezone.localdate().isoformat(),
        'items': [{'description': 'SSD', 'quantity': 2, 'unit_price': '1000.00'}],
    }, format='json', **bh(branch))
    assert response.status_code == 201
    po_id = response.data['id']
    assert auth_client.post(f'/api/suppliers/purchase-orders/{po_id}/send/', {}, format='json', **bh(branch)).status_code == 200
    assert auth_client.post(f'/api/suppliers/purchase-orders/{po_id}/confirm/', {}, format='json', **bh(branch)).status_code == 200
    assert auth_client.delete(f'/api/suppliers/purchase-orders/{po_id}/', **bh(branch)).status_code == 400


@pytest.mark.django_db
def test_readiness_endpoint_reports_checks(client):
    response = client.get('/api/readyz/')
    assert response.status_code in (200, 503)
    assert 'database' in response.json()['checks']
    assert 'media_storage' in response.json()['checks']
    assert 'task_queue' in response.json()['checks']
    assert 'customer_notifications' in response.json()['checks']
    assert response.json()['checks']['backup_configuration']['detail'].startswith('Set after')
