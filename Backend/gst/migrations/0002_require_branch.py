import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("gst", "0001_initial")]
    operations = [
        migrations.AlterField(model_name="gstpayment", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="gst_payments", to="core.branch")),
        migrations.AlterField(model_name="gstreturnstatus", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="gst_return_statuses", to="core.branch")),
    ]
