# Developer Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.12+ | 3.14 requires psycopg[binary]>=3.3.4 |
| Node.js | 20+ | |
| PostgreSQL | 14+ | |
| Redis | 7+ | For cache and Celery |
| Git | any | |

---

## Local Setup

### 1. Clone
```bash
git clone <repo>
cd Service_center_management
```

### 2. Backend
```bash
cd Backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env           # Windows
# cp .env.example .env           # Mac/Linux
```

Edit `.env` — mandatory values:
```bash
DEBUG=True
SECRET_KEY=generate-with-python-manage.py-shell  # see below
DATABASE_URL=postgres://postgres:admin@localhost:5432/service_center_db
REDIS_URL=redis://localhost:6379/0
```

Generate `SECRET_KEY`:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

```bash
# Create the database
createdb service_center_db   # or use pgAdmin/DBeaver

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Seed dropdown options (physical condition, engineer diagnosis)
python manage.py loaddata fixtures/dropdown_options.json  # if fixture exists
# or use Django admin to add them manually

# Start dev server
python manage.py runserver   # http://127.0.0.1:8000
```

### 3. Frontend
```bash
cd ../frontend

npm install

# Configure environment
copy .env.local.example .env.local

# .env.local content:
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api

npm run dev     # http://localhost:3000
```

### 4. Celery worker (for notifications — optional in dev)
```bash
cd Backend
celery -A config worker -l info
```

---

## Project Structure

### Backend

```
Backend/
├── config/
│   ├── settings.py      # Single settings file — all via environment variables
│   ├── urls.py          # Root URL config — includes all app URL modules
│   ├── celery.py        # Celery app definition + autodiscover
│   └── wsgi.py
├── core/
│   ├── models.py        # Organization, Branch, BranchSequence, User, RolePermission
│   ├── views.py         # UserViewSet, OrganizationViewSet, BranchViewSet + /me endpoint
│   ├── serializers.py   # All core serializers
│   ├── permissions.py   # BranchScopedMixin + all DRF permission classes
│   ├── exceptions.py    # Custom APIException subclasses + exception handler
│   ├── middleware.py    # RequestIDMiddleware
│   ├── utils.py         # Encryption, GST calc, currency formatting, GSTIN validation
│   ├── migrations/      # DB migrations (numbered sequentially)
│   └── urls.py
├── jobs/
│   ├── models.py        # JobCard, JobStatusHistory, JobNote, JobPhoto, PickupRequest, etc.
│   ├── views.py         # JobCardViewSet + all @action endpoints
│   ├── serializers.py
│   ├── services.py      # Business logic (apply_diagnosis, etc.)
│   └── tests.py
├── billing/
│   ├── models.py        # Invoice, InvoiceLineItem, Payment, CreditNote, InvoiceEditHistory
│   ├── views.py         # InvoiceViewSet
│   ├── serializers.py
│   └── tests.py
├── inventory/
│   ├── models.py        # InventoryItem, InventoryAdjustment, JobPartUsage, Purchase
│   ├── views.py
│   └── serializers.py
├── customers/
│   ├── models.py        # Customer, CustomerDocument
│   ├── views.py
│   └── serializers.py
├── notifications/
│   ├── models.py        # NotificationLog, NotificationTemplate, InternalAlert
│   ├── services.py      # NotificationService — all on_* methods
│   └── tasks.py         # Celery tasks: deliver_sms, deliver_whatsapp, deliver_email
├── reports/             # Analytics views (read-only aggregations)
├── gst/                 # GSTR-1/3B generation, ITC, HSN management
├── audit/               # Password access log, audit log, login log
├── expenses/            # Operational expense tracking
├── enquiries/           # CRM — lead management
├── suppliers/           # Supplier master data
├── marketing/           # Ledger/Khata (customer credit)
├── requirements.txt
├── pytest.ini           # pytest configuration
├── conftest.py          # Shared test fixtures
├── Dockerfile
├── docker-entrypoint.sh
└── gunicorn.conf.py
```

### Frontend

```
frontend/
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout (wraps all pages)
│   │   ├── providers.tsx        # Provider stack: Theme > Query > Auth > Toast > ErrorBoundary
│   │   ├── page.tsx             # Landing page
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── jobs/
│   │   │   ├── page.tsx         # Job list
│   │   │   ├── new/page.tsx     # Create job
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # Job detail
│   │   │       └── edit/page.tsx
│   │   ├── billing/
│   │   ├── inventory/
│   │   ├── customers/
│   │   └── ...
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Main navigation (role-filtered)
│   │   │   ├── Header.tsx       # Top bar
│   │   │   └── AppLayout.tsx    # Shell wrapper
│   │   ├── ui/
│   │   │   ├── Toasts.tsx       # Toast notification display
│   │   │   └── ErrorBoundary.tsx
│   │   ├── jobs/                # Job-specific components
│   │   ├── billing/             # Billing-specific components
│   │   └── ...
│   ├── context/
│   │   ├── AuthContext.tsx      # JWT management, user state, permissions
│   │   ├── ThemeContext.tsx     # Dark/light mode
│   │   └── ToastContext.tsx     # Toast notification state
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts        # Axios instance + interceptors
│   │   │   └── services.ts      # All API service functions
│   │   └── utils.ts             # Shared frontend utilities
│   └── types/
│       └── index.ts             # All TypeScript type definitions
├── next.config.ts
├── tsconfig.json
├── .env.local
└── package.json
```

---

## Key Patterns

### Adding a new API endpoint

1. **Model** — Add to appropriate app's `models.py`, create migration
2. **Serializer** — Add to `serializers.py`
3. **View** — Add ViewSet or `@action` to `views.py`
4. **URL** — Register in app's `urls.py`
5. **Permissions** — Apply `BranchScopedMixin` and appropriate permission class
6. **Frontend service** — Add function to `frontend/src/lib/api/services.ts`
7. **Test** — Add pytest test case

### Adding an @action to a ViewSet

```python
@action(detail=True, methods=['post'], permission_classes=[IsOwnerOrManager])
def my_action(self, request, pk=None):
    instance = self.get_object()   # BranchScopedMixin ensures branch isolation
    # ... business logic ...
    return Response({'message': 'Done.'})
```

### Adding a new permission

1. Add the field to `RolePermission` model in `core/models.py`
2. Create a migration
3. Add a corresponding DRF permission class in `core/permissions.py`:
   ```python
   class CanDoNewThing(BasePermission):
       def has_permission(self, request, view):
           return _has_perm(request.user, 'can_do_new_thing')
   ```
4. Update migration `0005_seed_role_permissions.py` (or create a new data migration) to seed values for all 6 roles
5. Add `canDoNewThing` to `UserPermissions` interface in `frontend/src/types/index.ts`
6. Add to the `ROLE_PERMISSIONS` map in `frontend/src/context/AuthContext.tsx`

### Sending notifications

```python
from notifications.services import NotificationService

# Dispatch async (fire-and-forget)
NotificationService.on_job_ready_for_delivery(job)

# Under the hood, this:
# 1. Creates a NotificationLog with status=PENDING
# 2. Celery task deliver_sms.delay(log_id) or deliver_whatsapp.delay(log_id)
```

### Running background tasks (Celery)

```python
from celery import shared_task

@shared_task(bind=True, max_retries=3, default_retry_delay=60,
             autoretry_for=(Exception,))
def my_task(self, some_id: int):
    obj = MyModel.objects.get(id=some_id)
    # ... do work ...
```

Always pass IDs, not model instances, to Celery tasks (instances aren't serializable).

---

## Running Tests

```bash
cd Backend

# Run all tests
pytest

# Run specific app
pytest jobs/tests.py -v

# Run specific test class
pytest core/tests.py::TestRBACMatrix -v

# Run with coverage
pytest --cov=core --cov=billing --cov=jobs --cov-report=term-missing

# Exclude slow tests
pytest -m "not slow"

# Run only integration tests
pytest -m integration
```

### Test database
pytest-django creates a fresh test database for each test run. The `conftest.py` provides fixtures:
- `db` — enables database access
- `org`, `branch` — test Organization and Branch
- `make_user(role=...)` — factory for creating users of any role
- `owner`, `technician`, `accountant`, `receptionist` — pre-built user fixtures
- `api_client` — DRF APIClient
- `auth_client` — APIClient pre-authenticated as the `owner` fixture
- `seed_permissions` — ensures RolePermission rows exist (mirrors production data migration)

### Writing a test

```python
import pytest
from jobs.models import JobCard, JobStatus

@pytest.mark.django_db
class TestMyFeature:
    def test_something(self, branch, owner, api_client):
        api_client.force_authenticate(user=owner)
        response = api_client.post('/api/jobs/jobs/', {...})
        assert response.status_code == 201
        assert response.data['status'] == 'RECEIVED'
```

---

## Database Migrations

```bash
# Create migration after model changes
python manage.py makemigrations <app_name>

# Apply migrations
python manage.py migrate

# Check for unapplied migrations (CI gate)
python manage.py migrate --check

# Verify no model changes are missing a migration (CI gate)
python manage.py makemigrations --check --dry-run
```

### Data migrations

For seeding reference data (e.g., dropdown options, default permissions):
```python
# core/migrations/0005_seed_role_permissions.py
def seed(apps, schema_editor):
    RolePermission = apps.get_model('core', 'RolePermission')
    RolePermission.objects.update_or_create(role='OWNER', defaults={...})

class Migration(migrations.Migration):
    operations = [migrations.RunPython(seed, unseed)]
```

Always write a reverse function (`unseed`) so `migrate --backward` works.

---

## Environment Variables Reference

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DEBUG` | Yes | False | `True` for local dev. Never True in production. |
| `SECRET_KEY` | Yes | — | Django secret key. Generate with manage.py. |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis for cache + Celery broker |
| `ALLOWED_HOSTS` | No | `localhost,127.0.0.1` | Comma-separated hostnames |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated frontend origins |
| `ENCRYPTION_KEY` | Prod | derived from SECRET_KEY | Fernet key for device passwords |
| `TEXTBEE_API_KEY` | No | — | TextBee SMS API key |
| `TEXTBEE_DEVICE_ID` | No | — | TextBee device ID |
| `WHATSAPP_PROVIDER` | No | `cloud` | `cloud` or `twilio` |
| `WHATSAPP_CLOUD_TOKEN` | No | — | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | No | — | Meta phone number ID |
| `EMAIL_HOST_USER` | No | — | SMTP from address |
| `EMAIL_HOST_PASSWORD` | No | — | SMTP password |
| `SENTRY_DSN` | No | — | Sentry DSN for error tracking |
| `USE_S3` | No | `False` | `True` to use S3 for media files |
| `AWS_STORAGE_BUCKET_NAME` | If USE_S3 | — | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | If USE_S3 | — | AWS/MinIO access key |
| `AWS_SECRET_ACCESS_KEY` | If USE_S3 | — | AWS/MinIO secret key |
| `LOW_STOCK_THRESHOLD` | No | `5` | Global low-stock alert threshold |
| `CONN_MAX_AGE` | No | `60` | DB connection persistence (seconds) |

### Frontend (`.env.local`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://127.0.0.1:8000/api` | Backend API base URL |

---

## Code Conventions

### Backend

**Models:**
- All models inherit `TimeStampedModel` (adds `created_at`, `updated_at`)
- UUID primary keys everywhere except utility tables (BranchSequence)
- Business logic methods on the model are fine for single-object operations
- Cross-model operations belong in `services.py`

**Views:**
- All ViewSets use `BranchScopedMixin` for automatic branch isolation
- Custom actions use `@action(detail=True/False, methods=[...])`
- Permissions declared on the class or per-action via `permission_classes`
- Return `Response({...})` with explicit `status=status.HTTP_xxx`

**Exceptions:**
- Business rule violations → raise specific exception class from `core/exceptions.py`
- Never raise raw `Exception` or `ValueError` from views (use the custom classes)

**Serializers:**
- Create/Update serializers are separate from Read serializers on complex models
- Use `@transaction.atomic` on `create()` and `update()` methods that touch multiple tables

**Imports:**
- Django imports first
- Third-party imports second
- Local imports third
- No circular imports — services can import from models, views import from services

### Frontend

**Pages:**
- Next.js App Router — all pages are `async` server components by default
- Add `"use client"` directive only when using hooks or browser APIs
- Pages should be thin — extract components to `src/components/`

**API calls:**
- All API calls go through `src/lib/api/services.ts` — never inline Axios calls in components
- Use TanStack Query (`useQuery`, `useMutation`) for data fetching in components
- Show toast on success/error: `toast.success(...)` / `toast.error(...)`

**Types:**
- All shared types live in `src/types/index.ts`
- API response shapes must match backend serializer output exactly
- Use `PaginatedResponse<T>` for paginated endpoints

**Permissions:**
- Always check with `hasPermission(key)` before showing write controls
- Use `<ProtectedRoute>` at the page level for full-page gates
- Never rely solely on hidden UI — permissions are also enforced server-side

---

## Common Tasks

### Flush Redis cache (force permission refresh)
```bash
cd Backend
python manage.py shell -c "
from django.core.cache import cache
from core.models import Role
cache.delete_many([f'role_perms_{r}' for r in ['SUPER_ADMIN','OWNER','MANAGER','RECEPTIONIST','TECHNICIAN','ACCOUNTANT']])
print('Cache cleared')
"
```

### Re-seed role permissions
```bash
python manage.py migrate core 0004  # roll back to before seed
python manage.py migrate core       # re-run seed migration
```

### Reset a user's password
```bash
python manage.py shell -c "
from core.models import User
u = User.objects.get(email='user@center.com')
u.set_password('new-password')
u.save()
print('Done')
"
```

### Check what migrations are pending
```bash
python manage.py showmigrations --list | grep '\[ \]'
```

### Generate API schema
```bash
python manage.py spectacular --file schema.yml
```

---

## CI / CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

1. **Backend job:**
   - Python 3.12
   - PostgreSQL and Redis service containers
   - `pip install -r requirements.txt`
   - `python manage.py check`
   - `python manage.py migrate`
   - `pytest` (all tests)
   - `python manage.py makemigrations --check` (fails if models changed without a migration)

2. **Frontend job:**
   - Node 20
   - `npm ci`
   - `tsc --noEmit` (type check)
   - `npm run lint`
   - `npm run build`

3. **Docker smoke test** (main branch only):
   - `docker build ./Backend`
   - Container starts without errors

**PRs must pass all three jobs before merging.**

---

## Debugging Tips

### API returns 401 in local dev
- Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches the Django dev server port (8000)
- Check that JWT tokens haven't expired in `localStorage`

### API returns CORS error
- `DEBUG` must be `True` in `Backend/.env` — when `False`, `SECURE_SSL_REDIRECT=True` causes redirects without CORS headers
- Check `CORS_ALLOWED_ORIGINS` includes `http://localhost:3000`

### "Access Denied" on all pages after login
- The `RolePermission` table may be empty — run migrations: `python manage.py migrate`
- Redis may be serving a stale all-false cache — flush with the shell command above

### Celery tasks not running
- Ensure Redis is running: `redis-cli ping` → PONG
- Start the worker: `celery -A config worker -l info`
- Check `CELERY_BROKER_URL` in `.env` matches your Redis URL

### Stock not deducting on part approval
- Check the `InventoryAdjustment` table for error entries
- The `PartRequest.approve()` method uses `select_for_update()` — ensure PostgreSQL is configured (not SQLite, which doesn't support row-level locking)

### GST calculated incorrectly (all IGST instead of CGST+SGST)
- Check `branch.state_code` is set on the Branch model
- Check `customer.state_code` is set on the Customer model
- The system determines interstate/intrastate by comparing these two codes — missing codes default to interstate
