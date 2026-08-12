import pytest
from django.db import IntegrityError, transaction

from core.models import Role
from inventory.models import InventoryCategory, InventoryItem


@pytest.mark.django_db
def test_universal_selector_is_superadmin_only_and_returns_only_universal_rows(
    api_client, make_user, branch, seed_permissions
):
    branch_category = InventoryCategory.objects.create(
        branch=branch, name='Branch category'
    )
    universal_category = InventoryCategory.objects.create(
        branch=None, name='Universal category'
    )
    owner = make_user(role=Role.OWNER)
    api_client.force_authenticate(owner)

    denied = api_client.get(
        '/api/inventory/categories/', HTTP_X_BRANCH_ID='universal'
    )
    assert denied.status_code == 403

    superadmin = make_user(role=Role.SUPER_ADMIN)
    api_client.force_authenticate(superadmin)
    response = api_client.get(
        '/api/inventory/categories/', HTTP_X_BRANCH_ID='universal'
    )
    assert response.status_code == 200
    rows = response.data.get('results', response.data)
    ids = {row['id'] for row in rows}
    assert ids == {str(universal_category.pk)}
    assert str(branch_category.pk) not in ids


@pytest.mark.django_db
def test_accidentally_unscoped_tenant_row_is_rejected(
    auth_client, branch, seed_permissions
):
    visible = InventoryItem.objects.create(
        branch=branch,
        name='Visible part',
        sku='VISIBLE',
        cost_price='10.00',
        selling_price='12.00',
        gst_rate='18.00',
    )
    with pytest.raises(IntegrityError), transaction.atomic():
        InventoryItem.objects.create(
            branch=None,
            name='Unscoped part',
            sku='UNSCOPED',
            cost_price='10.00',
            selling_price='12.00',
            gst_rate='18.00',
        )

    response = auth_client.get(
        '/api/inventory/items/', HTTP_X_BRANCH_ID=str(branch.pk)
    )
    assert response.status_code == 200
    rows = response.data.get('results', response.data)
    ids = {row['id'] for row in rows}
    assert str(visible.pk) in ids
