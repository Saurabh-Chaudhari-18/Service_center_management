from django.contrib import admin
from expenses.models import Expense


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'amount', 'expense_date', 'branch', 'created_by']
    list_filter = ['category', 'expense_date', 'is_recurring', 'branch']
    search_fields = ['title', 'description', 'vendor_name']
    date_hierarchy = 'expense_date'
