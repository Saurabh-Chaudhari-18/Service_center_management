"""
Customer admin configuration.
"""

from django.contrib import admin
from customers.models import Customer, CustomerDocument


class CustomerDocumentInline(admin.TabularInline):
    model = CustomerDocument
    extra = 0


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['first_name', 'last_name', 'mobile', 'branch', 'city', 'is_active', 'created_at']
    list_filter = ['branch', 'is_active', 'city', 'state']
    search_fields = ['first_name', 'last_name', 'mobile', 'email', 'company_name']
    ordering = ['-created_at']
    inlines = [CustomerDocumentInline]


@admin.register(CustomerDocument)
class CustomerDocumentAdmin(admin.ModelAdmin):
    list_display = ['customer', 'document_type', 'document_number', 'created_at']
    list_filter = ['document_type']
    search_fields = ['customer__first_name', 'customer__mobile', 'document_number']
