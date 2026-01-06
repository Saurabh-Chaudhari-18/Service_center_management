"""
Billing admin configuration.
"""

from django.contrib import admin
from billing.models import Invoice, InvoiceLineItem, Payment, CreditNote


class InvoiceLineItemInline(admin.TabularInline):
    model = InvoiceLineItem
    extra = 0


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'customer_name', 'branch', 'total_amount', 'paid_amount', 'status', 'invoice_date']
    list_filter = ['status', 'branch', 'is_finalized', 'is_interstate']
    search_fields = ['invoice_number', 'customer_name', 'customer_mobile', 'job__job_number']
    ordering = ['-invoice_date']
    readonly_fields = ['invoice_number', 'subtotal', 'cgst_total', 'sgst_total', 'igst_total', 'total_tax', 'total_amount']
    inlines = [InvoiceLineItemInline, PaymentInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['invoice', 'amount', 'payment_method', 'received_by', 'payment_date']
    list_filter = ['payment_method', 'is_verified']
    search_fields = ['invoice__invoice_number', 'reference']
    ordering = ['-payment_date']


@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display = ['credit_note_number', 'invoice', 'amount', 'total_amount', 'created_by', 'created_at']
    list_filter = ['branch']
    search_fields = ['credit_note_number', 'invoice__invoice_number']
    ordering = ['-created_at']
