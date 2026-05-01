from django.contrib import admin
from marketing.models import (
    ReminderConfig, ServiceReminder,
    ReviewConfig, ReviewRequest,
    CustomerLedgerEntry
)


@admin.register(ReminderConfig)
class ReminderConfigAdmin(admin.ModelAdmin):
    list_display = ['branch', 'reminder_1_days', 'reminder_2_days', 'is_active']


@admin.register(ServiceReminder)
class ServiceReminderAdmin(admin.ModelAdmin):
    list_display = ['customer', 'reminder_type', 'scheduled_date', 'status']
    list_filter = ['status', 'reminder_type', 'scheduled_date']


@admin.register(ReviewConfig)
class ReviewConfigAdmin(admin.ModelAdmin):
    list_display = ['branch', 'google_review_link', 'send_after_hours', 'is_active']


@admin.register(ReviewRequest)
class ReviewRequestAdmin(admin.ModelAdmin):
    list_display = ['customer', 'job', 'scheduled_at', 'status']
    list_filter = ['status']


@admin.register(CustomerLedgerEntry)
class CustomerLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ['customer', 'entry_type', 'amount', 'entry_date', 'running_balance']
    list_filter = ['entry_type', 'reference_type', 'entry_date']
    search_fields = ['customer__first_name', 'customer__last_name', 'description']
