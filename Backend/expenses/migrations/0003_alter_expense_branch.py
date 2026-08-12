import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("expenses", "0002_expense_cgst_amount_expense_gst_rate_and_more")]
    operations = [migrations.AlterField(model_name="expense", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="expenses", to="core.branch"))]
