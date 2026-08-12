"""Default customer-message templates installed for every branch."""

from notifications.models import (
    NotificationChannel,
    NotificationTemplate,
    NotificationType,
)


DEFAULT_NOTIFICATION_TEMPLATES = [
    (
        NotificationType.JOB_CREATED,
        "Dear {customer_name}, your device has been received at {branch_name}. "
        "Job Number: {job_number}. We will update you shortly.",
    ),
    (
        NotificationType.JOB_DIAGNOSED,
        "Dear {customer_name}, diagnosis is complete for Job {job_number}. "
        "The estimated repair amount is ₹{amount}.",
    ),
    (
        NotificationType.ESTIMATE_SHARED,
        "Dear {customer_name}, the estimate for Job {job_number} is ₹{amount}. "
        "Please contact {branch_name} to approve or reject the repair.",
    ),
    (
        NotificationType.JOB_READY,
        "Dear {customer_name}, your device is ready for pickup. "
        "Job: {job_number}. Please visit {branch_name}.",
    ),
    (
        NotificationType.DELIVERY_OTP,
        "Your delivery OTP for Job {job_number} is {otp}. "
        "Share it only with staff when you receive your device.",
    ),
    (
        NotificationType.JOB_DELIVERED,
        "Dear {customer_name}, Job {job_number} has been delivered. "
        "Thank you for choosing {branch_name}.",
    ),
    (
        NotificationType.PAYMENT_RECEIVED,
        "Payment of ₹{amount} received for Invoice {invoice_number}. "
        "Thank you for choosing {branch_name}.",
    ),
    (
        NotificationType.PAYMENT_REMINDER,
        "Dear {customer_name}, ₹{amount} remains due for Invoice {invoice_number}. "
        "Please contact {branch_name} if you need assistance.",
    ),
]


def ensure_default_notification_templates(branch) -> int:
    """Create any missing SMS defaults for a branch and return the count."""
    created_count = 0
    for notification_type, template_text in DEFAULT_NOTIFICATION_TEMPLATES:
        _, created = NotificationTemplate.objects.get_or_create(
            branch=branch,
            notification_type=notification_type,
            channel=NotificationChannel.SMS,
            defaults={"template_text": template_text, "is_active": True},
        )
        created_count += int(created)
    return created_count
