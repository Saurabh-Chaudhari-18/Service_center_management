"""
Core URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from core.views import (
    OrganizationViewSet, BranchViewSet, UserViewSet, RoleListView
)

app_name = 'core'

router = DefaultRouter()
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'branches', BranchViewSet, basename='branch')
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    path('roles/', RoleListView.as_view(), name='role-list'),
]
