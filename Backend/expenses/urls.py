"""
Expense URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from expenses.views import ExpenseViewSet

app_name = 'expenses'

router = DefaultRouter()
router.register(r'expenses', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('', include(router.urls)),
]
