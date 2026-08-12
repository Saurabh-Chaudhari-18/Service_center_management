import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("inventory", "0007_universal_category_uniqueness")]
    operations = [
        migrations.AlterField(model_name="inventoryitem", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="inventory_items", to="core.branch")),
        migrations.AlterField(model_name="purchase", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="purchases", to="core.branch")),
    ]
