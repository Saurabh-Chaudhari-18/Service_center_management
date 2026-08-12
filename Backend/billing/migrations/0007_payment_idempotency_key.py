from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0006_invoice_customer'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='idempotency_key',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.UniqueConstraint(
                condition=models.Q(idempotency_key__isnull=False),
                fields=('invoice', 'idempotency_key'),
                name='unique_invoice_payment_idempotency_key',
            ),
        ),
    ]
