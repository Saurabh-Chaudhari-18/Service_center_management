from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0003_notificationlog_credit_note_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='notificationlog',
            name='delivery_context',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='notificationlog',
            name='dispatched_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddIndex(
            model_name='notificationlog',
            index=models.Index(fields=['status', 'dispatched_at'], name='notif_outbox_pending_idx'),
        ),
    ]
