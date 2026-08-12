# Deployment Guide

## Overview

The system has two deployable components:

| Component | Technology | Port |
|-----------|-----------|------|
| Backend API | Django + Gunicorn (Docker) | 8000 |
| Frontend | Next.js (Docker / Vercel) | 3000 |

External dependencies:
- **PostgreSQL** (managed DB on Render/Railway/RDS, or self-hosted)
- **Redis** (managed on Render/Upstash/ElastiCache, or self-hosted)

---

## Docker (Recommended)

### Tenant-integrity preflight for upgrades

The tenant schema now makes branch ownership mandatory for tenant-owned business
records. Before deploying these migrations over an existing database, run the
audit with the new application image while the old schema is still active:

```bash
python manage.py audit_tenant_integrity
```

If it reports legacy rows, map each row to its real owning branch and rerun the
audit. Do not invent a default branch: the migration intentionally stops on
unresolved ownership rather than exposing data to the wrong tenant. Fresh
installations can proceed directly to `migrate`.

### Build the backend image

```bash
cd Backend
docker build -t scm-backend:latest .
```

### Run the backend container

The `docker-entrypoint.sh` runs migrations and collectstatic before Gunicorn starts:

```bash
docker run -d \
  --name scm-backend \
  -p 8000:8001 \
  -e DEBUG=False \
  -e SECRET_KEY="<generate-a-key>" \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -e REDIS_URL="redis://host:6379/0" \
  -e CELERY_BROKER_URL="redis://host:6379/0" \
  -e ALLOWED_HOSTS="api.yourapp.com,localhost" \
  -e CORS_ALLOWED_ORIGINS="https://yourapp.com,https://www.yourapp.com" \
  -e ENCRYPTION_KEY="<fernet-key>" \
  scm-backend:latest
```

Generate `SECRET_KEY`:
```bash
docker run --rm scm-backend python -c \
  "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Generate `ENCRYPTION_KEY`:
```bash
docker run --rm scm-backend python -c \
  "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Celery worker container

```bash
docker run -d \
  --name scm-celery \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e SECRET_KEY="..." \
  -e DEBUG=False \
  --entrypoint="" \
  scm-backend:latest \
  celery -A config worker -l info --concurrency=2
```

### Celery Beat scheduler (required)

```bash
docker run -d \
  --name scm-beat \
  -e DATABASE_URL="..." \
  -e REDIS_URL="..." \
  -e SECRET_KEY="..." \
  --entrypoint="" \
  scm-backend:latest \
  celery -A config beat -l info
```

Beat is required for notification outbox recovery, the worker/scheduler heartbeat, and service reminders. A deployment without it is not ready.

---

## Docker Compose (local / staging)

```yaml
# docker-compose.yml
version: "3.9"

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: service_center_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: admin
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  backend:
    build: ./Backend
    ports:
      - "8000:8001"
    depends_on:
      - db
      - redis
    environment:
      DEBUG: "False"
      SECRET_KEY: "${SECRET_KEY}"
      DATABASE_URL: "postgres://postgres:admin@db:5432/service_center_db"
      REDIS_URL: "redis://redis:6379/0"
      CELERY_BROKER_URL: "redis://redis:6379/0"
      ENCRYPTION_KEY: "${ENCRYPTION_KEY}"
      ALLOWED_HOSTS: "localhost,127.0.0.1"
      CORS_ALLOWED_ORIGINS: "http://localhost:3000"
    volumes:
      - media:/app/media
      - logs:/app/logs

  celery:
    build: ./Backend
    entrypoint: ""
    command: celery -A config worker -l info --concurrency=2
    depends_on:
      - db
      - redis
    environment:
      DATABASE_URL: "postgres://postgres:admin@db:5432/service_center_db"
      REDIS_URL: "redis://redis:6379/0"
      SECRET_KEY: "${SECRET_KEY}"
      DEBUG: "False"

  celery-beat:
    build: ./Backend
    entrypoint: ""
    command: celery -A config beat -l info
    depends_on:
      - db
      - redis
    environment:
      DATABASE_URL: "postgres://postgres:admin@db:5432/service_center_db"
      REDIS_URL: "redis://redis:6379/0"
      SECRET_KEY: "${SECRET_KEY}"
      DEBUG: "False"

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: "http://backend:8001/api"

volumes:
  pgdata:
  media:
  logs:
```

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Stop
docker compose down
```

---

## Render.com Deployment

Render offers a free tier for web services and PostgreSQL.

### Backend service
1. Connect your GitHub repo to Render
2. Create a **Web Service** → select the `Backend/` directory
3. Settings:
   - **Runtime:** Docker
   - **Dockerfile path:** `Backend/Dockerfile`
   - **Health check path:** `/api/healthz/`
   - **Port:** `8001`
4. Environment variables (set in Render dashboard):
   ```
   DEBUG=False
   SECRET_KEY=<generated>
   DATABASE_URL=<Render PostgreSQL URL>
   REDIS_URL=<Render Redis URL or Upstash URL>
   CELERY_BROKER_URL=<same Redis URL>
   ENCRYPTION_KEY=<generated>
   ALLOWED_HOSTS=your-service.onrender.com
   CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
   ```

### Celery worker (Render Background Worker)
1. Create a **Background Worker** service
2. Same Docker image as backend
3. **Start command:** `celery -A config worker -l info --concurrency=2`
4. Same environment variables

### Celery Beat (Render Background Worker)
1. Create a second **Background Worker** service from the backend image
2. **Start command:** `celery -A config beat -l info`
3. Use the same database, Redis, secret, and encryption environment variables

### PostgreSQL
- Create a **PostgreSQL** service on Render (free tier: 256 MB)
- Copy the `Internal Database URL` as `DATABASE_URL`

### Redis
- Use **Upstash** (free tier) or Render Redis
- Copy the Redis URL as `REDIS_URL`

---

## Vercel Deployment (Frontend)

### Deploy
1. Connect your GitHub repo to Vercel
2. Set **Root directory:** `frontend`
3. Framework: Next.js (auto-detected)
4. Environment variables:
   ```
   NEXT_PUBLIC_API_URL=/api
   BACKEND_API_URL=https://your-backend.onrender.com/api
   ```
5. Deploy

### Custom domain
Configure your domain in Vercel project settings. Update `CORS_ALLOWED_ORIGINS` in the backend to include `https://yourdomain.com`.

Browser API traffic must stay on the frontend origin (`/api`). Next.js or Nginx proxies that path to Django, allowing Secure, HTTP-only access and refresh cookies to protect the session without exposing tokens to JavaScript.

---

## Production Checklist

### Security
- [ ] `DEBUG=False`
- [ ] `SECRET_KEY` is random, at least 50 characters, not committed to git
- [ ] `ENCRYPTION_KEY` is a valid Fernet key, not committed to git
- [ ] `ALLOWED_HOSTS` includes only your actual domain(s)
- [ ] `CORS_ALLOWED_ORIGINS` includes only your frontend domain(s)
- [ ] HTTPS enforced — `SECURE_SSL_REDIRECT=True` activates automatically when `DEBUG=False`
- [ ] `SECURE_HSTS_SECONDS` is set (activates when `DEBUG=False`)
- [ ] Database password is not the default `admin`

### Media files
- [ ] `USE_S3=True` configured with valid S3/MinIO credentials
- [ ] `AWS_STORAGE_BUCKET_NAME` bucket exists and is private (not public read)
- [ ] Bucket CORS policy allows your frontend domain for direct uploads (if applicable)

### Notifications
- [ ] `TEXTBEE_API_KEY` and `TEXTBEE_DEVICE_ID` set if using SMS
- [ ] `WHATSAPP_CLOUD_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` set if using WhatsApp
- [ ] `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` set for invoice email delivery

### Error tracking
- [ ] `SENTRY_DSN` set in backend
- [ ] `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) set in frontend

### Operational
- [ ] Health check endpoint responding: `GET /api/healthz/` → 200
- [ ] Readiness endpoint responding: `GET /api/readyz/` → 200 (shared cache, task queue, customer delivery, media, and verified backups)
- [ ] Celery worker running and processing tasks
- [ ] Celery Beat running; `/api/readyz/` reports a recent scheduler heartbeat
- [ ] Daily database backup scheduled
- [ ] A backup has been restored into an isolated database and `BACKUP_VERIFICATION_TOKEN` records that successful drill
- [ ] Log rotation configured (handled by `RotatingFileHandler` — 10MB × 10 files)
- [ ] Redis `maxmemory` policy set (prevents Redis from consuming all RAM)

---

## Environment Variable Quick Reference

### Generating keys

```bash
# Django SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Fernet ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Minimum production `.env`

```bash
DEBUG=False
SECRET_KEY=<50+ random chars>
ENCRYPTION_KEY=<fernet-key>
DATABASE_URL=postgres://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379/0
CELERY_BROKER_URL=redis://host:6379/0
CELERY_RESULT_BACKEND=redis://host:6379/0
ALLOWED_HOSTS=api.yourapp.com
CORS_ALLOWED_ORIGINS=https://yourapp.com
BACKUP_VERIFICATION_TOKEN=<latest-successful-restore-drill-id>
```

---

## Database Migrations on Deploy

Migrations run automatically on container start via `docker-entrypoint.sh`:

```bash
python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear
exec gunicorn config.wsgi:application -c gunicorn.conf.py
```

For multi-replica deployments (e.g., 3 web containers):
- Only one container should run migrations
- Use a Render pre-deploy command or a separate one-off migration job
- Alternatively, keep single-replica web service and scale horizontally only for Celery workers

---

## Gunicorn Configuration

`Backend/gunicorn.conf.py`:

```python
bind = "0.0.0.0:8001"
workers = 2            # Adjust: (2 × CPU cores) + 1
worker_class = "sync"  # Use "gevent" for high concurrency
timeout = 120          # Match CELERY_TASK_SOFT_TIME_LIMIT
keepalive = 5
max_requests = 1000    # Recycle workers to prevent memory leaks
max_requests_jitter = 50
accesslog = "-"        # stdout for Docker log aggregation
errorlog = "-"
loglevel = "info"
```

For a **2 vCPU** server: `workers = 5`  
For a **1 vCPU** (Render free tier): `workers = 2`

---

## nginx Configuration (if self-hosting)

```nginx
upstream django {
    server 127.0.0.1:8001;
}

server {
    listen 443 ssl;
    server_name api.yourapp.com;

    ssl_certificate /etc/letsencrypt/live/api.yourapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourapp.com/privkey.pem;

    # Rate limiting (10 req/s per IP)
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    # Max upload size (for photos, Excel imports)
    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://django;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /media/ {
        # Serve media directly if using local storage
        # Skip this if using S3
        alias /app/media/;
        expires 1d;
    }

    location /static/ {
        alias /app/staticfiles/;
        expires 30d;
    }
}

server {
    listen 80;
    server_name api.yourapp.com;
    return 301 https://$host$request_uri;
}
```

---

## Backup & Recovery

### PostgreSQL backup

```bash
# Manual backup
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Upload to S3
aws s3 cp backup_*.sql.gz s3://your-backup-bucket/db-backups/

# Automated (add to crontab or Render cron job):
0 2 * * * pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://bucket/db-backups/backup_$(date +\%Y\%m\%d).sql.gz
```

### Restore from backup

```bash
gunzip backup_YYYYMMDD.sql.gz
psql $DATABASE_URL < backup_YYYYMMDD.sql

# Verify migration state
python manage.py showmigrations
python manage.py migrate --fake-initial   # if migrating to restored DB
```

### Recovery Time Objective (RTO)

| Component | Recovery action | Estimated time |
|-----------|----------------|----------------|
| Backend container crash | Container auto-restarts | < 1 minute |
| Database corruption | Restore from last backup | 30–120 minutes |
| Redis data loss | Celery re-queues tasks; cache rebuilds on demand | < 5 minutes |
| Full server loss | Rebuild from Docker image + DB restore | 1–3 hours |

---

## Monitoring

### Health check
```
GET /api/healthz/
```
Response: `{ "status": "ok", "db": "ok", "cache": "ok" }`

Set up Render/UptimeRobot/Pingdom to alert if this returns non-200.

### Sentry
- Backend: Configure `SENTRY_DSN` — all unhandled exceptions and 5xx errors are captured
- Frontend: Configure `NEXT_PUBLIC_SENTRY_DSN` — uncaught React errors captured

### Log locations
| Logs | Location |
|------|---------|
| Django application | `Backend/logs/service_center.log` (rotated 10MB × 10) |
| Gunicorn access | stdout (Docker log) |
| Celery tasks | stdout (Docker log) |
| Next.js | stdout (Vercel/Docker log) |

### Key metrics to watch
- API response time (P95 > 500ms = investigate)
- Celery queue depth (`celery -A config inspect active`)
- PostgreSQL connection count (watch for connection leaks)
- Redis memory usage (set `maxmemory` and `allkeys-lru` policy)
- Disk space for `logs/` and `media/` directories
