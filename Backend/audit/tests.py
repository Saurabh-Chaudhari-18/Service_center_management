import pytest

from audit.models import AuditLog
from audit.services import AuditLogService


@pytest.mark.django_db
def test_audit_log_can_be_created_but_not_modified_or_deleted(owner):
    log = AuditLogService.log(
        user=owner,
        action='CREATE',
        model_name='TestObject',
        object_id='object-1',
        details={'source': 'test'},
    )

    assert log is not None
    assert AuditLog.objects.filter(pk=log.pk).exists()
    log.details = {'changed': True}
    with pytest.raises(ValueError, match='immutable'):
        log.save()
    with pytest.raises(ValueError, match='cannot be deleted'):
        log.delete()


@pytest.mark.django_db
def test_branch_scoped_create_is_audited(auth_client, branch, seed_permissions):
    response = auth_client.post('/api/customers/', {
        'branch': str(branch.id),
        'first_name': 'Audit',
        'last_name': 'Customer',
        'mobile': '9898989898',
    }, format='json', HTTP_X_BRANCH_ID=str(branch.id))

    assert response.status_code == 201
    assert AuditLog.objects.filter(
        action='CREATE',
        model_name='Customer',
        object_id=response.data['id'],
    ).exists()
