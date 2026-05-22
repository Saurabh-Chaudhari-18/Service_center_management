"""
Notification services for sending SMS, WhatsApp, and internal alerts.

SMS  → TextBee.dev  (free, uses your Android phone's SIM card)
WA   → Twilio       (paid, configured separately via TWILIO_* env vars)
"""

import logging
from django.conf import settings
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
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
        # Generate job card PDF to attach to email
        job_pdf = None
        try:
            from jobs.services import JobCardService
            job_pdf = JobCardService.generate_job_card_pdf(job)
        except Exception as e:
            logger.warning(f"Could not generate job card PDF: {e}")

        NotificationService._send_customer_notification(
            job=job,
            notification_type=NotificationType.JOB_CREATED,
            context={
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name if job.branch else 'Service Center',
                'device': f"{job.brand} {job.model}",
                'tracking_pin': getattr(job, 'tracking_pin', '') or '',
            },
            job_pdf=job_pdf,
            job_pdf_filename=f"{job.job_number.replace('/', '-')}.pdf",
        )

    @staticmethod
    def on_job_status_change(job, old_status, new_status):
        """Send notification on job status change."""
        from jobs.models import JobStatus
        
        notification_type_map = {
            JobStatus.DIAGNOSIS: NotificationType.JOB_DIAGNOSED,
            JobStatus.ESTIMATE_SHARED: NotificationType.ESTIMATE_SHARED,
            JobStatus.READY_FOR_DELIVERY: NotificationType.JOB_READY,
            JobStatus.DELIVERED: NotificationType.JOB_DELIVERED,
        }
        
        notification_type = notification_type_map.get(new_status)
        if notification_type:
            context = {
                'customer_name': job.customer.get_full_name(),
                'job_number': job.job_number,
                'branch_name': job.branch.name if job.branch else 'Service Center',
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
    def on_invoice_created(invoice):
        """Send notification when a new invoice is finalized (PDF generated)."""
        NotificationService._send_customer_notification(
            job=invoice.job,
            notification_type=NotificationType.CUSTOM,  # No explicit enum yet, reusing CUSTOM or create a new message
            invoice=invoice,
            context={
                'customer_name': invoice.customer_name,
                'job_number': invoice.job.job_number,
                'invoice_number': invoice.invoice_number,
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
    def _send_customer_notification(job, notification_type, context, invoice=None, job_pdf=None, job_pdf_filename=None):
        """
        Internal method to send notification to customer.
        Tries WhatsApp first (if enabled), then SMS.
        """
        customer = job.customer
        branch = job.branch

        # Universal jobs (branch=null) have no branch settings — skip mobile notifications
        if branch is None:
            logger.info(
                f"Job {job.job_number} has no branch assigned (Universal). "
                "Skipping mobile notifications; email-only if customer has email."
            )
            channels_to_try = [NotificationChannel.EMAIL] if customer.email else []
        else:
            channels_to_try = []
            if branch.whatsapp_enabled and customer.whatsapp_enabled:
                channels_to_try.append(NotificationChannel.WHATSAPP)
            if branch.sms_enabled and customer.sms_enabled:
                channels_to_try.append(NotificationChannel.SMS)
            if customer.email:
                channels_to_try.append(NotificationChannel.EMAIL)
        
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
                
                # Persist the log row first — this is the durability record.
                # The actual send is dispatched to a Celery worker so it never
                # blocks the request thread.
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

                # Dispatch to background worker.
                # Each .delay() call is individually wrapped so that a Celery broker
                # or Redis result-store outage (e.g. "Retry limit exceeded reconnecting
                # to result store") never bubbles up and crashes the job creation flow.
                from notifications.tasks import deliver_sms, deliver_whatsapp, deliver_email

                if channel == NotificationChannel.WHATSAPP:
                    try:
                        deliver_whatsapp.delay(str(log.id))
                    except Exception as celery_err:
                        logger.warning(
                            f"Could not queue WHATSAPP task (Celery/Redis unavailable): {celery_err}. "
                            "Notification logged as FAILED — will retry on next worker restart."
                        )
                        log.mark_failed(f"Celery dispatch failed: {celery_err}")

                elif channel == NotificationChannel.SMS:
                    try:
                        deliver_sms.delay(str(log.id))
                    except Exception as celery_err:
                        logger.warning(
                            f"Could not queue SMS task (Celery/Redis unavailable): {celery_err}. "
                            "Notification logged as FAILED — will retry on next worker restart."
                        )
                        log.mark_failed(f"Celery dispatch failed: {celery_err}")

                elif channel == NotificationChannel.EMAIL:
                    default_subject = (
                        f"Job Card {job.job_number} — Device Received"
                        if notification_type == NotificationType.JOB_CREATED
                        else f"Update on Job {job.job_number}"
                    )
                    subject = template.subject if template and template.subject else default_subject

                    html_context = {
                        'branch': branch,
                        'message': message,
                        'job_number': context.get('job_number'),
                        'device': context.get('device'),
                        'invoice_number': context.get('invoice_number'),
                        'amount': context.get('amount'),
                    }
                    html_message = render_to_string('emails/job_notification.html', html_context)

                    try:
                        deliver_email.delay(str(log.id), customer.email, subject, html_message)
                    except Exception as celery_err:
                        logger.warning(
                            f"Could not queue EMAIL task (Celery/Redis unavailable): {celery_err}. "
                            "Notification logged as FAILED — will retry on next worker restart."
                        )
                        log.mark_failed(f"Celery dispatch failed: {celery_err}")
                
                # Only break if we successfully sent a mobile notification (SMS/WA). 
                # We still want the loop to continue to send the EMAIL (which is the last channel in the list).
                if channel in [NotificationChannel.WHATSAPP, NotificationChannel.SMS]:
                    # Remove SMS from channels_to_try so we don't send both WA and SMS
                    if NotificationChannel.SMS in channels_to_try and channel == NotificationChannel.WHATSAPP:
                        channels_to_try.remove(NotificationChannel.SMS)
                
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
            NotificationType.CUSTOM: (
                "Dear {customer_name}, your invoice {invoice_number} for Job {job_number} is generated. "
                "Thank you for choosing {branch_name}!"
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
        Send SMS via TextBee.dev Android SMS Gateway (Free).

        TextBee routes the SMS through an Android phone you own,
        using your local SIM card — so no per-message charges.

        Prerequisites:
          - Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID in your .env file.
          - Install the TextBee app on your Android device and register it
            at https://textbee.dev.
        """
        import requests as http_client

        api_key   = getattr(settings, 'TEXTBEE_API_KEY', '')
        device_id = getattr(settings, 'TEXTBEE_DEVICE_ID', '')

        if not api_key or not device_id:
            logger.warning(
                "TextBee SMS credentials not configured "
                "(TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID missing). "
                "Message logged but not sent."
            )
            log.mark_failed("TextBee credentials not configured")
            return

        # Ensure mobile has +91 India country code
        formatted_mobile = mobile if str(mobile).startswith('+') else f"+91{mobile}"

        url = f"https://api.textbee.dev/api/v1/gateway/devices/{device_id}/send-sms"
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "recipients": [formatted_mobile],
            "message": message,
        }

        logger.info(
            f"[TextBee] Sending SMS to {formatted_mobile} | "
            f"Notification type: {log.notification_type}"
        )

        try:
            response = http_client.post(url, json=payload, headers=headers, timeout=15)
            response.raise_for_status()          # raises for 4xx / 5xx
            result = response.json()

            log.mark_sent({
                'provider': 'textbee',
                'status': 'sent',
                'response': result,
            })
            logger.info(
                f"[TextBee] SMS delivered to {formatted_mobile}. "
                f"Response: {result}"
            )

        except http_client.exceptions.Timeout:
            msg = "TextBee API request timed out after 15 seconds"
            logger.error(f"[TextBee] {msg}")
            log.mark_failed(msg)

        except http_client.exceptions.HTTPError as e:
            msg = f"TextBee API returned error: {e.response.status_code} — {e.response.text}"
            logger.error(f"[TextBee] {msg}")
            log.mark_failed(msg)

        except Exception as e:
            msg = f"Unexpected error sending SMS via TextBee: {str(e)}"
            logger.error(f"[TextBee] {msg}")
            log.mark_failed(msg)


    @staticmethod
    def _send_whatsapp(mobile, message, log):
        """
        Send WhatsApp message via the configured provider.

        WHATSAPP_PROVIDER=cloud  → Meta WhatsApp Cloud API (free 1k conv/month)
        WHATSAPP_PROVIDER=twilio → Twilio (paid)
        """
        provider = getattr(settings, 'WHATSAPP_PROVIDER', 'cloud')
        clean_mobile = str(mobile).strip()
        formatted_mobile = clean_mobile if clean_mobile.startswith('+') else f"+91{clean_mobile}"

        if provider == 'cloud':
            NotificationService._send_whatsapp_cloud(formatted_mobile, message, log)
        else:
            NotificationService._send_whatsapp_twilio(formatted_mobile, message, log)

    @staticmethod
    def _send_whatsapp_cloud(formatted_mobile, message, log):
        """Send via Meta WhatsApp Cloud API — free 1k conversations/month."""
        import requests as http_client

        token = getattr(settings, 'WHATSAPP_CLOUD_TOKEN', '')
        phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')

        if not (token and phone_number_id):
            logger.warning("WhatsApp Cloud credentials not configured (WHATSAPP_CLOUD_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).")
            log.mark_failed("WhatsApp Cloud credentials not configured")
            return

        url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": formatted_mobile,
            "type": "text",
            "text": {"body": str(message)},
        }

        try:
            resp = http_client.post(
                url,
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=15,
            )
            resp.raise_for_status()
            result = resp.json()
            msg_id = (result.get("messages") or [{}])[0].get("id", "")
            log.mark_sent({"provider": "wa_cloud", "id": msg_id})
            logger.info(f"[WA Cloud] Sent to {formatted_mobile} id={msg_id}")

        except http_client.exceptions.Timeout:
            msg = "WhatsApp Cloud API timed out after 15 s"
            logger.error(f"[WA Cloud] {msg}")
            log.mark_failed(msg)

        except http_client.exceptions.HTTPError as e:
            msg = f"WhatsApp Cloud API error {e.response.status_code}: {e.response.text[:200]}"
            logger.error(f"[WA Cloud] {msg}")
            log.mark_failed(msg)

        except Exception as e:
            logger.error(f"[WA Cloud] Unexpected error: {e}")
            log.mark_failed(str(e))

    @staticmethod
    def _send_whatsapp_twilio(formatted_mobile, message, log):
        """Send via Twilio WhatsApp (paid fallback)."""
        account_sid = getattr(settings, 'TWILIO_ACCOUNT_SID', '')
        auth_token = getattr(settings, 'TWILIO_AUTH_TOKEN', '')
        from_number = getattr(settings, 'TWILIO_WHATSAPP_FROM', '')

        if not all([account_sid, auth_token, from_number]):
            logger.warning("Twilio WhatsApp credentials not configured.")
            log.mark_failed("Twilio WhatsApp credentials not configured")
            return

        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            whatsapp_to = f"whatsapp:{formatted_mobile}"
            clean_from = str(from_number).strip()
            whatsapp_from = clean_from if clean_from.startswith('whatsapp:') else f"whatsapp:{clean_from}"

            response = client.messages.create(body=str(message), from_=whatsapp_from, to=whatsapp_to)
            log.mark_sent({'provider': 'twilio', 'status': response.status, 'sid': response.sid})
            logger.info(f"[Twilio WA] Sent to {formatted_mobile} sid={response.sid}")

        except Exception as e:
            logger.error(f"[Twilio WA] Failed: {e}")
            log.mark_failed(str(e))

    @staticmethod
    def _send_email(email_address, subject, message, log, html_message=None, invoice=None, job_pdf=None, job_pdf_filename=None):
        """Send Email via Django SMTP with optional HTML formatting and attachments."""
        if not settings.EMAIL_HOST_USER:
            logger.warning("Email credentials not configured. Message logged but not sent.")
            if log:
                log.mark_failed("Email credentials not configured")
            return
            
        try:
            from django.core.mail import EmailMultiAlternatives
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email_address]
            )
            
            if html_message:
                email.attach_alternative(html_message, "text/html")
            
            # Attach Invoice PDF if present
            if invoice:
                from billing.services import InvoiceService
                pdf_content = InvoiceService.generate_invoice_pdf(invoice)
                email.attach(f"{invoice.invoice_number}.pdf", pdf_content, 'application/pdf')
            
            # Attach Job Card PDF if present
            if job_pdf:
                filename = job_pdf_filename or "job_card.pdf"
                email.attach(filename, job_pdf, 'application/pdf')
                
            logger.info(f"Sending Email to {email_address}...")
            email.send(fail_silently=False)
            if log:
                log.mark_sent({'provider': 'django_smtp', 'status': 'sent'})
            
        except Exception as e:
            logger.error(f"Email sending failed: {str(e)}")
            if log:
                log.mark_failed(str(e))
