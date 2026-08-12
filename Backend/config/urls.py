"""
Main URL configuration for Service Center Management System.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.auth_views import (
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
    ThrottledTokenVerifyView,
    LogoutView,
)
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from core.views import HealthCheckView, ReadinessCheckView

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),

    # Health check — no auth, used by load balancers / Docker HEALTHCHECK
    path('api/healthz/', HealthCheckView.as_view(), name='healthz'),
    path('api/readyz/', ReadinessCheckView.as_view(), name='readyz'),
    
    # API Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # JWT Authentication
    path('api/auth/token/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', ThrottledTokenVerifyView.as_view(), name='token_verify'),
    path('api/auth/logout/', LogoutView.as_view(), name='token_logout'),
    
    # App URLs
    path('api/core/', include('core.urls', namespace='core')),
    path('api/customers/', include('customers.urls', namespace='customers')),
    path('api/jobs/', include('jobs.urls', namespace='jobs')),
    path('api/inventory/', include('inventory.urls', namespace='inventory')),
    path('api/billing/', include('billing.urls', namespace='billing')),
    path('api/notifications/', include('notifications.urls', namespace='notifications')),
    path('api/audit/', include('audit.urls', namespace='audit')),
    path('api/reports/', include('reports.urls', namespace='reports')),
    
    # Super App modules
    path('api/expenses/', include('expenses.urls', namespace='expenses')),
    path('api/suppliers/', include('suppliers.urls', namespace='suppliers')),
    path('api/enquiries/', include('enquiries.urls', namespace='enquiries')),
    path('api/marketing/', include('marketing.urls', namespace='marketing')),
    path('api/gst/', include('gst.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
