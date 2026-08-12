"""Pre-deployment audit for tenant-owned rows without a branch."""

from django.apps import apps
from django.core.management.base import BaseCommand, CommandError


TENANT_REQUIRED_MODELS = (
    "customers.Customer",
    "enquiries.Enquiry",
    "expenses.Expense",
    "gst.GSTPayment",
    "gst.GSTReturnStatus",
    "inventory.InventoryItem",
    "inventory.Purchase",
    "marketing.CustomerLedgerEntry",
    "suppliers.Supplier",
    "suppliers.PurchaseOrder",
)


class Command(BaseCommand):
    help = "Fail if tenant-owned business rows have a null branch."

    def handle(self, *args, **options):
        invalid = []

        for model_label in TENANT_REQUIRED_MODELS:
            model = apps.get_model(model_label)
            count = model._base_manager.filter(branch__isnull=True).count()
            if count:
                invalid.append((model_label, count))

        if invalid:
            details = ", ".join(
                f"{model_label}={count}" for model_label, count in invalid
            )
            raise CommandError(
                "Tenant integrity audit failed. Map every legacy row to its "
                f"owning branch before migrating: {details}"
            )

        self.stdout.write(
            self.style.SUCCESS("Tenant integrity audit passed: no unscoped rows.")
        )
