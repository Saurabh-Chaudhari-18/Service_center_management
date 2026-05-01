from django.contrib import admin
from enquiries.models import Enquiry, EnquiryNote


class EnquiryNoteInline(admin.TabularInline):
    model = EnquiryNote
    extra = 1


@admin.register(Enquiry)
class EnquiryAdmin(admin.ModelAdmin):
    list_display = ['customer_name', 'customer_mobile', 'source', 'status', 'follow_up_date', 'branch']
    list_filter = ['status', 'source', 'follow_up_date']
    search_fields = ['customer_name', 'customer_mobile', 'problem_description']
    date_hierarchy = 'created_at'
    inlines = [EnquiryNoteInline]
