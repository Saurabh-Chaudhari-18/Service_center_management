import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("core", "0011_systemsequence"), ("enquiries", "0001_initial")]
    operations = [migrations.AlterField(model_name="enquiry", name="branch", field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="enquiries", to="core.branch"))]
