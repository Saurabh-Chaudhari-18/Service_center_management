import pytest
from django.test import override_settings

from core.exceptions import InvalidStatusTransition, JobReadOnlyError
from jobs.models import ALLOWED_STATUS_TRANSITIONS, JobCard, JobStatus
from jobs.services import apply_diagnosis


def _transition_procedure_installed():
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE p.proname = 'transition_job_status' AND n.nspname = 'public'
            """
        )
        return cursor.fetchone() is not None


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
        if not _transition_procedure_installed():
            pytest.skip(
                'PostgreSQL procedure transition_job_status is missing; '
                'run Backend/db_setup_script.sql after migrate.'
            )
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
        if not _transition_procedure_installed():
            pytest.skip(
                'PostgreSQL procedure transition_job_status is missing; '
                'run Backend/db_setup_script.sql after migrate.'
            )
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
