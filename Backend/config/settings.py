"""
Django settings for Service Center Management System.

Multi-tenant, branch-isolated system with GST billing, inventory,
job lifecycle tracking, and auditability for Indian service centers.
"""

from pathlib import Path
from datetime import timedelta
import environ
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize django-environ
env = environ.Env(
    DEBUG=(bool, False),
)

# Read the .env file if it exists
environ.Env.read_env(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
# No insecure default — the application will refuse to start if SECRET_KEY is
# not explicitly set in the environment. This prevents accidental production
# deploys with a well-known hardcoded key that attackers could exploit.
SECRET_KEY = env('SECRET_KEY', default=None)
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())\""
    )

# SECURITY WARNING: don't run with debug turned on in production!
# Default is False so that a missing .env in production never exposes tracebacks.
DEBUG = env('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['localhost', '127.0.0.1'])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_filters',
    'drf_spectacular',
    'corsheaders',
    
    # Local apps
    'core.apps.CoreConfig',
    'tenancy.apps.TenancyConfig',
    'customers.apps.CustomersConfig',
    'jobs.apps.JobsConfig',
    'inventory.apps.InventoryConfig',
    'billing.apps.BillingConfig',
    'notifications.apps.NotificationsConfig',
    'audit.apps.AuditConfig',
    'reports.apps.ReportsConfig',
    
    # Super App modules
    'expenses.apps.ExpensesConfig',
    'suppliers.apps.SuppliersConfig',
    'enquiries.apps.EnquiriesConfig',
    'marketing.apps.MarketingConfig',
    'gst.apps.GstConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'platform_runtime.middleware.RequestIDMiddleware',  # request correlation infrastructure
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'audit.middleware.AuditMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
# Let django-environ pick ENGINE from DATABASE_URL scheme (postgresql vs sqlite).
# Do not force the PostgreSQL engine: CI Docker smoke tests use sqlite:/// URLs.
DATABASES = {
    'default': env.db(
        'DATABASE_URL',
        default='postgres://postgres:postgres@localhost:5432/service_center_db',
    )
}

# Custom User Model
AUTH_USER_MODEL = 'core.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Django REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'identity.authentication.CookieJWTAuthentication',
        'identity.authentication.TenantSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.OptionalPageSizePagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'core.error_handlers.custom_exception_handler',
}

# Refresh token httpOnly cookie (set on API domain; sent with credentials on refresh)
JWT_REFRESH_COOKIE_NAME = 'scm_refresh_token'
JWT_ACCESS_COOKIE_NAME = 'scm_access_token'
JWT_COOKIE_SAMESITE = env(
    'JWT_COOKIE_SAMESITE',
    default='Lax' if DEBUG else 'None',
)
JWT_COOKIE_SECURE = env.bool('JWT_COOKIE_SECURE', default=not DEBUG)

# JWT Settings
SIMPLE_JWT = {
    # 30 minutes: short-lived access tokens reduce the attack window if a token
    # is intercepted. The 7-day refresh token silently rotates it in the background.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_REFRESH_SERIALIZER': 'core.simplejwt_serializers.TokenRefreshSerializer',
}

# DRF Spectacular (OpenAPI)
SPECTACULAR_SETTINGS = {
    'TITLE': 'Service Center Management API',
    'DESCRIPTION': 'Multi-tenant service center management system for Indian computer & laptop service centers',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
    'ENUM_NAME_OVERRIDES': {
        'JobStatusEnum': 'jobs.models.JobStatus.choices',
        'InvoiceStatusEnum': 'billing.models.InvoiceStatus.choices',
        'EnquiryStatusEnum': 'enquiries.models.EnquiryStatus.choices',
        'PickupRequestStatusEnum': 'jobs.models.PickupRequestStatus.choices',
        'PurchaseStatusEnum': 'inventory.models.PurchaseStatus.choices',
        'ExpenseCategoryEnum': 'expenses.models.ExpenseCategory.choices',
        'DropdownCategoryEnum': 'jobs.models.DropdownCategory.choices',
        'NotificationChannelEnum': 'notifications.models.NotificationChannel.choices',
        'BillingPaymentMethodEnum': 'billing.models.PaymentMethod.choices',
        'PurchaseOrderStatusEnum': [
            ('DRAFT', 'Draft'), ('SENT', 'Sent to Supplier'),
            ('CONFIRMED', 'Confirmed'), ('PARTIAL', 'Partially Received'),
            ('RECEIVED', 'Fully Received'), ('CANCELLED', 'Cancelled'),
        ],
        'ExpensePaymentMethodEnum': [
            ('CASH', 'Cash'), ('UPI', 'UPI'), ('CARD', 'Card'),
            ('NEFT', 'NEFT/RTGS'), ('OTHER', 'Other'),
        ],
        'GSTPaymentMethodEnum': [
            ('NEFT', 'NEFT/RTGS'), ('UPI', 'UPI'), ('CASH', 'Cash at Bank'),
            ('DEBIT_CARD', 'Debit Card'), ('OTHER', 'Other'),
        ],
        'PurchasePaymentMethodEnum': [
            ('CASH', 'Cash'), ('UPI', 'UPI'),
            ('CARD', 'Credit/Debit Card'), ('BANK_TRANSFER', 'Bank Transfer'),
        ],
        'MarketingChannelEnum': [
            ('WHATSAPP', 'WhatsApp'), ('SMS', 'SMS'),
        ],
    },
}

# CORS Settings
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'http://localhost:3000',
    'http://127.0.0.1:3000',
])
# When True, allow any https://*.vercel.app origin (preview + production on vercel.app).
# For stricter production, set False and list exact origins in CORS_ALLOWED_ORIGINS only.
CORS_ALLOW_VERCEL = env.bool('CORS_ALLOW_VERCEL', default=False)
CORS_ALLOWED_ORIGIN_REGEXES = []
if CORS_ALLOW_VERCEL:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r'^https://[\w.-]+\.vercel\.app$',
    ]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-branch-id',    # Custom header for branch context
    'x-request-id',  # Correlation ID for log tracing
]
CORS_EXPOSE_HEADERS = ['X-Request-ID']  # Allow frontend JS to read it from responses

# Internationalization - India specific
LANGUAGE_CODE = 'en-in'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Media files (intake photos, documents)
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# -----------------------------------------------------------------------
# Media storage — S3-compatible (AWS S3, MinIO, Cloudflare R2).
# -----------------------------------------------------------------------
USE_S3 = env.bool('USE_S3', default=False)
REQUIRE_S3_MEDIA = env.bool('REQUIRE_S3_MEDIA', default=False)

if USE_S3:
    INSTALLED_APPS.append('storages')
    AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = env('AWS_S3_REGION_NAME', default='ap-south-1')
    _custom_domain = env('AWS_S3_CUSTOM_DOMAIN', default='')
    if _custom_domain:
        AWS_S3_CUSTOM_DOMAIN = _custom_domain
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False
    AWS_QUERYSTRING_AUTH = True
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    STORAGES = {
        'default': {
            'BACKEND': 'storages.backends.s3boto3.S3Boto3Storage',
        },
        'staticfiles': {
            'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
        },
    }

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Encryption key for sensitive data (device passwords)
ENCRYPTION_KEY = env('ENCRYPTION_KEY', default='')
# In production, a missing encryption key would either crash the cryptography
# module or silently store passwords in plain text — both are unacceptable.
if not ENCRYPTION_KEY and not DEBUG:
    raise ImproperlyConfigured(
        "ENCRYPTION_KEY environment variable is not set. "
        "This key encrypts customer device passwords and must be set in production. "
        "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
    )

# GST Configuration (India-specific)
GST_RATES = {
    'STANDARD': 18,  # 18% GST (9% CGST + 9% SGST or 18% IGST)
    'REDUCED': 12,   # 12% GST
    'EXEMPT': 0,     # Exempt items
}

# -----------------------------------------------------------------------
# SMS Configuration — TextBee.dev (Android SMS Gateway, Free)
# How to get these:
#   1. Register at https://textbee.dev
#   2. Install the TextBee app on your Android device
#   3. Grant SMS permissions and sync with the dashboard
#   4. Copy DEVICE_ID and API_KEY from the TextBee dashboard
# -----------------------------------------------------------------------
TEXTBEE_API_KEY = env('TEXTBEE_API_KEY', default='')
TEXTBEE_DEVICE_ID = env('TEXTBEE_DEVICE_ID', default='')

# -----------------------------------------------------------------------
# WhatsApp Configuration
# WHATSAPP_PROVIDER = 'cloud'   → Meta WhatsApp Cloud API (free 1k conv/mo)
# WHATSAPP_PROVIDER = 'twilio'  → Twilio (paid)
# Leave blank to disable WhatsApp.
# -----------------------------------------------------------------------
WHATSAPP_PROVIDER = env('WHATSAPP_PROVIDER', default='cloud')

# Meta WhatsApp Cloud API (free tier — recommended)
WHATSAPP_CLOUD_TOKEN = env('WHATSAPP_CLOUD_TOKEN', default='')
WHATSAPP_PHONE_NUMBER_ID = env('WHATSAPP_PHONE_NUMBER_ID', default='')

# Twilio (fallback / paid)
TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN', default='')
TWILIO_WHATSAPP_FROM = env('TWILIO_WHATSAPP_FROM', default='')


# Low stock alert threshold (default)
LOW_STOCK_THRESHOLD = env.int('LOW_STOCK_THRESHOLD', default=5)

# Financial Year Configuration (India: April to March)
FINANCIAL_YEAR_START_MONTH = 4  # April

# Logging Configuration (JSON lines for log agents)
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json_fmt': {
            '()': 'core.log_formatters.JsonFormatter',
        },
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'service_center.log',
            'maxBytes': 10 * 1024 * 1024,  # 10 MB
            'backupCount': 10,
            'formatter': 'json_fmt',
        },
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json_fmt',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'core': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'audit': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'jobs': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'billing': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Email Configuration
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('EMAIL_HOST_USER', default='noreply@servicecenter.com')

# -----------------------------------------------------------------------
# Database connection persistence — reuse connections instead of opening
# a new PG connection on every request (saves ~5 ms TLS handshake).
# -----------------------------------------------------------------------
DATABASES['default']['CONN_MAX_AGE'] = env.int('CONN_MAX_AGE', default=60)

# -----------------------------------------------------------------------
# Cache — Redis when reachable; LocMemCache as automatic fallback.
#
# WHY: every DRF UserRateThrottle check and every RolePermission cache
from config.runtime_settings import build_runtime_settings
globals().update(build_runtime_settings(env, TIME_ZONE))


# -----------------------------------------------------------------------
# HTTP Security Headers
# Only active when DEBUG=False (i.e. behind an HTTPS-terminating proxy).
# -----------------------------------------------------------------------
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=True)
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = 'DENY'

# -----------------------------------------------------------------------
# DRF Rate Limiting / Throttling
# Only active in production (DEBUG=False).
#
# WHY: throttle classes call cache.get() + cache.set() on every request.
# In development without Redis, even a refused connection is fast, but a
# reachable-but-slow host drains SOCKET_CONNECT_TIMEOUT on every call.
# Rate limiting has no value in local dev, so we skip it entirely.
# -----------------------------------------------------------------------
# Scoped views still need their rate definitions in development, even when
# global throttling is disabled. Keeping rates available avoids runtime errors
# for explicitly throttled endpoints such as public job tracking.
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '60/min',
    'user': '1000/min',
    'login': '10/min',
    'token_refresh': '30/min',
    'otp': '5/min',
    'public_track': '30/min',
}
DELIVERY_OTP_TTL_MINUTES = env.int('DELIVERY_OTP_TTL_MINUTES', default=10)
DELIVERY_OTP_MAX_ATTEMPTS = env.int('DELIVERY_OTP_MAX_ATTEMPTS', default=5)

if not DEBUG:
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ]
# -----------------------------------------------------------------------
# Sentry Error Tracking (backend)
# Set SENTRY_DSN in .env to enable. Free tier: 5k events/month.
# Get DSN from https://sentry.io (free account → New Project → Django).
# -----------------------------------------------------------------------
SENTRY_DSN = env('SENTRY_DSN', default='')
BACKUP_VERIFICATION_TOKEN = env('BACKUP_VERIFICATION_TOKEN', default='')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration(), CeleryIntegration(), RedisIntegration()],
        traces_sample_rate=0.1,   # 10 % of requests → performance data
        send_default_pii=False,   # don't send user email/IP to Sentry
        environment='production' if not DEBUG else 'development',
    )

