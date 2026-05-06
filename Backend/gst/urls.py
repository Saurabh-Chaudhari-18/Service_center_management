from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GSTViewSet

router = DefaultRouter()
router.register(r'', GSTViewSet, basename='gst')

urlpatterns = [
    path('', include(router.urls)),
]
