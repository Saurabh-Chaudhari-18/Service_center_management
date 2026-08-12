from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_notification_outbox_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notificationlog',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('SENDING', 'Sending'),
                    ('SENT', 'Sent'),
                    ('DELIVERED', 'Delivered'),
                    ('FAILED', 'Failed'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
