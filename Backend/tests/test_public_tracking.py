import pytest
from django.test import override_settings
from rest_framework.test import APIClient


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_public_tracking_works_with_debug_enabled(job):
    client = APIClient()

    response = client.get(
        f'/api/jobs/public/track/{job.job_number}/',
        {
            'phone': job.customer.mobile,
            'pin': job.tracking_pin,
        },
    )

    assert response.status_code == 200
    assert response.data['job_number'] == job.job_number
    assert response.data['current_status'] == job.status