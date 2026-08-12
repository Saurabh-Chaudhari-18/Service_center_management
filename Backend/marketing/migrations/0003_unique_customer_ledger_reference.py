from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0002_servicereminder_unique_job_service_reminder'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='customerledgerentry',
            constraint=models.UniqueConstraint(
                condition=~models.Q(reference_id=''),
                fields=('customer', 'reference_type', 'reference_id'),
                name='unique_customer_ledger_reference',
            ),
        ),
    ]
