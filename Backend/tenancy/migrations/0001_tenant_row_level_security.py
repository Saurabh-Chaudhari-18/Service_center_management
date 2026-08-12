from django.db import migrations


TENANT_TABLES = {
    "billing_invoice": True,
    "billing_creditnote": True,
    "customers_customer": False,
    "enquiries_enquiry": False,
    "expenses_expense": False,
    "gst_gstpayment": False,
    "gst_gstreturnstatus": False,
    "inventory_inventorycategory": True,
    "inventory_inventoryitem": False,
    "inventory_purchase": False,
    "jobs_jobcard": True,
    "jobs_pickuprequest": False,
    "jobs_outsourcevendor": True,
    "jobs_outsourcedrepair": False,
    "marketing_reminderconfig": False,
    "marketing_servicereminder": False,
    "marketing_reviewconfig": False,
    "marketing_reviewrequest": False,
    "marketing_customerledgerentry": False,
    "notifications_notificationtemplate": False,
    "notifications_notificationlog": False,
    "notifications_internalalert": False,
    "suppliers_supplier": False,
    "suppliers_purchaseorder": False,
}


def install_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    quote = schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        for table, allows_universal in TENANT_TABLES.items():
            universal_read = "OR branch_id IS NULL" if allows_universal else ""
            superuser_write = (
                "current_setting('app.tenant_superuser', true) = 'on'"
                if allows_universal
                else (
                    "(current_setting('app.tenant_superuser', true) = 'on' "
                    "AND branch_id IS NOT NULL)"
                )
            )
            branch_match = """
                branch_id::text = ANY(
                    string_to_array(
                        NULLIF(current_setting('app.allowed_branches', true), ''),
                        ','
                    )
                )
            """
            using = f"""
                current_setting('app.tenant_bypass', true) = 'on'
                OR current_setting('app.tenant_superuser', true) = 'on'
                OR {branch_match}
                {universal_read}
            """
            check = f"""
                current_setting('app.tenant_bypass', true) = 'on'
                OR {superuser_write}
                OR {branch_match}
            """
            cursor.execute(f"ALTER TABLE {quote(table)} ENABLE ROW LEVEL SECURITY")
            cursor.execute(f"ALTER TABLE {quote(table)} FORCE ROW LEVEL SECURITY")
            cursor.execute(
                f"""
                CREATE POLICY tenant_isolation ON {quote(table)}
                USING ({using})
                WITH CHECK ({check})
                """
            )


def remove_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    quote = schema_editor.quote_name
    with schema_editor.connection.cursor() as cursor:
        for table in reversed(TENANT_TABLES):
            cursor.execute(
                f"DROP POLICY IF EXISTS tenant_isolation ON {quote(table)}"
            )
            cursor.execute(f"ALTER TABLE {quote(table)} NO FORCE ROW LEVEL SECURITY")
            cursor.execute(f"ALTER TABLE {quote(table)} DISABLE ROW LEVEL SECURITY")


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0008_creditnote_idempotency_key"),
        ("customers", "0002_alter_customer_unique_together_alter_customer_branch_and_more"),
        ("enquiries", "0001_initial"),
        ("expenses", "0002_expense_cgst_amount_expense_gst_rate_and_more"),
        ("gst", "0001_initial"),
        ("inventory", "0007_universal_category_uniqueness"),
        ("jobs", "0015_remove_transition_stored_procedure"),
        ("marketing", "0004_alter_servicereminder_status"),
        ("notifications", "0005_notificationlog_sending_status"),
        ("suppliers", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(install_rls, remove_rls),
    ]
