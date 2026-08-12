from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketing', '0003_unique_customer_ledger_reference'),
    ]

    operations = [
        migrations.AlterField(
            model_name='servicereminder',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('QUEUED', 'Queued'),
                    ('SENT', 'Sent'),
                    ('FAILED', 'Failed'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
