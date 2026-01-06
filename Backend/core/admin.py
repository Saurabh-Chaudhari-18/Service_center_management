"""
Core admin configuration.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from core.models import Organization, Branch, User


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
