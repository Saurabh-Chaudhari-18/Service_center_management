"""
Job Card services - PDF generation.
"""

from io import BytesIO
from django.utils import timezone


class JobCardService:
    """Service class for job card-related operations."""

    @staticmethod
    def generate_job_card_pdf(job):
        """
        Generate a Job Card PDF receipt for the customer.
        Uses ReportLab if available, otherwise returns plain text bytes.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import mm
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
            from reportlab.lib.enums import TA_CENTER, TA_LEFT
        except ImportError:
            return JobCardService._generate_text_job_card(job)

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=20 * mm,
            leftMargin=20 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        elements = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=6,
        )
        section_style = ParagraphStyle(
            'SectionStyle',
            parent=styles['Heading2'],
            fontSize=11,
            spaceAfter=4,
            spaceBefore=8,
        )
        normal = styles['Normal']
        normal.fontSize = 9

        branch = job.branch
        org = branch.organization

        # ── Header ──────────────────────────────────────────────────────────
        header_data = [
            [Paragraph(f"<b>{org.legal_name}</b>", styles['Heading2'])],
            [f"{branch.address_line1}, {branch.city} - {branch.pincode}"],
            [f"Phone: {branch.phone}  |  GSTIN: {branch.gstin}"],
        ]
        header_table = Table(header_data, colWidths=[doc.width])
        header_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ]))
        elements.append(header_table)
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.black))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("JOB CARD / INWARD CHALLAN", title_style))
        elements.append(Spacer(1, 4 * mm))

        # ── Job Info ─────────────────────────────────────────────────────────
        received_at = timezone.localtime(job.created_at).strftime("%d %b %Y, %I:%M %p")
        job_info = [
            ["Job Number:", job.job_number, "Date:", received_at],
            ["Status:", job.get_status_display(), "Priority:", "URGENT" if job.is_urgent else "Normal"],
            ["Received By:", job.received_by.get_full_name() if job.received_by else "-",
             "Technician:", job.assigned_technician.get_full_name() if job.assigned_technician else "Not assigned"],
        ]
        info_table = Table(job_info, colWidths=[doc.width * 0.2, doc.width * 0.3, doc.width * 0.2, doc.width * 0.3])
        info_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 4 * mm))

        # ── Customer ─────────────────────────────────────────────────────────
        elements.append(Paragraph("Customer Details", section_style))
        customer = job.customer
        cust_data = [
            ["Name:", customer.get_full_name(), "Mobile:", customer.mobile],
            ["Email:", customer.email or "-", "Alt Mobile:", customer.alternate_mobile or "-"],
        ]
        cust_table = Table(cust_data, colWidths=[doc.width * 0.15, doc.width * 0.35, doc.width * 0.15, doc.width * 0.35])
        cust_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        elements.append(cust_table)
        elements.append(Spacer(1, 4 * mm))

        # ── Device ───────────────────────────────────────────────────────────
        elements.append(Paragraph("Device Details", section_style))
        device_data = [
            ["Device Type:", job.get_device_type_display(), "Brand:", job.brand],
            ["Model:", job.model, "Serial No:", job.serial_number or "N/A"],
            ["Physical Condition:", job.physical_condition, "", ""],
        ]
        device_table = Table(device_data, colWidths=[doc.width * 0.2, doc.width * 0.3, doc.width * 0.2, doc.width * 0.3])
        device_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('BACKGROUND', (2, 0), (2, -2), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('SPAN', (1, 2), (3, 2)),
        ]))
        elements.append(device_table)
        elements.append(Spacer(1, 4 * mm))

        # ── Accessories ──────────────────────────────────────────────────────
        accessories = list(job.accessories.filter(is_present=True))
        if accessories:
            elements.append(Paragraph("Accessories Received", section_style))
            acc_list = ", ".join(a.get_accessory_type_display() for a in accessories)
            elements.append(Paragraph(acc_list, normal))
            elements.append(Spacer(1, 3 * mm))

        # ── Complaint ────────────────────────────────────────────────────────
        elements.append(Paragraph("Customer Complaint", section_style))
        elements.append(Paragraph(job.customer_complaint, normal))
        elements.append(Spacer(1, 4 * mm))

        if job.additional_comments:
            elements.append(Paragraph("Additional Comments", section_style))
            elements.append(Paragraph(job.additional_comments, normal))
            elements.append(Spacer(1, 4 * mm))

        # ── Warranty ─────────────────────────────────────────────────────────
        if job.is_warranty_repair:
            elements.append(Paragraph(f"⚠ WARRANTY JOB: {job.warranty_details}", normal))
            elements.append(Spacer(1, 4 * mm))

        # ── Footer ───────────────────────────────────────────────────────────
        elements.append(Spacer(1, 10 * mm))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        elements.append(Spacer(1, 4 * mm))

        footer_data = [
            ['Customer Signature', '', 'Staff Signature'],
            ['', '', ''],
            ['_________________', '', '_________________'],
        ]
        footer_table = Table(footer_data, colWidths=[doc.width / 3] * 3)
        footer_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
        ]))
        elements.append(footer_table)

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def _generate_text_job_card(job):
        """Fallback plain text job card."""
        received_at = timezone.localtime(job.created_at).strftime("%d %b %Y, %I:%M %p")
        lines = [
            "=" * 60,
            f"          JOB CARD — {job.branch.name}",
            "=" * 60,
            f"Job Number   : {job.job_number}",
            f"Date         : {received_at}",
            f"Status       : {job.get_status_display()}",
            "",
            "CUSTOMER",
            f"  Name   : {job.customer.get_full_name()}",
            f"  Mobile : {job.customer.mobile}",
            f"  Email  : {job.customer.email or 'N/A'}",
            "",
            "DEVICE",
            f"  Type   : {job.get_device_type_display()}",
            f"  Brand  : {job.brand}",
            f"  Model  : {job.model}",
            f"  Serial : {job.serial_number or 'N/A'}",
            f"  Condition: {job.physical_condition}",
            "",
            "COMPLAINT",
            f"  {job.customer_complaint}",
            "=" * 60,
        ]
        return "\n".join(lines).encode("utf-8")
