from django.db import migrations


DEFAULTS = [
    ("JOB_CREATED", "Dear {customer_name}, your device has been received at {branch_name}. Job Number: {job_number}. We will update you shortly."),
    ("JOB_DIAGNOSED", "Dear {customer_name}, diagnosis is complete for Job {job_number}. The estimated repair amount is ₹{amount}."),
    ("ESTIMATE_SHARED", "Dear {customer_name}, the estimate for Job {job_number} is ₹{amount}. Please contact {branch_name} to approve or reject the repair."),
    ("JOB_READY", "Dear {customer_name}, your device is ready for pickup. Job: {job_number}. Please visit {branch_name}."),
    ("DELIVERY_OTP", "Your delivery OTP for Job {job_number} is {otp}. Share it only with staff when you receive your device."),
    ("JOB_DELIVERED", "Dear {customer_name}, Job {job_number} has been delivered. Thank you for choosing {branch_name}."),
    ("PAYMENT_RECEIVED", "Payment of ₹{amount} received for Invoice {invoice_number}. Thank you for choosing {branch_name}."),
    ("PAYMENT_REMINDER", "Dear {customer_name}, ₹{amount} remains due for Invoice {invoice_number}. Please contact {branch_name} if you need assistance."),
]


def seed_defaults(apps, schema_editor):
    Branch = apps.get_model("core", "Branch")
    NotificationTemplate = apps.get_model("notifications", "NotificationTemplate")
    for branch in Branch.objects.all().iterator():
        for notification_type, template_text in DEFAULTS:
            NotificationTemplate.objects.get_or_create(
                branch=branch,
                notification_type=notification_type,
                channel="SMS",
                defaults={"template_text": template_text, "is_active": True},
            )


class Migration(migrations.Migration):
    dependencies = [("notifications", "0001_initial")]
    operations = [migrations.RunPython(seed_defaults, migrations.RunPython.noop)]
