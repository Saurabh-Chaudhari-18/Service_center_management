from django.apps import AppConfig


class TenancyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "tenancy"

    def ready(self):
        from tenancy import db_context  # noqa: F401
