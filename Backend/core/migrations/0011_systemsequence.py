from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0010_user_onboarding_dismissed'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemSequence',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(max_length=64, unique=True)),
                ('last_value', models.PositiveBigIntegerField(default=0)),
            ],
        ),
    ]
