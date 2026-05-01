"""
Marketing URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from marketing.views import (
    ReminderConfigViewSet, ServiceReminderViewSet,
    ReviewConfigViewSet, ReviewRequestViewSet,
    CustomerLedgerViewSet
)

app_name = 'marketing'

router = DefaultRouter()
router.register(r'reminder-config', ReminderConfigViewSet, basename='reminder-config')
router.register(r'reminders', ServiceReminderViewSet, basename='service-reminder')
router.register(r'review-config', ReviewConfigViewSet, basename='review-config')
router.register(r'review-requests', ReviewRequestViewSet, basename='review-request')
router.register(r'ledger', CustomerLedgerViewSet, basename='customer-ledger')

urlpatterns = [
    path('', include(router.urls)),
]
