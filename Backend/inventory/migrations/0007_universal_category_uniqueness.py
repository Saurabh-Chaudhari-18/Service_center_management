from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0006_purchase_paid_amount_purchase_status_purchasepayment'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='inventorycategory',
            name='unique_branch_category_name',
        ),
        migrations.AddConstraint(
            model_name='inventorycategory',
            constraint=models.UniqueConstraint(
                fields=('branch', 'name'),
                name='unique_branch_category_name',
                nulls_distinct=False,
            ),
        ),
    ]
