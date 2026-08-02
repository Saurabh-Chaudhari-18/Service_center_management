from django.db import migrations


CREATE_PROCEDURE_SQL = """
CREATE OR REPLACE PROCEDURE transition_job_status(
    p_job_id UUID,
    p_new_status VARCHAR(20),
    p_user_id UUID,
    p_notes TEXT DEFAULT '',
    p_is_override BOOLEAN DEFAULT FALSE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_status VARCHAR(20);
    v_user_role VARCHAR(20);
BEGIN
    SELECT status INTO v_current_status
    FROM jobs_jobcard
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    IF v_current_status IN ('DELIVERED', 'CANCELLED', 'REJECTED') AND NOT p_is_override THEN
        RAISE EXCEPTION 'Job is in terminal status: %', v_current_status;
    END IF;

    IF p_is_override THEN
        SELECT role INTO v_user_role
        FROM core_user
        WHERE id = p_user_id;

        IF v_user_role NOT IN ('OWNER', 'MANAGER', 'SUPER_ADMIN') THEN
            RAISE EXCEPTION 'Only OWNER or MANAGER can override status transitions';
        END IF;
    END IF;

    UPDATE jobs_jobcard
    SET status = p_new_status,
        updated_at = NOW()
    WHERE id = p_job_id;

    IF p_new_status = 'READY_FOR_DELIVERY' THEN
        UPDATE jobs_jobcard
        SET actual_completion_date = NOW()
        WHERE id = p_job_id AND actual_completion_date IS NULL;
    ELSIF p_new_status = 'DELIVERED' THEN
        UPDATE jobs_jobcard
        SET delivery_date = NOW()
        WHERE id = p_job_id AND delivery_date IS NULL;
    ELSIF p_new_status = 'APPROVED' THEN
        UPDATE jobs_jobcard
        SET customer_approval_date = NOW()
        WHERE id = p_job_id AND customer_approval_date IS NULL;
    END IF;

    INSERT INTO jobs_jobstatushistory (
        id, job_id, from_status, to_status, changed_by_id, notes, is_override, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), p_job_id, v_current_status, p_new_status, p_user_id, p_notes, p_is_override, NOW(), NOW()
    );
END;
$$;
"""


def install_procedure(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(CREATE_PROCEDURE_SQL)


def drop_procedure(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP PROCEDURE IF EXISTS transition_job_status;")


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0006_add_branch_invoice_date_index'),
    ]

    operations = [
        migrations.RunPython(install_procedure, drop_procedure),
    ]
