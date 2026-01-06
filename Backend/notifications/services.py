"""
Notification services for sending SMS, WhatsApp, and internal alerts.
"""

import logging
from django.conf import settings
from notifications.models import (
    NotificationLog, NotificationTemplate, NotificationType,
    NotificationChannel, InternalAlert
)

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service for sending notifications across channels.
    Supports SMS, WhatsApp, and internal alerts.
    """

    @staticmethod
    def on_job_created(job):
        """Send notification when a job is created."""
        NotificationService._send_customer_notification(
            job=job,
            notification_type=NotificationType.JOB_CREATED,
            context={
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name,
                'device': f"{job.brand} {job.model}",
            }
        )

    @staticmethod
    def on_job_status_change(job, old_status, new_status):
        """Send notification on job status change."""
        from jobs.models import JobStatus
        
        notification_type_map = {
            JobStatus.DIAGNOSED: NotificationType.JOB_DIAGNOSED,
            JobStatus.ESTIMATE_SHARED: NotificationType.ESTIMATE_SHARED,
            JobStatus.READY: NotificationType.JOB_READY,
            JobStatus.DELIVERED: NotificationType.JOB_DELIVERED,
        }
        
        notification_type = notification_type_map.get(new_status)
        if notification_type:
            context = {
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name,
                'device': f"{job.brand} {job.model}",
                'status': new_status.label,
            }
            
            if new_status == JobStatus.ESTIMATE_SHARED and job.estimated_cost:
                context['amount'] = str(job.estimated_cost)
            
            NotificationService._send_customer_notification(
                job=job,
                notification_type=notification_type,
                context=context
            )

    @staticmethod
    def send_delivery_otp(job):
        """Send delivery OTP to customer."""
        NotificationService._send_customer_notification(
            job=job,
            notification_type=NotificationType.DELIVERY_OTP,
            context={
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name,
                'device': f"{job.brand} {job.model}",
                'otp': job.delivery_otp,
            }
        )

    @staticmethod
    def send_estimate(job):
        """Send estimate details to customer."""
        NotificationService._send_customer_notification(
            job=job,
            notification_type=NotificationType.ESTIMATE_SHARED,
            context={
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name,
                'device': f"{job.brand} {job.model}",
                'amount': str(job.estimated_cost or 0),
            }
        )

    @staticmethod
    def on_payment_received(invoice, payment):
        """Send notification when payment is received."""
        NotificationService._send_customer_notification(
            job=invoice.job,
            notification_type=NotificationType.PAYMENT_RECEIVED,
            invoice=invoice,
            context={
                'customer_name': invoice.customer_name,
                'job_number': invoice.job.job_number,
                'invoice_number': invoice.invoice_number,
                'amount': str(payment.amount),
                'branch_name': invoice.branch.name,
            }
        )

    @staticmethod
    def on_technician_assigned(job, technician):
        """Send internal notification to technician."""
        InternalAlert.objects.create(
            branch=job.branch,
            alert_type='SYSTEM',
            message=f"New job assigned: {job.job_number} - {job.customer_complaint[:50]}",
            priority='MEDIUM',
            related_model='jobs.JobCard',
            related_object_id=job.id
        )

    @staticmethod
    def send_low_stock_alert(inventory_item):
        """Send low stock alert to branch staff."""
        InternalAlert.objects.create(
            branch=inventory_item.branch,
            alert_type='LOW_STOCK',
            message=f"Low stock alert: {inventory_item.name} (Current: {inventory_item.quantity}, Threshold: {inventory_item.low_stock_threshold})",
            priority='HIGH',
            related_model='inventory.InventoryItem',
            related_object_id=inventory_item.id
        )
        
        # Also log notification
        NotificationLog.objects.create(
            branch=inventory_item.branch,
            notification_type=NotificationType.LOW_STOCK_ALERT,
            channel=NotificationChannel.INTERNAL,
            message=f"Low stock: {inventory_item.name}",
            status='SENT'
        )

    @staticmethod
    def send_payment_reminder(invoice):
        """Send payment reminder to customer."""
        NotificationService._send_customer_notification(
            job=invoice.job,
            notification_type=NotificationType.PAYMENT_REMINDER,
            invoice=invoice,
            context={
                'customer_name': invoice.customer_name,
                'job_number': invoice.job.job_number,
                'invoice_number': invoice.invoice_number,
                'amount': str(invoice.balance_due),
                'branch_name': invoice.branch.name,
            }
        )

    @staticmethod
    def _send_customer_notification(job, notification_type, context, invoice=None):
        """
        Internal method to send notification to customer.
        Tries WhatsApp first (if enabled), then SMS.
        """
        customer = job.customer
        branch = job.branch
        
        channels_to_try = []
        if branch.whatsapp_enabled and customer.whatsapp_enabled:
            channels_to_try.append(NotificationChannel.WHATSAPP)
        if branch.sms_enabled and customer.sms_enabled:
            channels_to_try.append(NotificationChannel.SMS)
        
        for channel in channels_to_try:
            try:
                # Get template
                template = NotificationTemplate.objects.filter(
                    branch=branch,
                    notification_type=notification_type,
                    channel=channel,
                    is_active=True
                ).first()
                
                if not template:
                    # Use default template
                    message = NotificationService._get_default_message(
                        notification_type, context
                    )
                else:
                    message = template.render(context)
                
                # Create log entry
                log = NotificationLog.objects.create(
                    branch=branch,
                    notification_type=notification_type,
                    channel=channel,
                    recipient_mobile=customer.mobile,
                    recipient_name=customer.get_full_name(),
                    message=message,
                    job=job,
                    invoice=invoice,
                    status='PENDING'
                )
                
                # Send via appropriate provider
                if channel == NotificationChannel.WHATSAPP:
                    NotificationService._send_whatsapp(
                        customer.mobile, message, log
                    )
                elif channel == NotificationChannel.SMS:
                    NotificationService._send_sms(
                        customer.mobile, message, log
                    )
                
                # Only send via first available channel
                break
                
            except Exception as e:
                logger.error(f"Failed to send {channel} notification: {str(e)}")

    @staticmethod
    def _get_default_message(notification_type, context):
        """Get default message template."""
        templates = {
            NotificationType.JOB_CREATED: (
                "Dear {customer_name}, your device has been received at {branch_name}. "
                "Job Number: {job_number}. Device: {device}. "
                "We will update you on the diagnosis shortly."
            ),
            NotificationType.JOB_DIAGNOSED: (
                "Dear {customer_name}, your device ({device}) has been diagnosed. "
                "Job: {job_number}. We will share the estimate shortly."
            ),
            NotificationType.ESTIMATE_SHARED: (
                "Dear {customer_name}, estimate for your device repair: Rs.{amount}. "
                "Job: {job_number}. Please confirm to proceed."
            ),
            NotificationType.JOB_READY: (
                "Dear {customer_name}, your device is ready for pickup! "
                "Job: {job_number}. Please visit {branch_name} with your receipt."
            ),
            NotificationType.DELIVERY_OTP: (
                "Dear {customer_name}, your delivery OTP is {otp}. "
                "Job: {job_number}. Please share this with our staff during pickup."
            ),
            NotificationType.JOB_DELIVERED: (
                "Dear {customer_name}, your device has been delivered. "
                "Job: {job_number}. Thank you for choosing {branch_name}!"
            ),
            NotificationType.PAYMENT_RECEIVED: (
                "Dear {customer_name}, payment of Rs.{amount} received. "
                "Invoice: {invoice_number}. Thank you!"
            ),
            NotificationType.PAYMENT_REMINDER: (
                "Dear {customer_name}, payment reminder for Invoice {invoice_number}. "
                "Outstanding amount: Rs.{amount}. Please clear at your earliest."
            ),
        }
        
        template = templates.get(notification_type, "Notification from {branch_name}")
        for key, value in context.items():
            template = template.replace(f'{{{key}}}', str(value))
        return template

    @staticmethod
    def _send_sms(mobile, message, log):
        """
        Send SMS via configured provider.
        Placeholder implementation - integrate with actual SMS provider.
        """
        api_key = getattr(settings, 'SMS_API_KEY', '')
        
        if not api_key:
            logger.warning("SMS API key not configured. Message not sent.")
            log.mark_failed("SMS API key not configured")
            return
        
        try:
            # Placeholder for actual SMS provider integration
            # Example providers: MSG91, Twilio, TextLocal
            
            # Simulate sending
            logger.info(f"Sending SMS to {mobile}: {message[:50]}...")
            
            # In production, replace with actual API call:
            # response = requests.post(
            #     'https://api.smsprovider.com/send',
            #     data={'mobile': mobile, 'message': message, 'apikey': api_key}
            # )
            
            log.mark_sent({'provider': 'mock', 'status': 'sent'})
            
        except Exception as e:
            logger.error(f"SMS sending failed: {str(e)}")
            log.mark_failed(str(e))

    @staticmethod
    def _send_whatsapp(mobile, message, log):
        """
        Send WhatsApp message via configured provider.
        Placeholder implementation - integrate with actual WhatsApp provider.
        """
        api_key = getattr(settings, 'WHATSAPP_API_KEY', '')
        
        if not api_key:
            logger.warning("WhatsApp API key not configured. Message not sent.")
            log.mark_failed("WhatsApp API key not configured")
            return
        
        try:
            # Placeholder for actual WhatsApp provider integration
            # Example providers: Twilio, WATI, Gupshup
            
            logger.info(f"Sending WhatsApp to {mobile}: {message[:50]}...")
            
            # In production, replace with actual API call
            
            log.mark_sent({'provider': 'mock', 'status': 'sent'})
            
        except Exception as e:
            logger.error(f"WhatsApp sending failed: {str(e)}")
            log.mark_failed(str(e))
