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
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
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
DATABASES = {
    'default': env.db(
        'DATABASE_URL',
        default='postgres://postgres:postgres@localhost:5432/service_center_db'
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
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

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
}

# DRF Spectacular (OpenAPI)
SPECTACULAR_SETTINGS = {
    'TITLE': 'Service Center Management API',
    'DESCRIPTION': 'Multi-tenant service center management system for Indian computer & laptop service centers',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
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
    'x-branch-id',  # Custom header for branch context
]

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
# WhatsApp Configuration — Twilio (Paid, disabled by default)
# Uncomment and configure these when/if you upgrade to Twilio WhatsApp.
# -----------------------------------------------------------------------
# TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID', default='')
# TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN', default='')
# TWILIO_WHATSAPP_FROM = env('TWILIO_WHATSAPP_FROM', default='')
TWILIO_ACCOUNT_SID = env('TWILIO_ACCOUNT_SID', default='')
TWILIO_AUTH_TOKEN = env('TWILIO_AUTH_TOKEN', default='')
TWILIO_WHATSAPP_FROM = env('TWILIO_WHATSAPP_FROM', default='')


# Low stock alert threshold (default)
LOW_STOCK_THRESHOLD = env.int('LOW_STOCK_THRESHOLD', default=5)

# Financial Year Configuration (India: April to March)
FINANCIAL_YEAR_START_MONTH = 4  # April

# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'service_center.log',
            'formatter': 'verbose',
        },
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'core': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
        },
        'audit': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
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

