"""Deterministic cache and task-queue configuration (no network I/O)."""

import logging
import os


def build_runtime_settings(env, time_zone):
    redis_url = env('REDIS_URL', default='')
    if (
        redis_url.startswith('redis://')
        and 'upstash.io' in redis_url.lower()
    ):
        logging.getLogger(__name__).warning(
            "REDIS_URL uses redis:// for Upstash; correcting it to rediss://."
        )
        redis_url = 'rediss://' + redis_url[len('redis://'):]

    cache_key_prefix = 'scm'
    if os.environ.get('PYTEST_XDIST_WORKER'):
        cache_key_prefix += f":{os.environ['PYTEST_XDIST_WORKER']}"

    if redis_url:
        cache_options = {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'SOCKET_CONNECT_TIMEOUT': 5,
            'SOCKET_TIMEOUT': 5,
            'IGNORE_EXCEPTIONS': True,
        }
        if redis_url.startswith('rediss://'):
            cache_options['CONNECTION_POOL_KWARGS'] = {'ssl_cert_reqs': None}
        caches = {
            'default': {
                'BACKEND': 'django_redis.cache.RedisCache',
                'LOCATION': redis_url,
                'OPTIONS': cache_options,
                'KEY_PREFIX': cache_key_prefix,
                'TIMEOUT': 300,
            }
        }
    else:
        caches = {
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'default',
            }
        }

    return {
        'REDIS_URL': redis_url,
        'REDIS_AVAILABLE': bool(redis_url),
        'CACHES': caches,
        'CELERY_BROKER_URL': env(
            'CELERY_BROKER_URL',
            default=redis_url or 'redis://localhost:6379/0',
        ),
        'CELERY_RESULT_BACKEND': env(
            'CELERY_RESULT_BACKEND',
            default=redis_url or 'redis://localhost:6379/0',
        ),
        'CELERY_ACCEPT_CONTENT': ['json'],
        'CELERY_TASK_SERIALIZER': 'json',
        'CELERY_RESULT_SERIALIZER': 'json',
        'CELERY_TIMEZONE': time_zone,
        'CELERY_TASK_ACKS_LATE': True,
        'CELERY_TASK_REJECT_ON_WORKER_LOST': True,
        'CELERY_TASK_SOFT_TIME_LIMIT': 120,
        'CELERY_TASK_TIME_LIMIT': 180,
        'CELERY_WORKER_PREFETCH_MULTIPLIER': 1,
        'CELERY_RESULT_EXPIRES': 60 * 60 * 24,
        'CELERY_BROKER_CONNECTION_TIMEOUT': 3,
        'CELERY_BROKER_CONNECTION_RETRY': True,
        'CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP': True,
        'CELERY_BROKER_TRANSPORT_OPTIONS': {
            'socket_connect_timeout': 3,
            'socket_timeout': 3,
            'max_retries': 1,
        },
        'CELERY_BEAT_SCHEDULE': {
            'notification-outbox-every-minute': {
                'task': 'notifications.dispatch_pending',
                'schedule': 60,
            },
            'background-pipeline-heartbeat-every-minute': {
                'task': 'system.background_pipeline_heartbeat',
                'schedule': 60,
            },
            'service-reminders-hourly': {
                'task': 'marketing.process_due_service_reminders',
                'schedule': 60 * 60,
            },
        },
    }
