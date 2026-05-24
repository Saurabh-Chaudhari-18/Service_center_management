"""
Notifications URL configuration.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from notifications.views import (
    NotificationTemplateViewSet, NotificationLogViewSet,
    InternalAlertViewSet, SendNotificationView, NotificationEnumsView
)

app_name = 'notifications'

router = DefaultRouter()
router.register(r'templates', NotificationTemplateViewSet, basename='notification-template')
router.register(r'logs', NotificationLogViewSet, basename='notification-log')
router.register(r'alerts', InternalAlertViewSet, basename='internal-alert')
router.register(r'enums', NotificationEnumsView, basename='notification-enum')

urlpatterns = [
    path('send/', SendNotificationView.as_view(), name='send-notification'),
    path('', include(router.urls)),
]
