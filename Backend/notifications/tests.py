from django.test import TestCase

# Create your tests here.

import pytest


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