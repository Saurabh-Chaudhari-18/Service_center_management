"""
Expense URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import SimpleRouter
from expenses.views import ExpenseViewSet

app_name = 'expenses'

router = SimpleRouter()
router.register(r'', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('', include(router.urls)),
]
