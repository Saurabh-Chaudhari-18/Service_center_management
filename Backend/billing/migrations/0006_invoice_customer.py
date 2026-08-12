from django.db import migrations, models
import django.db.models.deletion


def backfill_invoice_customers(apps, schema_editor):
    Invoice = apps.get_model('billing', 'Invoice')
    invoices = Invoice.objects.filter(
        job__isnull=False,
        customer__isnull=True,
    ).select_related('job')

    pending = []
    for invoice in invoices.iterator(chunk_size=500):
        invoice.customer_id = invoice.job.customer_id
        pending.append(invoice)
        if len(pending) == 500:
            Invoice.objects.bulk_update(pending, ['customer'])
            pending.clear()

    if pending:
        Invoice.objects.bulk_update(pending, ['customer'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0005_add_branch_invoice_date_index'),
        ('customers', '0002_alter_customer_unique_together_alter_customer_branch_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='invoice',
            name='customer',
            field=models.ForeignKey(
                blank=True,
                help_text='Customer account linked to this invoice',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='invoices',
                to='customers.customer',
            ),
        ),
        migrations.RunPython(
            backfill_invoice_customers,
            migrations.RunPython.noop,
        ),
    ]