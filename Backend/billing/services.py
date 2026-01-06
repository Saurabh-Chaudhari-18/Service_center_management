"""
Billing services for PDF generation and GST calculations.
"""

from io import BytesIO
from decimal import Decimal
from django.template.loader import render_to_string
from django.conf import settings
from core.utils import format_indian_currency


class InvoiceService:
    """Service class for invoice-related operations."""

    @staticmethod
    def generate_invoice_pdf(invoice):
        """
        Generate PDF for an invoice.
        
        This is a placeholder implementation.
        In production, use a library like ReportLab, WeasyPrint, or an external service.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch, mm
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
        except ImportError:
            # Fallback if reportlab not installed
            return InvoiceService._generate_text_invoice(invoice)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20*mm,
            leftMargin=20*mm,
            topMargin=20*mm,
            bottomMargin=20*mm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=10
        )
        
        # Header with organization details
        branch = invoice.branch
        org = branch.organization
        
        header_data = [
            [Paragraph(f"<b>{org.legal_name}</b>", styles['Heading2'])],
            [f"{branch.address_line1}"],
            [f"{branch.city}, {branch.state} - {branch.pincode}"],
            [f"GSTIN: {branch.gstin}"],
            [f"Phone: {branch.phone}"],
        ]
        
        header_table = Table(header_data, colWidths=[doc.width])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 10*mm))
        
        # Invoice title
        elements.append(Paragraph("TAX INVOICE", title_style))
        elements.append(Spacer(1, 5*mm))
        
        # Invoice details
        invoice_details = [
            ["Invoice Number:", invoice.invoice_number, "Invoice Date:", str(invoice.invoice_date)],
            ["Job Number:", invoice.job.job_number, "Due Date:", str(invoice.due_date or 'N/A')],
        ]
        
        details_table = Table(invoice_details, colWidths=[doc.width/4]*4)
        details_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
        ]))
        elements.append(details_table)
        elements.append(Spacer(1, 5*mm))
        
        # Customer details
        customer_data = [
            ["Bill To:"],
            [invoice.customer_name],
            [invoice.customer_address],
            [f"Mobile: {invoice.customer_mobile}"],
        ]
        if invoice.customer_gstin:
            customer_data.append([f"GSTIN: {invoice.customer_gstin}"])
        
        customer_table = Table(customer_data, colWidths=[doc.width/2])
        customer_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, 0), colors.lightgrey),
        ]))
        elements.append(customer_table)
        elements.append(Spacer(1, 5*mm))
        
        # Line items
        item_header = ['#', 'Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate', 'Amount']
        item_data = [item_header]
        
        for idx, item in enumerate(invoice.line_items.all(), 1):
            item_data.append([
                str(idx),
                item.description[:50],
                item.hsn_sac_code or '-',
                str(item.quantity),
                item.unit,
                format_indian_currency(item.unit_price),
                format_indian_currency(item.amount),
            ])
        
        items_table = Table(item_data, colWidths=[
            15*mm, doc.width*0.35, 20*mm, 15*mm, 15*mm, 25*mm, 25*mm
        ])
        items_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),
            ('ALIGN', (5, 1), (6, -1), 'RIGHT'),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 5*mm))
        
        # Totals
        totals_data = [
            ['Subtotal:', format_indian_currency(invoice.subtotal)],
        ]
        
        if invoice.is_interstate:
            totals_data.append([f'IGST ({invoice.line_items.first().gst_rate}%):', format_indian_currency(invoice.igst_total)])
        else:
            cgst_rate = invoice.line_items.first().cgst_rate if invoice.line_items.exists() else Decimal('9')
            totals_data.append([f'CGST ({cgst_rate}%):', format_indian_currency(invoice.cgst_total)])
            totals_data.append([f'SGST ({cgst_rate}%):', format_indian_currency(invoice.sgst_total)])
        
        if invoice.discount_amount > 0:
            totals_data.append(['Discount:', f'-{format_indian_currency(invoice.discount_amount)}'])
        
        totals_data.append(['Total:', format_indian_currency(invoice.total_amount)])
        totals_data.append(['Paid:', format_indian_currency(invoice.paid_amount)])
        totals_data.append(['Balance Due:', format_indian_currency(invoice.balance_due)])
        
        totals_table = Table(totals_data, colWidths=[doc.width*0.7, doc.width*0.3])
        totals_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('LINEABOVE', (0, -1), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ]))
        elements.append(totals_table)
        elements.append(Spacer(1, 10*mm))
        
        # Terms & Conditions
        if invoice.terms_and_conditions:
            elements.append(Paragraph("<b>Terms & Conditions:</b>", styles['Normal']))
            elements.append(Paragraph(invoice.terms_and_conditions, styles['Normal']))
        
        # Footer
        elements.append(Spacer(1, 20*mm))
        footer_data = [
            ['Authorized Signatory', '', 'Customer Signature'],
        ]
        footer_table = Table(footer_data, colWidths=[doc.width/3]*3)
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
        ]))
        elements.append(footer_table)
        
        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def _generate_text_invoice(invoice):
        """Fallback text-based invoice if PDF library not available."""
        lines = [
            "=" * 60,
            f"            TAX INVOICE",
            "=" * 60,
            f"",
            f"Invoice Number: {invoice.invoice_number}",
            f"Invoice Date: {invoice.invoice_date}",
            f"Job Number: {invoice.job.job_number}",
            f"",
            f"Bill To:",
            f"  {invoice.customer_name}",
            f"  {invoice.customer_address}",
            f"  Mobile: {invoice.customer_mobile}",
            f"",
            "-" * 60,
            f"Items:",
            "-" * 60,
        ]
        
        for item in invoice.line_items.all():
            lines.append(f"  {item.description}")
            lines.append(f"    {item.quantity} x {item.unit_price} = {item.amount}")
        
        lines.extend([
            "-" * 60,
            f"Subtotal: {format_indian_currency(invoice.subtotal)}",
            f"Tax: {format_indian_currency(invoice.total_tax)}",
            f"Total: {format_indian_currency(invoice.total_amount)}",
            f"Paid: {format_indian_currency(invoice.paid_amount)}",
            f"Balance: {format_indian_currency(invoice.balance_due)}",
            "=" * 60,
        ])
        
        return "\n".join(lines).encode('utf-8')

    @staticmethod
    def create_invoice_from_job(job, user, additional_charges=None):
        """
        Create an invoice from a job card.
        Automatically includes all parts used.
        """
        from billing.models import Invoice, InvoiceLineItem
        from core.utils import is_interstate_supply
        
        customer = job.customer
        branch = job.branch
        
        is_interstate = is_interstate_supply(
            branch.state_code,
            customer.state_code
        )
        
        # Create invoice
        invoice = Invoice.objects.create(
            branch=branch,
            job=job,
            customer_name=customer.get_full_name(),
            customer_mobile=customer.mobile,
            customer_email=customer.email,
            customer_address=f"{customer.address_line1}, {customer.city}, {customer.state} - {customer.pincode}",
            customer_gstin=customer.gstin,
            customer_state_code=customer.state_code,
            is_interstate=is_interstate,
            created_by=user
        )
        
        # Add parts
        for part_usage in job.part_usages.all():
            InvoiceLineItem.objects.create(
                invoice=invoice,
                item_type='PART',
                description=part_usage.inventory_item.name,
                hsn_sac_code=part_usage.inventory_item.hsn_code,
                quantity=part_usage.quantity,
                unit=part_usage.inventory_item.unit,
                unit_price=part_usage.unit_price,
                gst_rate=part_usage.inventory_item.gst_rate,
                inventory_item=part_usage.inventory_item,
                job_part_usage=part_usage,
            )
        
        # Add service charge if estimated cost was set
        if job.estimated_cost:
            InvoiceLineItem.objects.create(
                invoice=invoice,
                item_type='SERVICE',
                description='Service/Repair Charge',
                hsn_sac_code='998719',  # SAC for repair services
                quantity=1,
                unit='NOS',
                unit_price=job.estimated_cost,
                gst_rate=branch.default_gst_rate,
            )
        
        # Add any additional charges
        if additional_charges:
            for charge in additional_charges:
                InvoiceLineItem.objects.create(
                    invoice=invoice,
                    item_type=charge.get('type', 'OTHER'),
                    description=charge.get('description', 'Additional Charge'),
                    hsn_sac_code=charge.get('hsn_sac_code', ''),
                    quantity=charge.get('quantity', 1),
                    unit=charge.get('unit', 'NOS'),
                    unit_price=Decimal(str(charge.get('amount', 0))),
                    gst_rate=Decimal(str(charge.get('gst_rate', 18))),
                )
        
        invoice.calculate_totals()
        invoice.save()
        
        return invoice
