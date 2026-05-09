"""
Data migration: seed default RolePermission rows for all six roles.

These rows drive the DB-driven permission matrix returned by the /me endpoint.
Without them, get_permissions_for_role() returns all-False and every user sees
"Access Denied" on every page.
"""

from django.db import migrations

DEFAULTS = {
    'SUPER_ADMIN': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   True,
        'can_create_job_cards': True,
        'can_edit_job_cards':   True,
        'can_view_inventory':   True,
        'can_manage_inventory': True,
        'can_view_billing':     False,
        'can_create_invoices':  False,
        'can_view_reports':     True,
        'can_manage_branches':  True,
        'can_manage_users':     True,
        'can_view_pickups':     True,
    },
    'OWNER': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   True,
        'can_create_job_cards': True,
        'can_edit_job_cards':   True,
        'can_view_inventory':   True,
        'can_manage_inventory': True,
        'can_view_billing':     True,
        'can_create_invoices':  True,
        'can_view_reports':     True,
        'can_manage_branches':  True,
        'can_manage_users':     True,
        'can_view_pickups':     True,
    },
    'MANAGER': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   True,
        'can_create_job_cards': True,
        'can_edit_job_cards':   True,
        'can_view_inventory':   True,
        'can_manage_inventory': True,
        'can_view_billing':     False,
        'can_create_invoices':  False,
        'can_view_reports':     True,
        'can_manage_branches':  False,
        'can_manage_users':     False,
        'can_view_pickups':     True,
    },
    'RECEPTIONIST': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   True,
        'can_create_job_cards': True,
        'can_edit_job_cards':   True,
        'can_view_inventory':   False,
        'can_manage_inventory': False,
        'can_view_billing':     False,
        'can_create_invoices':  False,
        'can_view_reports':     False,
        'can_manage_branches':  False,
        'can_manage_users':     False,
        'can_view_pickups':     True,
    },
    'TECHNICIAN': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   True,
        'can_create_job_cards': False,
        'can_edit_job_cards':   True,
        'can_view_inventory':   False,
        'can_manage_inventory': False,
        'can_view_billing':     False,
        'can_create_invoices':  False,
        'can_view_reports':     False,
        'can_manage_branches':  False,
        'can_manage_users':     False,
        'can_view_pickups':     True,
    },
    'ACCOUNTANT': {
        'can_view_dashboard':   True,
        'can_view_job_cards':   False,
        'can_create_job_cards': False,
        'can_edit_job_cards':   False,
        'can_view_inventory':   False,
        'can_manage_inventory': False,
        'can_view_billing':     True,
        'can_create_invoices':  True,
        'can_view_reports':     True,
        'can_manage_branches':  False,
        'can_manage_users':     False,
        'can_view_pickups':     False,
    },
}


def seed(apps, schema_editor):
    RolePermission = apps.get_model('core', 'RolePermission')
    for role, perms in DEFAULTS.items():
        RolePermission.objects.update_or_create(role=role, defaults=perms)


def unseed(apps, schema_editor):
    RolePermission = apps.get_model('core', 'RolePermission')
    RolePermission.objects.filter(role__in=DEFAULTS.keys()).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_add_branch_sequence_model'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
