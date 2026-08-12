from django.db import migrations


def drop_transition_procedure(apps, schema_editor):
    """The state machine now runs portably in a locked Django transaction."""
    if schema_editor.connection.vendor != 'postgresql':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute('DROP PROCEDURE IF EXISTS transition_job_status;')


class Migration(migrations.Migration):

    dependencies = [
        ('jobs', '0014_jobcard_delivery_otp_attempts_and_more'),
    ]

    operations = [
        migrations.RunPython(drop_transition_procedure, migrations.RunPython.noop),
    ]
