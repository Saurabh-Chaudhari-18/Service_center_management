import pytest
from django.test import override_settings

from core.exceptions import InvalidStatusTransition, JobReadOnlyError
from jobs.models import ALLOWED_STATUS_TRANSITIONS, JobCard, JobStatus
from jobs.services import apply_diagnosis


@pytest.mark.django_db
class TestStatusTransitions:
    """Allowed transitions succeed; invalid transitions raise."""

    def _make_job(self, branch, received_by):
        from customers.models import Customer

        customer = Customer.objects.create(
            branch=branch,
            first_name='Test',
            last_name='Customer',
            mobile='9000000001',
        )
        return JobCard.objects.create(
            branch=branch,
            customer=customer,
            brand='Samsung',
            model='Galaxy S21',
            customer_complaint='Battery issue',
            status=JobStatus.RECEIVED,
            received_by=received_by,
        )

    def test_received_to_diagnosis(self, branch, owner):
        job = self._make_job(branch, owner)
        job.transition_status(JobStatus.DIAGNOSIS, owner, 'Starting diagnosis')
        assert job.status == JobStatus.DIAGNOSIS

    def test_received_to_repair_invalid(self, branch, owner):
        job = self._make_job(branch, owner)
        with pytest.raises(InvalidStatusTransition):
            job.transition_status(JobStatus.REPAIR_IN_PROGRESS, owner, 'Skip diagnosis')

    def test_can_transition_flags_match_policy(self, branch, owner):
        job = self._make_job(branch, owner)
        assert job.can_transition_to(JobStatus.DIAGNOSIS) is True
        assert job.can_transition_to(JobStatus.REPAIR_IN_PROGRESS) is False

    def test_terminal_status_blocks_transition(self, branch, owner):
        job = self._make_job(branch, owner)
        job.status = JobStatus.DELIVERED
        job.save()
        with pytest.raises(JobReadOnlyError):
            job.transition_status(JobStatus.DIAGNOSIS, owner, 'Reopen')

    def test_all_allowed_transitions_exist_in_map(self):
        for status in JobStatus:
            assert status in ALLOWED_STATUS_TRANSITIONS

    def test_apply_diagnosis_transitions_to_diagnosis(self, branch, owner):
        job = self._make_job(branch, owner)
        apply_diagnosis(job, {'diagnosis_notes': 'Screen crack detected'}, owner)
        job.refresh_from_db()
        assert job.status == JobStatus.DIAGNOSIS
        assert job.diagnosis_notes == 'Screen crack detected'

    def test_apply_diagnosis_rejects_terminal_non_owner(self, branch, technician):
        job = self._make_job(branch, technician)
        job.status = JobStatus.DELIVERED
        job.save(update_fields=['status'])
        with pytest.raises(ValueError, match='completed'):
            apply_diagnosis(job, {'diagnosis_notes': 'Late fix'}, technician)

    def test_transition_revalidates_the_locked_database_state(self, branch, owner):
        job = self._make_job(branch, owner)
        stale_job = JobCard.objects.get(pk=job.pk)

        job.transition_status(JobStatus.DIAGNOSIS, owner, 'First request')

        with pytest.raises(InvalidStatusTransition):
            stale_job.transition_status(JobStatus.DIAGNOSIS, owner, 'Stale request')

        job.refresh_from_db()
        assert job.status == JobStatus.DIAGNOSIS
        assert list(job.status_history.values_list('to_status', flat=True)) == [
            JobStatus.DIAGNOSIS,
        ]

    def test_override_requires_an_authorized_role(self, branch, technician):
        job = self._make_job(branch, technician)

        with pytest.raises(InvalidStatusTransition, match='Only OWNER'):
            job.transition_status(
                JobStatus.DELIVERED,
                technician,
                'Unauthorized override',
                is_override=True,
            )


@pytest.mark.django_db
class TestEncryptionRoundTrip:
    """Device password is stored encrypted; property returns plaintext."""

    @override_settings(ENCRYPTION_KEY='')
    def test_password_encrypted_at_rest(self, branch, owner):
        from customers.models import Customer

        customer = Customer.objects.create(
            branch=branch,
            first_name='Encrypt',
            last_name='Test',
            mobile='9000000002',
        )
        original_password = 'MySecret@123'
        job = JobCard.objects.create(
            branch=branch,
            customer=customer,
            brand='Apple',
            model='iPhone 14',
            customer_complaint='Unlock needed',
            status=JobStatus.RECEIVED,
            received_by=owner,
        )
        job.device_password = original_password
        job.save()
        job.refresh_from_db()
        assert job.device_password == original_password
        assert job._device_password != original_password


@pytest.mark.django_db
class TestOutsourcedRepairReturn:
    """Both return routes enforce the same validated job transition rules."""

    def test_return_action_rejects_arbitrary_job_status(
        self, api_client, owner, branch, seed_permissions
    ):
        from datetime import date
        from customers.models import Customer
        from jobs.models import (
            OutsourcedRepair, OutsourceVendor, RepairOutcome,
            OutsourcedRepairStatus,
        )

        customer = Customer.objects.create(
            branch=branch,
            first_name='Outsource',
            last_name='Customer',
            mobile='9000000099',
        )
        job = JobCard.objects.create(
            branch=branch,
            customer=customer,
            brand='Dell',
            model='Latitude',
            customer_complaint='Motherboard repair',
            status=JobStatus.OUTSOURCED,
            received_by=owner,
        )
        vendor = OutsourceVendor.objects.create(
            branch=branch,
            name='Board Repair Lab',
            phone='9000000088',
        )
        outsource = OutsourcedRepair.objects.create(
            branch=branch,
            job=job,
            vendor=vendor,
            reason='Board-level repair',
            sent_date=date.today(),
            sent_by=owner,
        )

        api_client.force_authenticate(user=owner)
        response = api_client.post(
            f'/api/jobs/outsourced-repairs/{outsource.id}/return/',
            {
                'return_date': date.today().isoformat(),
                'repair_outcome': RepairOutcome.REPAIRED,
                'new_job_status': JobStatus.DELIVERED,
            },
            format='json',
        )

        assert response.status_code == 400
        outsource.refresh_from_db()
        job.refresh_from_db()
        assert outsource.status == OutsourcedRepairStatus.SENT
        assert job.status == JobStatus.OUTSOURCED
