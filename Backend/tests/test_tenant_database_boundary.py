import importlib
from unittest import skipUnless

from django.apps import apps
from django.db import connection
from django.test import SimpleTestCase, TransactionTestCase


rls_migration = importlib.import_module(
    "tenancy.migrations.0001_tenant_row_level_security"
)


class TenantPolicyCoverageTests(SimpleTestCase):
    def test_every_direct_branch_model_has_an_rls_policy(self):
        excluded = {
            # Internal counters are only reached through a row-locked Branch
            # workflow and are not exposed as tenant resources.
            "core_branchsequence",
        }
        missing = []
        for model in apps.get_models():
            if model._meta.abstract:
                continue
            try:
                model._meta.get_field("branch")
            except Exception:
                continue
            table = model._meta.db_table
            if table not in rls_migration.TENANT_TABLES and table not in excluded:
                missing.append(table)
        assert missing == []

    def test_only_declared_resource_types_allow_universal_rows(self):
        universal = {
            table
            for table, allows_universal in rls_migration.TENANT_TABLES.items()
            if allows_universal
        }
        assert universal == {
            "billing_creditnote",
            "billing_invoice",
            "inventory_inventorycategory",
            "jobs_jobcard",
            "jobs_outsourcevendor",
        }


@skipUnless(connection.vendor == "postgresql", "PostgreSQL policy introspection")
class PostgreSQLTenantPolicyTests(TransactionTestCase):
    reset_sequences = False

    def test_all_tables_have_forced_row_level_security_and_policy(self):
        tables = tuple(rls_migration.TENANT_TABLES)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
                FROM pg_class c
                WHERE c.relname = ANY(%s)
                """,
                [list(tables)],
            )
            security = {
                name: (enabled, forced)
                for name, enabled, forced in cursor.fetchall()
            }
            cursor.execute(
                """
                SELECT tablename
                FROM pg_policies
                WHERE policyname = 'tenant_isolation'
                  AND tablename = ANY(%s)
                """,
                [list(tables)],
            )
            policies = {row[0] for row in cursor.fetchall()}

        assert set(security) == set(tables)
        assert all(enabled and forced for enabled, forced in security.values())
        assert policies == set(tables)
