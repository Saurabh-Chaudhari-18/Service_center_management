import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_systemsequence"),
        ("customers", "0002_alter_customer_unique_together_alter_customer_branch_and_more"),
    ]
    operations = [
        migrations.AlterField(
            model_name="customer",
            name="branch",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="customers", to="core.branch"),
        ),
    ]
