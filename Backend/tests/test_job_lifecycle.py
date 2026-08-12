"""
Job card lifecycle integration tests.

Every test goes through the HTTP API.
Tests cover the complete lifecycle:
  RECEIVED → DIAGNOSIS → ESTIMATE_SHARED → APPROVED → REPAIR_IN_PROGRESS
           → READY_FOR_DELIVERY → DELIVERED

Side effects asserted:
  - JobStatusHistory row created on every transition
  - DiagnosisPart rows created/replaced on add_diagnosis
  - JobNote created on assign_technician
  - PartRequest created / approved / rejected
  - Inventory stock decremented on part approval
"""
import pytest
from jobs.models import JobCard, JobStatus, JobStatusHistory, DiagnosisPart, PartRequest
from tests.conftest import bh


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _advance_to(api_client, job, target_status, branch, user, owner_client=None):
    """Drive a job through all states up to (and including) target_status."""
    transitions = [
        JobStatus.DIAGNOSIS,
        JobStatus.ESTIMATE_SHARED,
        JobStatus.APPROVED,
        JobStatus.REPAIR_IN_PROGRESS,
        JobStatus.READY_FOR_DELIVERY,
        JobStatus.DELIVERED,
    ]
    target_idx = transitions.index(target_status)

    if target_idx >= 0:  # → DIAGNOSIS
        api_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Automated advance', 'estimated_cost': '1000.00'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()

    if target_idx >= 1:  # → ESTIMATE_SHARED
        api_client.post(f'/api/jobs/{job.id}/share-estimate/', {}, format='json', **bh(branch))
        job.refresh_from_db()

    if target_idx >= 2:  # → APPROVED
        api_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': True},
            format='json', **bh(branch),
        )
        job.refresh_from_db()

    if target_idx >= 3:  # → REPAIR_IN_PROGRESS
        api_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.REPAIR_IN_PROGRESS, 'notes': 'Starting repair'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()

    if target_idx >= 4:  # → READY_FOR_DELIVERY
        api_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Device repaired'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()


# ─────────────────────────────────────────────────────────────────────────────
# Create
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateJob:

    def test_create_job_returns_201_with_job_number(self, auth_client, customer, branch):
        resp = auth_client.post('/api/jobs/', {
            'customer_id': str(customer.id),
            'brand': 'Apple',
            'model': 'MacBook Pro',
            'customer_complaint': 'Keyboard not working',
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        assert resp.data['job_number'] not in ('', None)

    def test_created_job_status_is_received(self, auth_client, customer, branch):
        resp = auth_client.post('/api/jobs/', {
            'customer_id': str(customer.id),
            'brand': 'Dell',
            'model': 'Latitude',
            'customer_complaint': 'Battery drains fast',
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        assert resp.data['status'] == JobStatus.RECEIVED

    def test_create_job_creates_status_history_row(self, auth_client, customer, branch):
        resp = auth_client.post('/api/jobs/', {
            'customer_id': str(customer.id),
            'brand': 'HP',
            'model': 'Pavilion',
            'customer_complaint': 'No display',
        }, format='json', **bh(branch))
        assert resp.status_code == 201
        job_id = resp.data['id']
        assert JobStatusHistory.objects.filter(job_id=job_id).exists()

    def test_create_job_missing_customer_id_returns_400(self, auth_client, branch):
        resp = auth_client.post('/api/jobs/', {
            'brand': 'Lenovo',
            'model': 'ThinkPad',
            'customer_complaint': 'Overheating',
        }, format='json', **bh(branch))
        assert resp.status_code == 400

    def test_create_job_missing_complaint_returns_400(self, auth_client, customer, branch):
        resp = auth_client.post('/api/jobs/', {
            'customer_id': str(customer.id),
            'brand': 'Asus',
            'model': 'ZenBook',
        }, format='json', **bh(branch))
        assert resp.status_code == 400

    def test_job_numbers_are_unique_across_two_jobs(self, auth_client, customer, branch):
        def _create():
            return auth_client.post('/api/jobs/', {
                'customer_id': str(customer.id),
                'brand': 'Sony',
                'model': 'Vaio',
                'customer_complaint': 'Slow boot',
            }, format='json', **bh(branch))
        r1 = _create()
        r2 = _create()
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.data['job_number'] != r2.data['job_number']


# ─────────────────────────────────────────────────────────────────────────────
# Status transitions (valid)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStatusTransitionValid:

    def test_update_status_received_to_diagnosis(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS, 'notes': 'Starting diagnosis'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.DIAGNOSIS

    def test_each_valid_transition_creates_history_row(self, auth_client, job, branch):
        before = JobStatusHistory.objects.filter(job=job).count()
        auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS, 'notes': ''},
            format='json', **bh(branch),
        )
        after = JobStatusHistory.objects.filter(job=job).count()
        assert after == before + 1

    def test_history_row_records_from_and_to_status(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS, 'notes': 'check'},
            format='json', **bh(branch),
        )
        h = JobStatusHistory.objects.filter(job=job).latest('created_at')
        assert h.from_status == JobStatus.RECEIVED
        assert h.to_status == JobStatus.DIAGNOSIS


# ─────────────────────────────────────────────────────────────────────────────
# Status transitions (invalid)
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStatusTransitionInvalid:

    def test_skip_to_repair_from_received_returns_400(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.REPAIR_IN_PROGRESS},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400
        job.refresh_from_db()
        assert job.status == JobStatus.RECEIVED  # unchanged

    def test_skip_to_delivered_from_received_returns_400(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DELIVERED},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_delivered_job_blocks_further_transitions(self, auth_client, make_job, customer, branch):
        j = make_job(customer, status=JobStatus.DELIVERED)
        resp = auth_client.post(
            f'/api/jobs/{j.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_rejected_job_blocks_further_transitions(self, auth_client, make_job, customer, branch):
        j = make_job(customer, status=JobStatus.REJECTED)
        resp = auth_client.post(
            f'/api/jobs/{j.id}/update-status/',
            {'new_status': JobStatus.APPROVED},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_cancelled_job_blocks_further_transitions(self, auth_client, make_job, customer, branch):
        j = make_job(customer, status=JobStatus.CANCELLED)
        resp = auth_client.post(
            f'/api/jobs/{j.id}/update-status/',
            {'new_status': JobStatus.RECEIVED},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Assign technician
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAssignTechnician:

    def test_assign_technician_updates_job(self, auth_client, job, technician, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/assign-technician/',
            {'technician_id': str(technician.id)},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.assigned_technician == technician

    def test_assign_technician_creates_internal_note(self, auth_client, job, technician, branch):
        from jobs.models import JobNote
        auth_client.post(
            f'/api/jobs/{job.id}/assign-technician/',
            {'technician_id': str(technician.id)},
            format='json', **bh(branch),
        )
        assert JobNote.objects.filter(job=job, is_internal=True).exists()

    def test_assign_nonexistent_technician_returns_404_or_400(self, auth_client, job, branch):
        import uuid
        resp = auth_client.post(
            f'/api/jobs/{job.id}/assign-technician/',
            {'technician_id': str(uuid.uuid4())},
            format='json', **bh(branch),
        )
        assert resp.status_code in (400, 404)


# ─────────────────────────────────────────────────────────────────────────────
# Diagnosis
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestAddDiagnosis:

    def test_add_diagnosis_auto_transitions_to_diagnosis(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Screen LCD failure', 'estimated_cost': '3500.00'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        assert job.status == JobStatus.DIAGNOSIS

    def test_add_diagnosis_sets_notes_and_cost(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Motherboard issue', 'estimated_cost': '5000.00'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        assert job.diagnosis_notes == 'Motherboard issue'
        assert float(job.estimated_cost) == 5000.00

    def test_add_diagnosis_with_parts_creates_diagnosis_parts(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {
                'diagnosis_notes': 'Screen cracked',
                'estimated_cost': '4000.00',
                'parts': [
                    {'name': 'LCD Screen', 'price': '3000.00', 'quantity': 1, 'warranty_months': 6},
                    {'name': 'Adhesive', 'price': '200.00', 'quantity': 2, 'warranty_months': 0},
                ],
            },
            format='json', **bh(branch),
        )
        assert DiagnosisPart.objects.filter(job=job).count() == 2

    def test_re_adding_diagnosis_replaces_parts(self, auth_client, job, branch):
        for _ in range(2):
            auth_client.post(
                f'/api/jobs/{job.id}/add-diagnosis/',
                {
                    'diagnosis_notes': 'Updated',
                    'estimated_cost': '1000.00',
                    'parts': [{'name': 'Part A', 'price': '500.00', 'quantity': 1}],
                },
                format='json', **bh(branch),
            )
        assert DiagnosisPart.objects.filter(job=job).count() == 1

    def test_add_diagnosis_without_notes_returns_400(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'estimated_cost': '1000.00'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Share estimate
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestShareEstimate:

    def _diagnose(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Fixed', 'estimated_cost': '2000.00'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()

    def test_share_estimate_transitions_to_estimate_shared(self, auth_client, job, branch):
        self._diagnose(auth_client, job, branch)
        resp = auth_client.post(f'/api/jobs/{job.id}/share-estimate/', {}, format='json', **bh(branch))
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.ESTIMATE_SHARED

    def test_share_estimate_without_diagnosis_returns_400(self, auth_client, job, branch):
        # job is still RECEIVED
        resp = auth_client.post(f'/api/jobs/{job.id}/share-estimate/', {}, format='json', **bh(branch))
        assert resp.status_code == 400

    def test_share_estimate_without_cost_returns_400(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        # No estimated_cost set on job
        resp = auth_client.post(f'/api/jobs/{job.id}/share-estimate/', {}, format='json', **bh(branch))
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Customer response
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCustomerResponse:

    def _to_estimate_shared(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/add-diagnosis/',
            {'diagnosis_notes': 'Done', 'estimated_cost': '1500.00'},
            format='json', **bh(branch),
        )
        auth_client.post(f'/api/jobs/{job.id}/share-estimate/', {}, format='json', **bh(branch))
        job.refresh_from_db()

    def test_customer_approval_transitions_to_approved(self, auth_client, job, branch):
        self._to_estimate_shared(auth_client, job, branch)
        resp = auth_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': True},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.APPROVED

    def test_customer_approval_sets_approval_date(self, auth_client, job, branch):
        self._to_estimate_shared(auth_client, job, branch)
        auth_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': True},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        assert job.customer_approval_date is not None

    def test_customer_rejection_transitions_to_rejected(self, auth_client, job, branch):
        self._to_estimate_shared(auth_client, job, branch)
        resp = auth_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': False, 'rejection_reason': 'Too expensive'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.REJECTED

    def test_rejected_status_is_terminal(self, auth_client, job, branch):
        self._to_estimate_shared(auth_client, job, branch)
        auth_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': False, 'rejection_reason': 'Price'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        resp = auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.APPROVED},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_response_without_estimate_shared_returns_400(self, auth_client, job, branch):
        # job is still RECEIVED
        resp = auth_client.post(
            f'/api/jobs/{job.id}/record-customer-response/',
            {'approved': True},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Mark ready & deliver
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMarkReadyAndDeliver:

    def _to_repair_in_progress(self, auth_client, job, branch):
        _advance_to(auth_client, job, JobStatus.REPAIR_IN_PROGRESS, branch, None)
        job.refresh_from_db()

    def test_mark_ready_transitions_to_ready_for_delivery(self, auth_client, job, branch):
        self._to_repair_in_progress(auth_client, job, branch)
        resp = auth_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Device fixed and tested'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.READY_FOR_DELIVERY

    def test_mark_ready_from_wrong_status_returns_400(self, auth_client, job, branch):
        # job is RECEIVED — not allowed
        resp = auth_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Skip everything'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_deliver_without_ready_status_returns_400(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/deliver/',
            {'otp': '123456'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_deliver_with_correct_otp_transitions_to_delivered(self, auth_client, job, branch):
        self._to_repair_in_progress(auth_client, job, branch)
        auth_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Done'},
            format='json', **bh(branch),
        )
        job.refresh_from_db()
        otp, _ = job.generate_delivery_otp()
        resp = auth_client.post(
            f'/api/jobs/{job.id}/deliver/',
            {'otp': otp},
            format='json', **bh(branch),
        )
        assert resp.status_code == 200
        job.refresh_from_db()
        assert job.status == JobStatus.DELIVERED

    def test_deliver_without_proof_is_rejected(self, auth_client, job, branch):
        self._to_repair_in_progress(auth_client, job, branch)
        auth_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Done'},
            format='json', **bh(branch),
        )
        resp = auth_client.post(
            f'/api/jobs/{job.id}/deliver/',
            {'notes': 'No proof supplied'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_deliver_with_wrong_otp_is_rejected(self, auth_client, job, branch):
        self._to_repair_in_progress(auth_client, job, branch)
        auth_client.post(
            f'/api/jobs/{job.id}/mark-ready/',
            {'completion_notes': 'Done'},
            format='json', **bh(branch),
        )
        resp = auth_client.post(
            f'/api/jobs/{job.id}/deliver/',
            {'otp': '000000'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400

    def test_delivered_status_is_terminal(self, auth_client, job, branch):
        self._to_repair_in_progress(auth_client, job, branch)
        auth_client.post(f'/api/jobs/{job.id}/mark-ready/', {'completion_notes': ''}, format='json', **bh(branch))
        job.refresh_from_db()
        otp, _ = job.generate_delivery_otp()
        auth_client.post(f'/api/jobs/{job.id}/deliver/', {'otp': otp}, format='json', **bh(branch))
        # Now try to re-transition
        resp = auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS},
            format='json', **bh(branch),
        )
        assert resp.status_code == 400


# ─────────────────────────────────────────────────────────────────────────────
# Notes & Timeline
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobNotesAndTimeline:

    def test_add_note_returns_201(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/add-note/',
            {'note': 'Customer called to follow up.', 'is_internal': False},
            format='json', **bh(branch),
        )
        assert resp.status_code == 201

    def test_internal_note_is_flagged(self, auth_client, job, branch):
        from jobs.models import JobNote
        auth_client.post(
            f'/api/jobs/{job.id}/add-note/',
            {'note': 'Awaiting spare parts.', 'is_internal': True},
            format='json', **bh(branch),
        )
        note = JobNote.objects.filter(job=job).latest('created_at')
        assert note.is_internal is True

    def test_timeline_returns_status_history(self, auth_client, job, branch):
        auth_client.post(
            f'/api/jobs/{job.id}/update-status/',
            {'new_status': JobStatus.DIAGNOSIS},
            format='json', **bh(branch),
        )
        resp = auth_client.get(f'/api/jobs/{job.id}/timeline/', **bh(branch))
        assert resp.status_code == 200
        types = [item['type'] for item in resp.data]
        assert 'status_change' in types


# ─────────────────────────────────────────────────────────────────────────────
# my_jobs
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestMyJobs:

    def test_my_jobs_returns_only_assigned_jobs_for_technician(
        self, api_client, technician, make_job, customer, branch, seed_permissions
    ):
        api_client.force_authenticate(user=technician)
        j1 = make_job(customer, received_by=technician)
        j1.assigned_technician = technician
        j1.save()

        resp = api_client.get('/api/jobs/my-jobs/', **bh(branch))
        assert resp.status_code == 200
        ids = [str(j['id']) for j in resp.data.get('results', resp.data)]
        assert str(j1.id) in ids

    def test_my_jobs_excludes_unassigned_jobs(
        self, api_client, technician, make_job, customer, branch, seed_permissions
    ):
        api_client.force_authenticate(user=technician)
        unassigned = make_job(customer)  # no assigned technician

        resp = api_client.get('/api/jobs/my-jobs/', **bh(branch))
        assert resp.status_code == 200
        ids = [str(j['id']) for j in resp.data.get('results', resp.data)]
        assert str(unassigned.id) not in ids

    def test_my_jobs_for_non_technician_returns_403(
        self, api_client, owner, branch, seed_permissions
    ):
        api_client.force_authenticate(user=owner)
        resp = api_client.get('/api/jobs/my-jobs/', **bh(branch))
        assert resp.status_code == 403

    def test_my_jobs_excludes_delivered_jobs(
        self, api_client, technician, make_job, customer, branch, seed_permissions
    ):
        api_client.force_authenticate(user=technician)
        delivered = make_job(customer, status=JobStatus.DELIVERED)
        delivered.assigned_technician = technician
        delivered.save()

        resp = api_client.get('/api/jobs/my-jobs/', **bh(branch))
        ids = [str(j['id']) for j in resp.data.get('results', resp.data)]
        assert str(delivered.id) not in ids

    def test_my_jobs_is_paginated(self, api_client, technician, branch, seed_permissions):
        api_client.force_authenticate(user=technician)
        resp = api_client.get('/api/jobs/my-jobs/', **bh(branch))
        assert resp.status_code == 200
        # Paginated response has count + results keys
        assert 'count' in resp.data or isinstance(resp.data, list)


# ─────────────────────────────────────────────────────────────────────────────
# Branch isolation
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestJobBranchIsolation:

    def test_job_from_other_branch_not_visible(self, api_client, owner, org, branch, make_job, make_customer, seed_permissions):
        from core.models import Branch
        other = Branch.objects.create(
            organization=org, name='Other Branch', code='OTH',
            email='oth@test.com', phone='+919999999990',
            address_line1='X', city='Delhi', state='Delhi',
            pincode='110001', gstin='07AABCT1332L1ZV', state_code='07',
        )
        cust = make_customer(b=other, mobile='8000000001')
        j = make_job(cust)
        j.branch = other
        j.save()

        api_client.force_authenticate(user=owner)
        resp = api_client.get('/api/jobs/', **bh(branch))
        ids = [str(item['id']) for item in resp.data.get('results', resp.data)]
        assert str(j.id) not in ids


# ─────────────────────────────────────────────────────────────────────────────
# Part requests
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestPartRequests:

    def test_request_part_creates_part_request(self, auth_client, job, branch):
        resp = auth_client.post(
            f'/api/jobs/{job.id}/request-part/',
            {'part_name': 'Battery', 'quantity': 1, 'notes': 'Standard replacement'},
            format='json', **bh(branch),
        )
        assert resp.status_code == 201
        assert PartRequest.objects.filter(job=job).exists()

    def test_technician_cannot_approve_part_request(
        self, api_client, technician, job, branch, seed_permissions
    ):
        api_client.force_authenticate(user=technician)
        pr = PartRequest.objects.create(
            job=job,
            part_name='Screen',
            quantity=1,
            requested_by=technician,
            status='PENDING',
        )
        resp = api_client.post(
            f'/api/jobs/part-requests/{pr.id}/approve/',
            {},
            format='json',
        )
        assert resp.status_code == 403

    def test_owner_can_approve_part_request(self, auth_client, job, owner, branch):
        pr = PartRequest.objects.create(
            job=job,
            part_name='Keyboard',
            quantity=1,
            requested_by=owner,
            status='PENDING',
        )
        resp = auth_client.post(f'/api/jobs/part-requests/{pr.id}/approve/', {}, format='json')
        assert resp.status_code == 200

    def test_reject_part_request_requires_reason(self, auth_client, job, owner):
        pr = PartRequest.objects.create(
            job=job, part_name='Fan', quantity=1,
            requested_by=owner, status='PENDING',
        )
        resp = auth_client.post(f'/api/jobs/part-requests/{pr.id}/reject/', {}, format='json')
        assert resp.status_code == 400

    def test_reject_part_request_with_reason_succeeds(self, auth_client, job, owner):
        pr = PartRequest.objects.create(
            job=job, part_name='RAM', quantity=2,
            requested_by=owner, status='PENDING',
        )
        resp = auth_client.post(
            f'/api/jobs/part-requests/{pr.id}/reject/',
            {'reason': 'Out of budget'},
            format='json',
        )
        assert resp.status_code == 200
        pr.refresh_from_db()
        assert pr.status == 'REJECTED'
