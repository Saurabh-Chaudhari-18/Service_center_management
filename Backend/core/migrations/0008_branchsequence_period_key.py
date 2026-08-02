from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0007_branch_gst_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='branchsequence',
            name='period_key',
            field=models.CharField(blank=True, default='', max_length=16),
        ),
        migrations.AlterField(
            model_name='branchsequence',
            name='kind',
            field=models.CharField(
                choices=[
                    ('invoice', 'Invoice'),
                    ('jobcard', 'Job Card'),
                    ('pickup', 'Pickup'),
                    ('purchase_order', 'Purchase Order'),
                ],
                max_length=20,
            ),
        ),
    ]