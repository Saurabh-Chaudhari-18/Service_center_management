"""
Gunicorn configuration for Service Center Management backend.
Used when running: gunicorn config.wsgi:application
"""
import os

# Bind
bind = os.environ.get("GUNICORN_BIND", "127.0.0.1:8001")

# Workers
workers = int(os.environ.get("GUNICORN_WORKERS", "3"))
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50

# Timeouts
timeout = 120
keepalive = 5
graceful_timeout = 30

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "scm-backend"

# Security
limit_request_line = 4096

# Chdir to backend root (when run from project root)
raw_env = ["DJANGO_SETTINGS_MODULE=config.settings"]
