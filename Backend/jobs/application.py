"""Application-layer orchestration for job workflows."""

from django.db import transaction
from django.utils import timezone

from notifications.services import NotificationService


class JobLifecycleService:
    @staticmethod
    def transition(job, new_status, user, notes='', is_override=False):
        from jobs.models import (
            ALLOWED_STATUS_TRANSITIONS,
            InvalidStatusTransition,
            JobCard,
            JobReadOnlyError,
            JobStatus,
            JobStatusHistory,
        )

        new_status = JobStatus(new_status)
        allowed_override_roles = {'OWNER', 'MANAGER', 'SUPER_ADMIN'}
        with transaction.atomic():
            locked_job = JobCard.objects.select_for_update().get(pk=job.pk)
            old_status = JobStatus(locked_job.status)
            if locked_job.is_terminal_status() and not is_override:
                raise JobReadOnlyError(
                    f"Job {locked_job.job_number} is in "
                    f"{locked_job.get_status_display()} status and cannot be modified."
                )
            if is_override and user.role not in allowed_override_roles:
                raise InvalidStatusTransition(
                    'Only OWNER, MANAGER, or SUPER_ADMIN can override status transitions.'
                )
            if not is_override and new_status not in ALLOWED_STATUS_TRANSITIONS[old_status]:
                raise InvalidStatusTransition(
                    f"Cannot transition from {locked_job.get_status_display()} "
                    f"to {new_status.label}"
                )

            now = timezone.now()
            locked_job.status = new_status
            update_fields = ['status', 'updated_at']
            if new_status == JobStatus.READY_FOR_DELIVERY and not locked_job.actual_completion_date:
                locked_job.actual_completion_date = now
                update_fields.append('actual_completion_date')
            elif new_status == JobStatus.DELIVERED and not locked_job.delivery_date:
                locked_job.delivery_date = now
                update_fields.append('delivery_date')
            elif new_status == JobStatus.APPROVED and not locked_job.customer_approval_date:
                locked_job.customer_approval_date = now
                update_fields.append('customer_approval_date')
            locked_job.save(update_fields=update_fields)
            JobStatusHistory.objects.create(
                job=locked_job,
                from_status=old_status,
                to_status=new_status,
                changed_by=user,
                notes=notes,
                is_override=is_override,
            )
            NotificationService.on_job_status_change(
                locked_job, old_status, new_status
            )

        job.refresh_from_db()
