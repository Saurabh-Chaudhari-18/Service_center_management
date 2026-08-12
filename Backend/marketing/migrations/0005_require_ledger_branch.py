import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("marketing", "0004_alter_servicereminder_status")]
    operations = [migrations.AlterField(model_name="customerledgerentry", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="core.branch"))]
