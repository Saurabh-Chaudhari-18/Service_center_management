"""
Jobs admin configuration.
"""

from django.contrib import admin
from jobs.models import JobCard, JobStatusHistory, JobAccessory, JobPhoto, JobNote, PartRequest


class JobAccessoryInline(admin.TabularInline):
    model = JobAccessory
    extra = 0


class JobPhotoInline(admin.TabularInline):
    model = JobPhoto
    extra = 0


class JobNoteInline(admin.TabularInline):
    model = JobNote
    extra = 0


class JobStatusHistoryInline(admin.TabularInline):
    model = JobStatusHistory
    extra = 0
    readonly_fields = ['from_status', 'to_status', 'changed_by', 'notes', 'is_override', 'created_at']
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(JobCard)
class JobCardAdmin(admin.ModelAdmin):
    list_display = ['job_number', 'customer', 'branch', 'device_type', 'brand', 'status', 'is_urgent', 'created_at']
    list_filter = ['status', 'device_type', 'branch', 'is_urgent', 'is_warranty_repair']
    search_fields = ['job_number', 'customer__mobile', 'customer__first_name', 'brand', 'model', 'serial_number']
    ordering = ['-created_at']
    readonly_fields = ['job_number', 'created_at', 'updated_at']
    inlines = [JobAccessoryInline, JobPhotoInline, JobNoteInline, JobStatusHistoryInline]


@admin.register(JobStatusHistory)
class JobStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['job', 'from_status', 'to_status', 'changed_by', 'is_override', 'created_at']
    list_filter = ['to_status', 'is_override']
    search_fields = ['job__job_number']
    ordering = ['-created_at']
    readonly_fields = ['job', 'from_status', 'to_status', 'changed_by', 'notes', 'is_override', 'created_at']

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PartRequest)
class PartRequestAdmin(admin.ModelAdmin):
    list_display = ['job', 'part_name', 'quantity', 'status', 'requested_by', 'created_at']
    list_filter = ['status']
    search_fields = ['job__job_number', 'part_name']
    ordering = ['-created_at']
