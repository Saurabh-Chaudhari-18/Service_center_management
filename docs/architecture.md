# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │          nginx (reverse proxy) │
               │    rate limiting / SSL term    │
               └───────────────┬───────────────┘
                               │
         ┌─────────────────────┴──────────────────────┐
         │                                            │
┌────────▼────────┐                        ┌─────────▼────────┐
│  Next.js 16     │                        │  Django 6 + DRF  │
│  (App Router)   │  ◄── REST API (JWT) ──►│  Gunicorn WSGI   │
│  Port 3000      │                        │  Port 8000       │
└─────────────────┘                        └─────────┬────────┘
                                                     │
                        ┌────────────────────────────┼──────────────┐
                        │                            │              │
               ┌────────▼──────┐         ┌──────────▼────┐ ┌──────▼──────┐
               │  PostgreSQL   │         │    Redis       │ │   Media     │
               │  (primary DB) │         │  (cache+queue) │ │  (S3/local) │
               └───────────────┘         └───────┬───────┘ └─────────────┘
                                                  │
                              ┌───────────┴───────────┐
                              │                       │
                     ┌────────▼────────┐     ┌────────▼────────┐
                     │ Celery Workers  │     │   Celery Beat   │
                     │ (SMS/WA/Email)  │     │ outbox/reminders│
                     └─────────────────┘     └─────────────────┘
```

---

## Django Application Structure

```
Backend/
├── config/
│   ├── settings.py          # Settings composition (env-driven)
│   ├── urls.py              # Root URL conf
│   ├── wsgi.py
│   └── celery.py            # Celery app + autodiscover
├── core/                    # Compatibility facades + stable persisted models
├── identity/                # Authentication, user/role views, RBAC permissions
├── tenancy/                 # Branch policy, DB tenant context, PostgreSQL RLS
├── platform_health/         # Liveness and readiness endpoints
├── platform_runtime/        # Request/runtime middleware
├── jobs/                    # Facades over focused model/serializer/view modules
├── billing/                 # GST invoices, payments, credit notes
├── inventory/               # Stock management, purchases, adjustments
├── customers/               # Customer master data
├── notifications/           # Celery tasks, notification log, templates
├── reports/                 # Analytics endpoints (read-only aggregations)
├── audit/                   # Audit log, password access log, login log
├── gst/                     # GSTR-1/3B generation, ITC register, HSN codes
├── expenses/                # Operational expense tracking
├── enquiries/               # Lead/enquiry management with CRM follow-ups
├── suppliers/               # Supplier master data
└── marketing/               # Ledger/Khata (customer credit tracking)
```

---

## Multi-Tenancy Model

The system uses a **shared-database, shared-schema** multi-tenancy model. Tenant-owned business tables have a required `branch` foreign key. A short, explicit allowlist covers resources that intentionally support universal rows.

```
Organization (root tenant — one per business group)
│   id, name, legal_name, gstin, bank details, branding
│
└── Branch (one per physical service center location)
        │   id, name, code, gstin, state_code, invoice_prefix
        │
        ├── Users (staff assigned to this branch)
        ├── Customers
        ├── JobCards
        ├── Invoices
        ├── InventoryItems
        └── PurchaseOrders
```

### Branch isolation enforcement

**Application boundary** — `BranchScopedMixin` delegates to the canonical
`BranchScopePolicy` in `tenancy/policy.py`. It resolves branch selectors,
filters reads, validates write ownership, and permits universal rows only for
opted-in resource types.

**Database boundary** — PostgreSQL row-level security is enabled and forced on
every direct branch-owned table. Authentication establishes a transaction-local
tenant context; worker and migration connections use an explicit system
context. This protects data even if an application queryset accidentally omits
its tenant filter.

Simplified application policy:
```python
class BranchScopedMixin:
    def get_queryset(self):
        qs = super().get_queryset()
        accessible = request.user.get_accessible_branches()
        branch_id = self._resolve_branch_context(request)
        if branch_id == 'universal':
            return qs.filter(branch__isnull=True)
        if branch_id:
            return qs.filter(branch=branch_id)
        return qs.filter(branch__in=accessible)

    def perform_create(self, serializer):
        # Automatically assigns the current branch to new records
        serializer.save(branch=resolved_branch, created_by=request.user)
```

**Client side** — every API request includes `X-Branch-ID`, set by the shared API client from `sessionStorage('scm_current_branch')`. The server resolves URL/body/query/header branch inputs through one policy. Universal rows are opt-in per resource; only super administrators may select or create them, and `X-Branch-ID: universal` returns universal rows only.

Before upgrading an existing database to required branch fields,
`manage.py audit_tenant_integrity` must report no legacy unscoped tenant rows.

---

## Authentication & JWT Flow

```
POST /api/auth/token/   {email, password}
    │
    ▼  Returns:
    { authenticated: true } plus access and refresh cookies
    │
    ├── access stored in a Secure, HTTP-only cookie (30-minute TTL)
    └── refresh stored in a Secure, HTTP-only cookie (7-day TTL)

Every subsequent request:
    Cookies sent automatically by the browser
    X-Branch-ID: <current_branch_uuid>

On 401 response:
    POST /api/auth/token/refresh/   (refresh cookie sent automatically)
    → new access cookie set, original request retried
    → On failure: redirect to /login
```

Protected Next.js route entries are server components. The proxy validates the
HTTP-only session with the backend and forwards the verified user to the root
layout, which hydrates authentication before interactive client islands render.
Public login and tracking routes remain client-driven where appropriate.

---

## RBAC Architecture

Permissions are **database-driven**, not hardcoded. This allows admins to change access without a redeploy.

```
RolePermission table (one row per role)
┌──────────────┬─────────────────┬──────────────┬──────────────┐
│ role         │ can_view_billing │ can_create.. │ ...          │
├──────────────┼─────────────────┼──────────────┼──────────────┤
│ OWNER        │ True            │ True         │ ...          │
│ TECHNICIAN   │ False           │ False        │ ...          │
│ ...          │ ...             │ ...          │ ...          │
└──────────────┴─────────────────┴──────────────┴──────────────┘

get_permissions_for_role(role)
    → cache.get('role_perms_{role}')   ← 5-minute Redis TTL
    → if miss: DB lookup + cache.set()
    → Returns dict of {permission_key: bool}
```

Permission evaluation on every API request:
1. JWT decoded → `user.role` extracted
2. `IsBranchMember` checks `user.has_branch_access(branch)`
3. `CanManageBilling` (etc.) calls `get_permissions_for_role(user.role)[key]`
4. If `False` → 403 Forbidden

Cache invalidation: `RolePermission.save()` calls `cache.delete('role_perms_{role}')`.

---

## Job Lifecycle State Machine

```
RECEIVED
  │
  ├──► CANCELLED (from any non-terminal state)
  │
  ▼
DIAGNOSIS
  │
  ▼
ESTIMATE_SHARED
  │
  ├──► REJECTED (terminal — device returned unrepaired)
  │
  ▼
APPROVED
  │
  ├──► WAITING_FOR_PARTS
  │         │
  │         ▼
  └──► REPAIR_IN_PROGRESS
              │
              ▼
        READY_FOR_DELIVERY
              │
              ├──► REPAIR_IN_PROGRESS (sent back if defect found)
              │
              ▼
          DELIVERED (terminal — job becomes read-only)
```

Transitions are enforced by the job lifecycle service and the focused
`jobs/model_modules/job_card.py` model module. Invalid transitions raise
`InvalidStatusTransition` (HTTP 400); privileged overrides remain explicit.

---

## Invoice State Machine

```
DRAFT ──► PENDING ──► PARTIAL ──► PAID
                          └──────────►──┐
                                        │ (no refunds — issue credit note)
                 CANCELLED (from any non-PAID state)
```

**GST calculation rule:**
- Same state as branch → CGST + SGST (split 50/50)
- Different state → IGST (full rate)
- Determined by comparing `branch.state_code` with `customer.state_code`

**Finalization:** Once an invoice is finalized (`is_finalized=True`), it cannot be edited. Finalized invoices cannot be hard-deleted (GST 8-year retention rule). Cancel instead.

---

## Inventory Stock Control

```
InventoryItem.deduct_stock(quantity, reason, user, job)
    │
    ├── select_for_update()  ← row-level DB lock prevents race conditions
    ├── check quantity >= requested
    ├── UPDATE quantity -= requested
    ├── CREATE InventoryAdjustment (immutable audit record)
    ├── CREATE JobPartUsage (links inventory to job)
    └── if quantity <= low_stock_threshold:
            → send low-stock alert notification (async Celery task)
```

---

## Branch Sequence Numbers

Invoice and job-card numbers are generated using a dedicated `BranchSequence` table, not the `Branch` row itself. This allows narrow row-level locking:

```sql
-- Only locks one row per (branch, kind) — not the whole Branch row
SELECT ... FROM core_branchsequence
WHERE branch_id = X AND kind = 'invoice'
FOR UPDATE;

UPDATE core_branchsequence SET last_value = last_value + 1 ...;
```

Resulting format: `{PREFIX}/{FY}/{BRANCH_CODE}/{SEQUENCE:05d}`  
Example: `INV/2425/MUM/00142`

---

## Async Notification Pipeline

```
Business event occurs (job status change, invoice finalized, etc.)
    │
    ▼
NotificationService.on_*() called synchronously
    │
    ├── Creates NotificationLog outbox row in the business transaction
    └── Publishes only after database commit
                │
                ▼ (async, in Celery worker)
        Lock and claim NotificationLog (status=SENDING)
        Call provider API (TextBee / WA Cloud / SMTP)
        Update NotificationLog status (SENT / FAILED)
        On failure: retry up to 3 times (60s delay)
        Beat scans committed-but-unpublished rows every minute
```

`CELERY_TASK_ACKS_LATE=True` + `REJECT_ON_WORKER_LOST=True` ensures tasks are re-queued if a worker crashes mid-execution.

---

## Encryption at Rest

Device passwords and BIOS passwords are stored encrypted using Fernet symmetric encryption:

```python
# core/utils.py
from cryptography.fernet import Fernet

def encrypt_data(plaintext: str) -> str:
    return Fernet(get_encryption_key()).encrypt(plaintext.encode()).decode()

def decrypt_data(ciphertext: str) -> str:
    return Fernet(get_encryption_key()).decrypt(ciphertext.encode()).decode()
```

The `ENCRYPTION_KEY` env var must be set to a valid Fernet key in production. If absent in dev, a key is derived from `SECRET_KEY` (insecure — only for local use).

Access to decrypted passwords is logged in the `AuditPasswordAccess` table with user, timestamp, and stated reason.

---

## Caching Strategy

| Key pattern | TTL | Content | Invalidated by |
|-------------|-----|---------|----------------|
| `scm:1:role_perms_{role}` | 300s | RolePermission dict | `RolePermission.save()` |
| TanStack Query (frontend) | 60s | API responses | Window focus (disabled), manual `invalidateQueries` |

Redis `IGNORE_EXCEPTIONS=True` ensures the app degrades gracefully (DB fallback) when Redis is unavailable.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Composed runtime settings | Keeps environment parsing in `settings.py` while cache, security, monitoring, and scheduling policies live in focused modules |
| `BranchSequence` not `Branch.current_number` | Avoids locking the entire Branch row on every invoice/job creation in busy branches |
| Immutable audit records | `JobStatusHistory`, `InventoryAdjustment`, `InvoiceEditHistory` raise `ValueError` on update — enforced in `save()` |
| `CELERY_TASK_ACKS_LATE` | Tasks acknowledged only after completion — prevents silent data loss if worker dies |
| `ProtectedError` → 409 | Friendly error instead of 500 when trying to delete FK-referenced records |
| DB-driven permissions | Allows permission changes without redeploy; cached in Redis for performance |
| `select_for_update()` on stock | Prevents overselling under concurrent requests; PostgreSQL row-level lock |
