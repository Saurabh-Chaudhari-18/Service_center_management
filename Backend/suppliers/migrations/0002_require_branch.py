import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("suppliers", "0001_initial")]
    operations = [
        migrations.AlterField(model_name="purchaseorder", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="purchase_orders", to="core.branch")),
        migrations.AlterField(model_name="supplier", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="suppliers", to="core.branch")),
    ]
