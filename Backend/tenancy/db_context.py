"""Database tenant context used by PostgreSQL row-level-security policies."""

from django.db import connections
from django.db.backends.signals import connection_created
from django.dispatch import receiver


SETTING_NAMES = (
    "app.tenant_bypass",
    "app.tenant_superuser",
    "app.allowed_branches",
)


def _set(connection, **values):
    if connection.vendor != "postgresql":
        return
    with connection.cursor() as cursor:
        for name, value in values.items():
            cursor.execute("SELECT set_config(%s, %s, false)", [name, str(value)])


@receiver(connection_created)
def initialize_tenant_context(sender, connection, **kwargs):
    # Management commands, migrations, and workers start in an explicit system
    # context. Authenticated HTTP requests switch this off after identity lookup.
    _set(
        connection,
        **{
            "app.tenant_bypass": "on",
            "app.tenant_superuser": "off",
            "app.allowed_branches": "",
        },
    )


def activate_tenant_context(user, using="default"):
    connection = connections[using]
    is_superuser = getattr(user, "role", None) == "SUPER_ADMIN"
    branch_ids = ""
    if not is_superuser:
        branch_ids = ",".join(
            str(value)
            for value in user.get_accessible_branches().values_list("pk", flat=True)
        )
    _set(
        connection,
        **{
            "app.allowed_branches": branch_ids,
            "app.tenant_superuser": "on" if is_superuser else "off",
            "app.tenant_bypass": "off",
        },
    )


def reset_tenant_context(using="default"):
    connection = connections[using]
    if connection.connection is None:
        return
    _set(
        connection,
        **{
            "app.tenant_bypass": "on",
            "app.tenant_superuser": "off",
            "app.allowed_branches": "",
        },
    )
