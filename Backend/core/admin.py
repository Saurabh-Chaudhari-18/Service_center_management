"""
Core admin configuration.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from audit.services import AuditLogService
from core.models import Organization, Branch, User, RolePermission


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = [
        'role', 'can_view_dashboard', 'can_view_job_cards', 'can_create_job_cards',
        'can_edit_job_cards', 'can_view_inventory', 'can_manage_inventory',
        'can_view_billing', 'can_create_invoices', 'can_view_reports',
        'can_manage_branches', 'can_manage_users', 'can_view_pickups', 'updated_at',
    ]
    list_editable = [
        'can_view_dashboard', 'can_view_job_cards', 'can_create_job_cards',
        'can_edit_job_cards', 'can_view_inventory', 'can_manage_inventory',
        'can_view_billing', 'can_create_invoices', 'can_view_reports',
        'can_manage_branches', 'can_manage_users', 'can_view_pickups',
    ]
    list_display_links = ['role']
    ordering = ['role']

    fieldsets = (
        (None, {'fields': ('role',)}),
        ('Dashboard', {'fields': ('can_view_dashboard',)}),
        ('Job Cards', {'fields': ('can_view_job_cards', 'can_create_job_cards', 'can_edit_job_cards')}),
        ('Inventory', {'fields': ('can_view_inventory', 'can_manage_inventory')}),
        ('Billing', {'fields': ('can_view_billing', 'can_create_invoices')}),
        ('Reports', {'fields': ('can_view_reports',)}),
        ('Administration', {'fields': ('can_manage_branches', 'can_manage_users')}),
        ('Pickups', {'fields': ('can_view_pickups',)}),
    )

    def save_model(self, request, obj, form, change):
        old_values = {}
        if change and obj.pk:
            previous = RolePermission.objects.get(pk=obj.pk)
            old_values = {
                field: getattr(previous, field)
                for field in form.changed_data
            }

        super().save_model(request, obj, form, change)

        if change and form.changed_data:
            AuditLogService.log(
                user=request.user,
                action='PRIVILEGE_CHANGE',
                model_name='RolePermission',
                object_id=str(obj.pk),
                old_values=old_values,
                new_values={field: getattr(obj, field) for field in form.changed_data},
                details={'role': obj.role},
                request=request,
            )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'legal_name', 'city', 'phone', 'is_active', 'created_at']
    list_filter = ['is_active', 'state', 'created_at']
    search_fields = ['name', 'legal_name', 'email', 'pan_number']
    ordering = ['name']


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'code', 'city', 'gstin', 'is_active']
    list_filter = ['organization', 'is_active', 'state']
    search_fields = ['name', 'code', 'gstin', 'city']
    ordering = ['organization', 'name']


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'organization', 'role', 'is_active']
    list_filter = ['organization', 'role', 'is_active', 'is_staff']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['email']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'phone')}),
        ('Organization', {'fields': ('organization', 'role', 'branches')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'first_name', 'last_name', 'organization', 'role'),
        }),
    )
    
    filter_horizontal = ('branches', 'groups', 'user_permissions')
