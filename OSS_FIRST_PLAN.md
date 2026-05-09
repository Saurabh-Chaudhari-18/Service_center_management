# Free / OSS-First Stack — Now → Paid Later

**Goal:** fix the synchronous Twilio/SMTP/openpyxl bottleneck and the surrounding production gaps using only free or open-source components, while keeping a clean upgrade path to paid services later.

**Design principle:** every replacement below is **interface-compatible** with its paid counterpart — i.e. switching is a config + credentials change, not a re-architecture.

---

## 1. Decision Table

| Concern | Free / OSS option (now) | Drop-in paid upgrade later |
|---|---|---|
| **Background job queue** | **Celery + Redis** (Redis self-hosted in Docker; or Render free Redis 25 MB; or Upstash free 10k cmd/day) | Same code; managed Redis (ElastiCache, Upstash paid, Redis Cloud) |
| **Alt. queue (no Redis)** | **Django Q2** with Postgres broker (reuses existing DB, zero new infra) | Migrate to Celery+Redis when volume > ~10 jobs/sec |
| **SMS** | **Already done** — TextBee (Android-as-gateway, free) | MSG91 / Gupshup / Twilio SMS |
| **WhatsApp** | **Meta WhatsApp Cloud API direct** (1000 conversations/month free, no Twilio markup) | Twilio WhatsApp / Gupshup / AiSensy |
| **Email** | **Brevo SMTP 300/day** or **Resend 3000/mo** or **Amazon SES** ($0.10/1k = ~free) | SendGrid / Postmark / Mailgun |
| **Excel exports** | **openpyxl write-only mode + Celery** (already free; just async + streaming) | Same; or push generation to a worker pool |
| **Cache** | **Redis** (same instance as queue) — single service, two uses | Managed Redis as above |
| **Object storage** (replaces local `media/`) | **MinIO** self-hosted (S3-compatible) **or Cloudflare R2** free tier (10 GB, zero egress) **or Backblaze B2** (10 GB free) | Migrate bucket to AWS S3 — `django-storages` config swap only |
| **Error tracking (backend + frontend)** | **GlitchTip** self-hosted (Sentry-API compatible) **or Sentry SaaS free tier** (5k events/mo) | Sentry Team plan |
| **Metrics & dashboards** | **Prometheus + Grafana** (self-hosted) **or Grafana Cloud free** (10k series) | Datadog / New Relic |
| **Log aggregation** | **Loki + Promtail** self-hosted **or Grafana Cloud Logs** (50 GB free) | Datadog Logs / ELK |
| **APM / tracing** | **OpenTelemetry SDK + Tempo** (Grafana Cloud has free tier) | Datadog APM |
| **CI/CD** | **GitHub Actions** (2000 min/mo free for private repos) | Self-hosted runners or paid minutes |
| **Secrets** | **`.env` + systemd `EnvironmentFile=`** (current state) → **Doppler free** or **Infisical OSS** | AWS Secrets Manager / Vault |
| **DB connection pooling** | **PgBouncer** (open source, single binary) | Same — there is no paid PgBouncer |
| **Load testing** | **k6** OSS or **Locust** (Python) | k6 Cloud / Grafana Cloud k6 |
| **Uptime monitoring** | **Uptime Kuma** self-hosted **or BetterStack free** (10 monitors) | Pingdom / BetterStack paid |

---

## 2. Recommended "Phase 1" Stack — Pick This

If you want one concrete recommendation rather than options:

| Layer | Choice | Why |
|---|---|---|
| Queue | **Celery + Redis** | Industry standard. Bigger talent pool. Same code path stays valid for years. |
| Cache | Same Redis | One service does two jobs. |
| WhatsApp | **Meta WA Cloud API** | Cuts out the Twilio markup; free 1k conversations/mo covers most pilots. |
| Email | **Brevo SMTP** (300/day) until volume forces SES | Zero-config switch from Gmail SMTP — just env vars. |
| Object storage | **Cloudflare R2** | 10 GB free + **zero egress fees** = cheapest possible scale-up curve. |
| Error tracking | **Sentry SaaS free tier** | Don't self-host this; the operational overhead isn't worth saving $26/mo later. |
| Metrics | **Grafana Cloud free** | Same logic — generous free tier, no ops burden. |
| Secrets | Stay on `.env` for now | Don't over-engineer at < 10 customers. |

**Total monthly cost at pilot scale: ₹0.**

---

## 3. Why You Can Defer Each Paid Migration

| Component | Trigger to upgrade |
|---|---|
| Redis (free → paid) | When you outgrow 25 MB or need persistence/HA. ~50 customers. |
| WhatsApp Cloud → Twilio | When you need template approval automation, fallback routing, or > 1k conversations/mo. |
| Brevo SMTP → SES | When you exceed 300 emails/day **and** want < $0.10/1k pricing. |
| R2 → S3 | Probably never. R2 is cheaper than S3 for your access pattern. |
| Sentry free → paid | When you exceed 5k errors/mo (means you have a different problem first). |
| `.env` → secrets manager | When you have ≥ 3 environments × ≥ 5 engineers, or compliance requires it. |

The point is: **there's no Day-1 paid component you actually need**. Every paid upgrade is gated by a real-world growth signal.

---

## 4. Concrete Code Migration — Twilio → WhatsApp Cloud API

The key insight: your `notifications/services.py` already has a `_send_whatsapp` indirection ([Backend/notifications/services.py:420](Backend/notifications/services.py)). Swapping providers is a single function rewrite, not a refactor.

```python
# notifications/services.py — replace _send_whatsapp body
def _send_whatsapp(self, phone, message, log):
    """
    Meta WhatsApp Cloud API (free 1k conversations/mo).
    Drop-in replacement for the Twilio version — same call shape.
    """
    import requests
    token = settings.WHATSAPP_CLOUD_TOKEN
    phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
    if not (token and phone_id):
        log.mark_failed("WhatsApp Cloud not configured")
        return
    r = requests.post(
        f"https://graph.facebook.com/v21.0/{phone_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "messaging_product": "whatsapp",
            "to": phone if phone.startswith("+") else f"+91{phone}",
            "type": "text",
            "text": {"body": message},
        },
        timeout=15,
    )
    if r.ok:
        log.mark_sent({"provider": "wa_cloud", "id": r.json().get("messages", [{}])[0].get("id")})
    else:
        log.mark_failed(f"WA Cloud {r.status_code}: {r.text[:200]}")
```

The Twilio code stays in the file as a fallback path; switch by env var (`WHATSAPP_PROVIDER=cloud|twilio`).

---

## 5. Concrete Code — Synchronous → Celery

Three steps; each independently testable.

### Step 1 — Add the dependency
```
# requirements.txt
celery==5.4.0
redis==5.2.0
django-redis==5.4.0
```

### Step 2 — Wire Celery into Django
```python
# Backend/config/celery.py  (new file)
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
app = Celery('scm')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

```python
# Backend/config/__init__.py
from .celery import app as celery_app
__all__ = ['celery_app']
```

```python
# Backend/config/settings.py — append
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_TASK_SOFT_TIME_LIMIT = 60
CELERY_TASK_TIME_LIMIT = 120

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/1'),
    }
}
```

### Step 3 — Convert one notification call site
```python
# notifications/tasks.py  (new)
from celery import shared_task
from notifications.services import NotificationService

@shared_task(bind=True, max_retries=3, default_retry_delay=30, autoretry_for=(Exception,))
def send_notification_task(self, log_id):
    NotificationService.process_log(log_id)
```

```python
# notifications/services.py — caller side
from notifications.tasks import send_notification_task
# was: NotificationService._send_customer_notification(...)
log = NotificationLog.objects.create(...)  # row first, send second
send_notification_task.delay(log.id)
```

### Step 4 — Run the worker
```yaml
# docker-compose.yml — add
  redis:
    image: redis:7-alpine
    volumes: ['redis_data:/data']

  celery-worker:
    build: { context: ./Backend }
    command: celery -A config worker -l info --concurrency=4
    env_file: .env
    depends_on: [redis, postgres]

volumes:
  redis_data:
```

That's the **entire** async refactor. ~80 lines of code, one new container, zero changes to existing views or models.

The Excel-export endpoint follows the same pattern: wrap the body in a `@shared_task`, return `{"job_id": task.id, "status_url": "/api/reports/jobs/<task.id>/"}`, poll status.

---

## 6. What This Buys You Immediately

After items in §5, on the existing 3-worker gunicorn setup:

| Metric | Before | After |
|---|---|---|
| Job-create latency p95 | 800–4000 ms (Twilio dependent) | 80–150 ms (Twilio happens off-thread) |
| Worker starvation under provider outage | **Yes — total outage** | No — workers freed, queue grows |
| Excel export OOM risk | **Yes** | No — runs in worker pool, RAM-bounded |
| `RolePermission` cache invalidation across workers | Broken silently | Works (Redis backend) |
| Multi-instance backend | **Blocked** (LocMemCache split-brain) | **Unblocked** (shared Redis) |

That single weekend of work flips four `❌` rows in the production-readiness checklist (B4.1, B4.2, B4.5).

---

## 7. What You Still Don't Get for Free

Be honest about the limits:

- **Object storage** still needs to happen before you can horizontally scale. R2/MinIO setup is ~half a day.
- **Backups** still need a real plan; cron + `pg_dump` to R2 is the free option (~30 LOC bash).
- **Tests** are still missing; no free service writes them for you.
- **Compliance** (8-year GST retention, data residency) is a policy decision, not a tooling problem.

---

## 8. TL;DR Recommendation

1. **This week:** add Celery + Redis. Move notifications and Excel exports to tasks. Switch `CACHES` to Redis backend. Done.
2. **Next week:** swap Twilio WhatsApp → Meta Cloud API (or leave both behind a flag). Add Sentry SaaS free tier on both backend and frontend. Wire `pg_dump` cron to R2.
3. **Within the month:** migrate `media/` to R2 via `django-storages`. Add a `RotatingFileHandler` and `/api/healthz`. Stand up a single GitHub Actions workflow.

You will have spent **₹0 in subscriptions** and lifted the production-readiness score from **4.5 → ~7**. Paid services become a procurement decision when growth signals demand them, not a Day-1 architectural commitment.
