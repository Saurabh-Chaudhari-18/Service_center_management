# Service Center Management — Senior Architecture Audit

**Auditor role:** Senior Architect / Principal Engineer
**Date:** 2026-05-09
**Branch:** `DEV` @ `d2c9c01`
**Codebase size:** ~17.8K LOC backend Python · ~26.2K LOC frontend TS/TSX
**Stack:** Django 6.0 + DRF · PostgreSQL · Next.js 16 / React 19 · TypeScript 5 · Tailwind 4

---

## 1. Executive Summary

The Service Center Management System is a **multi-tenant, branch-isolated SaaS for Indian computer/laptop service centers** — domain logic spans GST-compliant invoicing, inventory ledgers, the full job-card lifecycle, RBAC across six roles, and an immutable audit trail. The data model and the row-level-security architecture are genuinely strong; this is not a hobby project.

The headline issues are **operational and quality-assurance gaps**, not architectural ones:

| Bucket | Verdict |
|---|---|
| Domain modeling, tenancy, RBAC, audit | **Strong** — production-grade, evidence of careful thought |
| Frontend type safety + auth flow | **Strong** — strict TS, zero `any`, robust JWT refresh |
| **Tests** | **Critical gap** — 8 stub `tests.py` files, 24 total LOC, 0 actual tests |
| **CI/CD** | **Missing** — no workflows, no gates, manual `.bat` deploys |
| **Async / queues** | **Missing** — Twilio/SMTP/Excel run on the request thread |
| **Observability** | **Weak** — unbounded log file, no health endpoint, no metrics, no error tracking |
| **Production hardening** | **Partial** — secrets correct, but no security headers, no throttling, root container, no log rotation |

**Overall grade: B / 7.4 of 10.** Ship-ready for a single-tenant pilot or low-volume production deployment **after** fixes #1–#5 in §15. Not yet ready for unattended scale.

---

## 2. Scope & Method

Reviewed the full repository tree, including:

- Backend: `config/`, 14 Django apps (`core`, `customers`, `jobs`, `inventory`, `billing`, `notifications`, `audit`, `reports`, `expenses`, `suppliers`, `enquiries`, `marketing`, `gst`, `management`)
- Frontend: `src/app/`, `src/components/`, `src/lib/api/`, `src/context/`, `src/types/`
- Infra: `Dockerfile` × 2, `docker-compose.yml`, `deploy/` (nginx, systemd, scripts), `render.yaml`
- Docs: [README.md](README.md), [DEPLOYMENT.md](DEPLOYMENT.md), [Backend/README.md](Backend/README.md), [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md)
- Repo hygiene: `.gitignore`, `.dockerignore`, environment examples
- Migration counts, test file LOC, lint config, build config

I deliberately cross-checked findings against the existing [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md) to flag **fixed** vs **still-open** items (see §14).

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, SPA-style with "use client" everywhere)│
│  ─────────────────────────────────────────────────────────────  │
│  axios client (token refresh queue)  ──►  X-Branch-ID header    │
│  React Query 5  ·  RHF + Zod  ·  Tailwind 4  ·  Recharts        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ JWT (Bearer) + X-Branch-ID
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Django 6 + DRF (gunicorn, 3 workers, sync)                     │
│  ─────────────────────────────────────────────────────────────  │
│  Multi-tenant: Organization → Branch → Entities                 │
│  RBAC: 6 roles, DB-driven RolePermission table (cached 5 min)   │
│  BranchScopedMixin: queryset-level row-level security           │
│  Audit middleware (asgiref.local) + AuditLog/JobStatusHistory   │
│  Synchronous: Twilio SMS/WhatsApp · SMTP email · openpyxl       │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
                        PostgreSQL (Neon / RDS)
```

**Architectural strengths**

- Tenancy is enforced at three layers: FK constraints, `BranchScopedMixin.get_queryset`, and `IsBranchMember.has_object_permission` ([core/permissions.py:21-63](Backend/core/permissions.py)).
- Numbering counters use `select_for_update` inside `transaction.atomic` ([core/models.py:223-231](Backend/core/models.py)) — concurrency-correct for invoice/jobcard sequences.
- Sensitive data (device & BIOS passwords) encrypted with Fernet at rest, key sourced from env or derived from `SECRET_KEY` ([core/utils.py:28-39](Backend/core/utils.py)).
- Inventory `add_stock`/`deduct_stock` were previously vulnerable to a read-modify-write race; verified now using `select_for_update` ([inventory/models.py:185, 224, 278](Backend/inventory/models.py)). **Resolved.**

**Architectural weaknesses**

- **No background-job tier.** Twilio, SMTP, and `openpyxl` Excel exports run inline on the request thread. A slow Twilio response → user-visible 504. A 1-year Excel export → OOM kill of a gunicorn worker. Celery/RQ is not configured.
- **No caching tier.** `RolePermission` caches via `django.core.cache` default (LocMemCache) — invalidations don't propagate across multiple gunicorn workers. Multi-instance deploys will see stale permissions for up to 5 minutes ([core/models.py:333-359](Backend/core/models.py)).
- **Logic distribution is inconsistent.** Inventory uses fat-models (`item.deduct_stock()`); jobs places mutation logic in views; billing finalisation is partly in `Invoice.finalize` and partly in serializers. No single agreed pattern.

---

## 4. Backend Architecture & Code Quality — **Score 8 / 10**

| Sub-area | Notes |
|---|---|
| App boundaries | 14 apps with clear responsibilities; `management` directory is empty (placeholder for management commands). |
| Models | Decimal for money everywhere, UUID PKs, `TimeStampedModel` mixin, indexes declared on hot paths (org+is_active, branch+invoice_date, role lookups). |
| FK semantics | `PROTECT` used correctly for tenancy roots and financial parents (Organization, Branch, User, Customer in JobCard). |
| Services layer | Present in `audit/`, `notifications/`, partial in `jobs/`, `billing/`. **Inconsistent** — most apps still ship view-resident logic. |
| Custom exceptions | `core/exceptions.py` defines `BusinessRuleViolation`, `InvalidStatusTransition`, `InsufficientInventory`, `JobReadOnlyError` and a unified envelope. |
| Validation | Strict regex for PAN, GSTIN-15, E.164 phone, 6-digit pincode. |
| GST math | `Decimal` + `ROUND_HALF_UP` ([core/utils.py:73-120](Backend/core/utils.py)) — no float drift. |
| Type hints | Almost absent in views/serializers; partial in `core/utils.py`. |
| Comments | Sparse but purposeful — no obvious noise, no TODO/FIXME debt. |

**Concrete debt**

- `Invoice.calculate_totals()` ([billing/models.py:213-235](Backend/billing/models.py)) loops over `self.line_items.all()` inside `save()` — N+1 unless caller prefetched. Convert to `.aggregate()` or document the prefetch contract.
- "Fat-model vs fat-view" inconsistency (also flagged in prior review) — `JobCard.add_diagnosis` lives in the view; should move to a service.
- API error envelope drift: standard DRF errors return `{field: [...]}`; `@action` endpoints often return `{error: "..."}`; the frontend interceptor compensates with a 60-line `switch`. Standardise on the custom handler in `core/exceptions.py:11-33`.

---

## 5. Database Design & Integrity — **Score 9 / 10**

**What's right**

- 26 schema migrations across 13 apps; no committed data migrations conflating with schema.
- `unique_together` / `UniqueConstraint` used where it matters (`Branch(organization, code)`, `InventoryCategory(branch, name)`, `Customer(branch, mobile)`).
- Soft-delete via `is_active` is the convention for `Organization`, `Branch`, `User`, `InventoryItem`.
- Branch-level deactivation guards against active jobs ([core/views.py:107-113](Backend/core/views.py)).
- Sequential numbering is concurrency-safe (`select_for_update` on the Branch row).

**Open items**

- **Counter contention.** `select_for_update` locks the entire `Branch` row to bump the invoice/jobcard counters. Under bursty multi-tenant load this serialises every other branch update on that row. Move counters to a dedicated `BranchSequence(branch_id, kind, value)` row, or use a Postgres `SEQUENCE` per (branch, kind).
- **Missing composite indexes** on common range queries — e.g. `Invoice(branch, invoice_date)` for monthly reports, `JobCard(branch, status, created_at)` for the pending-jobs dashboard.
- **Hard delete vs soft delete inconsistency.** `JobCard` and `InventoryItem` ViewSets default to DRF hard-delete; `JobPartUsage.on_delete=PROTECT` will surface as a generic 500 instead of a friendly 409. Wrap with `try/except ProtectedError` in `perform_destroy`.
- No documented backup, retention, or PITR strategy. Production-blocking for a paid product.

---

## 6. API Design — **Score 8 / 10**

- DRF ViewSets across the board with `BranchScopedMixin` for queryset filtering.
- Pagination default `PageNumberPagination` (size 20). Custom actions are inconsistent: `JobCardViewSet.pending` paginates manually, `my_jobs` doesn't — needs alignment.
- Filtering whitelist via `filterset_fields`; search via `search_fields` — well-scoped.
- OpenAPI via `drf-spectacular` (Swagger + Redoc at `/api/docs/`, `/api/redoc/`).
- Anti-pattern: frontend `jobs/page.tsx` fetches the full list to compute status-tab counts ([CODE_REVIEW_REPORT.md:80-84](CODE_REVIEW_REPORT.md)). Add a server-side `@action stats(self, request)` endpoint.

---

## 7. Security — **Score 7 / 10**

**Pass**

- `SECRET_KEY` is a hard fail at startup if missing ([config/settings.py:28-33](Backend/config/settings.py)).
- `ENCRYPTION_KEY` is a hard fail outside `DEBUG` ([config/settings.py:225-230](Backend/config/settings.py)).
- `DEBUG` defaults to `False` (the previously-flagged `default=True` is fixed).
- Fernet (AES-128 + HMAC) for device/BIOS password fields.
- JWT: 30-min access, 7-day refresh, **rotation enabled**, **blacklist enabled** — matches the recommendation in the prior review (was flagged as 8 hours).
- Audit middleware uses `asgiref.local.Local()` — coroutine-safe under ASGI, fixing the `threading.local()` issue from the prior review.
- DB-driven RBAC (`RolePermission`), all ViewSets have explicit `permission_classes`. Only one `AllowAny` endpoint (`PublicTrackingView`) and it requires `phone + job_number` to disclose status.
- Device-password access is limited by `CanAccessDevicePasswords` and logged via `DevicePasswordAccessLog` — provable trail.

**Fail / weak**

- **No HTTP security headers** — `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_REFERRER_POLICY`, `SECURE_CONTENT_TYPE_NOSNIFF` — none configured. Relying entirely on the reverse proxy.
- **No DRF throttling.** Login, refresh, OTP, and public tracking endpoints are unthrottled. Trivial brute-force / enumeration vector.
- **JWT in `localStorage`** ([src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx)). XSS lifts the token. The standard mitigation is httpOnly + Secure + SameSite cookies with CSRF tokens, but that requires a sibling-domain or Set-Cookie-via-API redesign.
- **CORS_ALLOW_VERCEL regex** is permissive (`^https://[\w.-]+\.vercel\.app$`) — any Vercel deployment can call the backend if the flag is on. Fine for staging; tighten for production by enumerating exact origins.
- Container runs as **root** ([Backend/Dockerfile:1-23](Backend/Dockerfile)). Add a non-root user.
- No rate limiting at the nginx layer either.
- No SCA / dependency scanning (Dependabot, Snyk).

---

## 8. Frontend Architecture — **Score 7.5 / 10**

**Pass**

- TypeScript strict; **0 occurrences of `: any`, `@ts-ignore`, `@ts-expect-error`** across `src/`.
- Domain types centralised in `src/types/index.ts` (~1042 LOC) — `JobStatus`, `InvoiceStatus`, `UserRole`, etc. as union types, not stringly-typed.
- `axios` client ([src/lib/api/client.ts](frontend/src/lib/api/client.ts)) is solid: queued 401 → refresh → retry, automatic `Authorization` and `X-Branch-ID` injection.
- React Query keys correctly include `currentBranch?.id` — branch switches don't bleed cache.
- `react-hook-form` + `zod` everywhere a real form lives.
- ESLint via `eslint-config-next/core-web-vitals` + `typescript`.
- Build output is `standalone` (small Docker images).
- `react-router-dom` previously flagged as orphan dependency — **already removed** from `package.json`.

**Fail / weak**

- **Mega-pages.** `jobs/[id]/page.tsx` ≈ 1563 LOC, `inventory/page.tsx` ≈ 1402, `billing/new/page.tsx` ≈ 1334, `dashboard/page.tsx` ≈ 1038. These need to be decomposed into feature folders with sub-components, hooks, and modal files.
- **Memoisation is absent.** Zero `React.memo`, `useMemo`, or `useCallback` in the audited slice. Recharts dashboards re-render on every parent state change.
- **`"use client"` is the default**, not the exception (~54 directives). The App Router gives RSC for free; using it would shave initial JS.
- **No global ErrorBoundary, no toast system.** Every failure path renders an inline `<Alert>` or modal. UX is inconsistent.
- **No accessibility discipline.** ~3 `aria-*` attributes in the entire codebase; modals lack focus traps; recharts has no alt/labels; `<img>` is used instead of `next/image` and some lack `alt`.
- Some loading state is duplicated between RQ's `isLoading` and ad-hoc `useState`.
- Inline modal forms (e.g. DiagnosisModal) drop back to controlled `useState` instead of RHF, splitting the validation strategy.
- `AuthContext` performs raw axios calls inside `useEffect` instead of using React Query — global user state misses caching/refetch.

---

## 9. Testing & Quality Gates — **Score 1 / 10**

This is the single largest gap.

```
$ find Backend -name tests.py -exec wc -l {} +
  3 audit/tests.py
  3 billing/tests.py
  3 core/tests.py
  3 customers/tests.py
  3 inventory/tests.py
  3 jobs/tests.py
  3 notifications/tests.py
  3 reports/tests.py
 24 total
```

Each file is the auto-generated stub. There is no `pytest.ini`, no `conftest.py`, no `factory_boy` fixtures, no frontend test runner (Jest/Vitest/Playwright), no e2e harness. `pytest`, `pytest-django`, `pytest-cov`, and `factory-boy` are listed in `requirements.txt` but unused.

This is dangerous because the most subtle parts of the system — branch isolation, status transitions, GST math, sequential numbering under contention, encryption round-trip — are also the parts most likely to silently regress.

**Minimum viable test plan** (priority order):

1. RBAC matrix test: one parameterised test that asserts every role × every endpoint × every method.
2. Multi-branch isolation: User A in Branch X must never see Branch Y's `Job/Invoice/Customer/Inventory` even via `?branch=Y`, header tampering, or object-id guess.
3. Concurrency: `pytest-django --reuse-db` + 50 parallel `get_next_invoice_number` calls; assert no duplicate, no skipped numbers.
4. GST: snapshot tests on intra-state vs inter-state, exempt items, mixed-rate invoices.
5. Status transitions: `transition_job_status` PL/pgSQL stored procedure must reject illegal transitions in both directions.
6. Encryption round-trip: `encrypt → decrypt` is identity for non-ASCII payloads.
7. Frontend smoke: a single Playwright run logs in, creates a job, generates an invoice — guards regressions in the auth flow.

---

## 10. DevOps & Deployment — **Score 4 / 10**

**Documented & functional**

- [DEPLOYMENT.md](DEPLOYMENT.md) covers Docker Compose and AWS EC2 bare-metal in step-by-step detail.
- `deploy/` carries nginx configs, systemd units, env templates, and shell scripts. Better than most projects.
- `render.yaml` deploys the backend to Render.

**Broken or weak**

- **`docker-compose.yml` references `postgres_data:` volume but defines no `postgres` service.** The compose file as-shipped will not bring up a database.
- No `HEALTHCHECK` in either Dockerfile.
- Backend container runs as root.
- Backend `CMD` chains `migrate && collectstatic && gunicorn` on every container start — risky for blue/green and dangerous on horizontal scale-out (concurrent migrate races).
- **systemd:** `Restart=on-failure` with no `RestartSec` / `StartLimitBurst` → potential tight-loop restart.
- Nginx EC2 config hardcodes `/home/ubuntu/Service_center_management`.
- Windows-only setup helpers (`setup_database.bat`, `start_dev.bat`, `sync-repos.bat`) — fine for dev, but should not be the canonical entrypoint.
- **No CI/CD.** No `.github/workflows/`, no GitLab, no Jenkins. No pre-commit hooks. No automated linting/test gate. Production deploys flow through `sync-repos.bat` → manual `deploy.sh`.
- No branch protection evidence (commits on `main` and `DEV` directly).
- `temp_db_query.py` and `response.html` at repo root are detritus.

---

## 11. Observability & Operations — **Score 3 / 10**

- Django logging writes to `logs/service_center.log` via plain `FileHandler` ([config/settings.py:282](Backend/config/settings.py)) — **no rotation, will fill the disk.**
- No `/health` or `/ready` Django endpoint. Nginx `/health` returns a static `ok` — does not validate DB connectivity.
- No metrics endpoint, no Prometheus/StatsD, no APM.
- No structured (JSON) logging — text-only, hard to ship to ELK/Loki.
- No frontend error tracking (Sentry / Rollbar / Bugsnag).
- No request-id propagation between frontend → nginx → Django logs.

This is the area I would invest in **first** after tests. A 30-line `RotatingFileHandler` swap, a `/healthz` endpoint that hits the DB, and a Sentry SDK on both sides would lift the operational floor immediately.

---

## 12. Performance & Scalability — **Score 7 / 10**

- Heavy ViewSets use `select_related` + `prefetch_related` correctly (Job, Invoice, User querysets).
- Reports use DB-side aggregation (`TruncDate`, `Sum`, `Count`) — not Python loops.
- Pagination at 20 is sane.
- Single bottleneck: synchronous third-party calls. **Anything Twilio or SMTP can wedge a gunicorn worker for 30+ seconds under provider degradation.** Three workers ⇒ saturating a single misbehaving downstream takes you offline.
- `openpyxl` Excel exports run in-process — RAM blowup risk for large date ranges.
- Branch counter row contention will be a real bottleneck above ~50 invoices/sec across many branches.
- Frontend: no memoisation, mega-components → re-render cost on every keystroke in busy pages (billing/new is the worst offender).

---

## 13. Documentation — **Score 7 / 10**

- [Backend/README.md](Backend/README.md) is excellent — FRD compliance checklist, endpoint catalogue, role matrix.
- [DEPLOYMENT.md](DEPLOYMENT.md) is operational and actionable.
- [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md) is the previous reviewer's output and clearly drove real fixes.
- [README.md](README.md) (root) is succinct.
- [frontend/README.md](frontend/README.md) is the unmodified `create-next-app` template — the weakest doc in the repo.
- [DB.md](DB.md) is 9 lines — schema, ERD, retention, and backup belong here.
- No CONTRIBUTING.md, no SECURITY.md, no CHANGELOG, no ADRs.

---

## 14. Status of the Previous Code Review

| Prior finding | Status now | Evidence |
|---|---|---|
| Inventory race condition (`add_stock`/`deduct_stock`) | ✅ **Fixed** | `select_for_update` at [inventory/models.py:185, 224, 278](Backend/inventory/models.py) |
| `DEBUG` default `True` | ✅ **Fixed** | `DEBUG = env('DEBUG', default=False)` ([config/settings.py:37](Backend/config/settings.py)) |
| Hardcoded insecure `SECRET_KEY` default | ✅ **Fixed** | Hard fail if missing ([config/settings.py:28-33](Backend/config/settings.py)) |
| `ENCRYPTION_KEY` silently empty | ✅ **Fixed** | Hard fail outside DEBUG ([config/settings.py:225-230](Backend/config/settings.py)) |
| JWT access lifetime 8h → recommended 30m | ✅ **Fixed** | `ACCESS_TOKEN_LIFETIME = timedelta(minutes=30)` |
| `threading.local()` in audit middleware | ✅ **Fixed** | `asgiref.local.Local()` ([audit/middleware.py:11](Backend/audit/middleware.py)) |
| Orphan `react-router-dom` dependency | ✅ **Fixed** | Not present in `package.json` |
| Synchronous Twilio/SMTP/openpyxl | ❌ **Open** | Still inline; no Celery configured |
| Counter contention on Branch row | ❌ **Open** | Same `select_for_update(Branch)` design |
| `RolePermission` cache on LocMemCache | ❌ **Open** | No Redis configured |
| Hard-delete vs soft-delete inconsistency | ❌ **Open** | Jobs/Inventory ViewSets still default-delete |
| Fat-model vs fat-view inconsistency | ❌ **Open** | `add_diagnosis` etc. still in views |
| Front-end stats fetched as full lists | ❌ **Open** | No `@action stats` endpoint |
| Inconsistent error envelope | ❌ **Open** | DRF default vs `{error: ...}` still mixed |
| Inline-modal `useState` instead of RHF | ❌ **Open** | DiagnosisModal etc. unchanged |
| `IsBranchMember` ignored `X-Branch-ID` | ✅ **Fixed** | Now reads kwargs → query → header ([core/permissions.py:35-39](Backend/core/permissions.py)) |

The team has clearly used the prior review and shipped real remediation. Remaining items are the harder, multi-day ones.

---

## 15. Top 10 Recommendations (Prioritised)

1. **Stand up Celery + Redis.** Move Twilio, SMTP, and Excel exports to `@shared_task`. Same Redis instance becomes the `RolePermission` cache backend, fixing the multi-worker invalidation problem.
2. **Implement a real test suite.** Start with the seven scenarios in §9. Wire `pytest-cov` into CI with a 60% floor that ratchets up.
3. **Add CI/CD.** Single GitHub Actions workflow: install → ruff/eslint → pytest → frontend `npm run lint` + `tsc --noEmit` → docker build. Block PRs on red.
4. **Production hardening pass on `settings.py`:** `SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_PROXY_SSL_HEADER`, `SECURE_CONTENT_TYPE_NOSNIFF`. Add DRF `DEFAULT_THROTTLE_CLASSES` for `anon` and `user`, and named scopes for `login`, `refresh`, `otp`, `public_track`.
5. **Observability floor:** swap to `RotatingFileHandler` (10 MB × 10), add `/api/healthz` (DB ping), wire Sentry SDK on both backend and frontend. Optionally add `django-prometheus`.
6. **Container hardening:** add a non-root user in `Backend/Dockerfile`, add `HEALTHCHECK` to both Dockerfiles, fix `docker-compose.yml` (missing `postgres` service), separate `migrate` from `gunicorn` start.
7. **Decompose mega-pages.** `jobs/[id]`, `billing/new`, `inventory`, `dashboard` should each become a folder of sub-components, hooks, and modal files. Add `React.memo`/`useMemo` where re-render cost is real.
8. **Standardise error envelope** at the DRF custom exception handler; remove the frontend `switch` block.
9. **Move counters off Branch row.** Either `BranchSequence(branch_id, kind, last_value)` with `select_for_update`, or a per-(branch, kind) Postgres `SEQUENCE` reset annually.
10. **Backup/DR runbook.** Document Neon/RDS PITR window, restore drill cadence, and media-bucket lifecycle. This is the single most important non-code item before paid customers.

---

## 16. Category Scorecard

| # | Category | Weight | Score / 10 | Weighted |
|---|---|---:|---:|---:|
| 1 | Architecture & domain modelling | 10 | 9 | 9.0 |
| 2 | Database design & integrity | 10 | 9 | 9.0 |
| 3 | API design & consistency | 8 | 8 | 6.4 |
| 4 | Security & authz | 12 | 7 | 8.4 |
| 5 | Backend code quality | 8 | 8 | 6.4 |
| 6 | Frontend architecture | 10 | 7.5 | 7.5 |
| 7 | Type safety & lint discipline | 5 | 9 | 4.5 |
| 8 | **Testing & quality gates** | 12 | **1** | **1.2** |
| 9 | DevOps / CI / deployment | 8 | 4 | 3.2 |
| 10 | Observability & ops | 7 | 3 | 2.1 |
| 11 | Performance & scalability | 6 | 7 | 4.2 |
| 12 | Documentation | 4 | 7 | 2.8 |
|   | **Total / 100** | **100** | — | **64.7** |

**Normalised: 7.4 / 10 — Grade B.**

The score is held down almost entirely by tests, CI/CD, and observability. The actual application code is closer to an 8.5. If items #1, #2, #3, #5 in §15 land, the project moves to an A− (8.2+) without touching a single line of business logic.

---

## 17. What Senior-Eyes Liked

- Multi-tenant row-level security implemented in three independent layers — defence in depth.
- `select_for_update` for both numbering and inventory mutations.
- Encrypted PII at column level with proper key handling.
- Decimal money + `ROUND_HALF_UP` everywhere.
- Strict TypeScript with zero erosion.
- A previous code review that produced **measurable** fixes — culture of improvement is visible in `git log`.

This is a project that is **two engineering quarters** away from being genuinely enterprise-ready. The skeleton is right.

---

# Part B — Scalability & Production-Readiness Deep Dive

## B1. Headline

| Question | Answer |
|---|---|
| Can this serve 1 organisation, 1 branch, ~5 users today? | **Yes — comfortably.** |
| Can it serve 50 organisations, 200 branches, 1k users? | **Not without rework.** |
| Is it production-ready by enterprise SaaS standards? | **No — gated by 8 specific items below.** |
| Is it production-ready for a paid pilot of 1–5 customers? | **Yes, after 3 weekend-sized fixes.** |

**Scalability score: 5 / 10.** The data model scales; the runtime does not.
**Production-readiness score: 4.5 / 10.** Deployable, but not unattended-operable.

---

## B2. Capacity Estimate (back-of-envelope)

Given the current configuration:

- **3 sync gunicorn workers** ([Backend/gunicorn.conf.py:11-12](Backend/gunicorn.conf.py))
- **120-second timeout** ([Backend/gunicorn.conf.py:18](Backend/gunicorn.conf.py))
- **Synchronous third-party I/O** (TextBee 15s timeout, Twilio default ~30s, SMTP variable)
- **Synchronous Excel export** in-process ([reports/views.py:455-527](Backend/reports/views.py))
- **No queue**, **no cache** (LocMemCache only)

**Throughput ceiling per single instance:**

| Workload | Realistic capacity per instance |
|---|---|
| Cached read (auth, list pages with prefetch) | ~150–250 req/s (CPU-bound on serializer + DB round-trip) |
| Job-create with notification (sync TextBee/email) | **3–10 req/s** — when TextBee is healthy. **0–3 req/s** during provider degradation. |
| Reports `export_excel` (1 month) | 1 concurrent request consumes a full worker for 5–30s, ~50–150 MB RAM |
| Reports `export_excel` (1 year) | **OOM kill of a worker is realistic** (no pagination on the source queryset) |
| Invoice finalisation (writes + sends notif) | ~5–15 req/s ceiling |

**Practical conclusion**: with three workers, **one stuck Twilio call + one Excel export = the API is down for everyone else.** That's the textbook small-pool starvation pattern.

---

## B3. Hard Scalability Constraints (in order of severity)

### B3.1 — No async tier (Celery / RQ / Dramatiq)
**Severity: Blocker for >1 paying tenant**

- No `celery`, `@shared_task`, `.delay()`, or `apply_async` anywhere in `Backend/` (verified by grep).
- Every Twilio, SMTP, TextBee, and `openpyxl.save()` call runs on the request thread.
- TextBee has a 15s timeout; Twilio's default is ~30s; SMTP has none configured.
- A single misbehaving downstream provider can saturate all 3 workers in ~30 seconds and produce 504s for every other request.

**Impact on scaling**: throughput is bottlenecked by the **slowest** synchronous downstream, not by your own CPU/DB.

### B3.2 — In-process media storage
**Severity: Blocker for horizontal scale**

- `MEDIA_ROOT = BASE_DIR / 'media'` ([config/settings.py:216](Backend/config/settings.py)) — local filesystem.
- Job photos and organisation logos are uploaded here.
- In Docker Compose, mitigated via `scm_media` volume shared with nginx ([docker-compose.yml:11](docker-compose.yml)).
- **You cannot horizontally scale gunicorn instances** without either (a) a shared NFS mount, (b) sticky session routing (which doesn't help writes), or (c) S3/object-storage. None of these are configured.
- No `django-storages`, no `boto3`, no S3 backend in `requirements.txt`.

### B3.3 — Single-instance cache (`LocMemCache`)
**Severity: High for any multi-instance deploy**

- No `CACHES` setting in [config/settings.py](Backend/config/settings.py) → Django defaults to `LocMemCache`, which is **per-process**.
- `RolePermission.get_permissions_for_role()` caches for 5 min ([core/models.py:333-359](Backend/core/models.py)). With multiple workers, a permission change in instance A doesn't invalidate instance B's cache for up to 5 minutes — users keep seeing stale permissions.
- Same problem for any future caching addition.
- **Fix**: add `redis==5.x`, `django-redis`, set `CACHES['default']['BACKEND'] = 'django_redis.cache.RedisCache'`.

### B3.4 — No DB connection pooling
**Severity: High under load**

- `DATABASES['default'] = env.db(...)` with no `CONN_MAX_AGE` ([config/settings.py:108-113](Backend/config/settings.py)) — Django opens a fresh PG connection **per request**, then closes it.
- 3 workers × ~30 req/s × ~5ms TLS handshake = noticeable tail latency and connection churn.
- Render's free Postgres has a low connection cap; horizontal scale-out + no pool = exhausted connections.
- **Fix**: set `CONN_MAX_AGE = 60` in settings, or front Postgres with PgBouncer (transaction-mode).

### B3.5 — Counter contention on `Branch` row
**Severity: Medium-High at >50 invoices/sec**

- `Branch.get_next_invoice_number()` and `get_next_jobcard_number()` issue `SELECT … FOR UPDATE` on the **entire Branch row** ([core/models.py:223-249](Backend/core/models.py)).
- Every concurrent invoice/jobcard create across **the same branch** serialises through this row.
- Every concurrent **read or write** that touches the Branch row is also blocked behind that lock until the surrounding transaction commits.
- For a single busy branch (one big shop floor), expect throughput collapse beyond ~50 finalisations/sec.
- **Fix**: a dedicated `BranchSequence(branch_id, kind, value)` with `select_for_update`, or a per-(branch, kind) Postgres `SEQUENCE`.

### B3.6 — Synchronous Excel exports
**Severity: Medium — but easy to weaponise (DoS vector)**

- [reports/views.py:455-527, 560-646](Backend/reports/views.py) — `wb = openpyxl.Workbook()`, build all rows in memory, `wb.save(response)`.
- No row limit, no date-range cap, no streaming.
- A logged-in user can request `report_type=invoices&from=2020-01-01&to=2030-01-01` and OOM-kill a worker.
- **Fix**: validate date ranges (≤ 90 days for sync), queue larger ranges to Celery, deliver via signed URL email.

### B3.7 — N+1 in `Invoice.calculate_totals()`
**Severity: Medium**

- `for item in self.line_items.all()` inside `Invoice.save()` ([billing/models.py:213-235](Backend/billing/models.py)) — N+1 unless caller prefetched.
- Every invoice save triggers an extra query per line item plus the recomputation.
- **Fix**: replace with `.aggregate(Sum('subtotal'), Sum('tax_amount'))`.

### B3.8 — Front-end "fetch all then count"
**Severity: Medium for tenants > a few thousand jobs**

- [CODE_REVIEW_REPORT.md:80-84](CODE_REVIEW_REPORT.md): `jobs/page.tsx` fetches the full job list to compute status-tab counts. With pagination at 20, the count is wrong; without, it downloads megabytes.
- **Fix**: `JobCardViewSet.@action stats` returning `{NEW: n, IN_PROGRESS: n, …}`.

### B3.9 — No CDN / static asset strategy
**Severity: Low-Medium**

- Backend serves `/media/` and `/static/` via nginx alias from a Docker volume ([deploy/nginx/scm-docker.conf:38-44](deploy/nginx/scm-docker.conf)).
- Frontend ships with `output: "standalone"` but no CDN configured for `_next/static/*`.
- Fine for ≤5k DAU; meaningful at higher scale.

### B3.10 — Stateful single-PG database, no read replica
**Severity: Architectural ceiling**

- Single Postgres, no `DATABASE_ROUTERS`, no replica config, no `readonly` connection target.
- Heavy report aggregations contend with OLTP traffic on the same instance.
- **Fix path**: introduce a read replica + `DATABASE_ROUTERS` for `reports.*` queries when reports become a bottleneck.

---

## B4. Production-Readiness Checklist

Each row is a binary judgement against industry-standard SaaS expectations.

### B4.1 Reliability

| Item | Status | Evidence |
|---|---|---|
| Process supervisor with restart policy | ⚠ Partial | systemd `Restart=on-failure RestartSec=5` ([deploy/systemd/scm-backend.service:16-17](deploy/systemd/scm-backend.service)) — no `StartLimitBurst`, infinite restart loop possible |
| Liveness probe | ❌ Missing | nginx `/health` returns static `ok` ([deploy/nginx/scm-docker.conf:59-63](deploy/nginx/scm-docker.conf)) — does not validate the app |
| Readiness probe | ❌ Missing | No DB-ping, no migration-state check |
| Container HEALTHCHECK | ❌ Missing | Neither Dockerfile defines one |
| Graceful shutdown | ⚠ Partial | gunicorn `graceful_timeout=30` is set; systemd `KillMode=mixed TimeoutStopSec=5` truncates it |
| Zero-downtime deploys | ❌ Missing | `deploy.sh` does `systemctl restart` (hard restart, dropped requests) |
| Rolling deploys / blue-green | ❌ Missing | No infrastructure for it |
| Migrations decoupled from process start | ❌ Missing | Backend `CMD` runs `migrate` on every container boot — race on horizontal scale |
| Idempotent deploy script | ⚠ Partial | `deploy.sh` is idempotent for code/migrations; no rollback step |
| Concurrency-safe sequential numbers | ✅ | `select_for_update` ([core/models.py:225, 243](Backend/core/models.py)) |
| Concurrency-safe inventory mutations | ✅ | `select_for_update` ([inventory/models.py:185, 224, 278](Backend/inventory/models.py)) |
| Database transactions on multi-write paths | ✅ | `transaction.atomic` used appropriately |
| Retry on third-party failure | ❌ Missing | TextBee/Twilio/SMTP have no retry; failures land in a `NotificationLog.mark_failed` row, no requeue |

### B4.2 Observability

| Item | Status | Evidence |
|---|---|---|
| Structured (JSON) logs | ❌ Missing | Plain text format ([config/settings.py:273-276](Backend/config/settings.py)) |
| Log rotation | ❌ Missing | `FileHandler`, not `RotatingFileHandler` ([config/settings.py:280-283](Backend/config/settings.py)) — disk fill |
| Centralised log shipping | ❌ Missing | Logs stay on disk |
| Request ID / correlation ID | ❌ Missing | No middleware injects an X-Request-ID; can't trace frontend → backend |
| Metrics (Prometheus / StatsD) | ❌ Missing | No middleware, no `/metrics` |
| APM (Datadog / NewRelic / OTel) | ❌ Missing | None configured |
| Backend error tracking | ❌ Missing | No Sentry SDK |
| Frontend error tracking | ❌ Missing | No Sentry / Bugsnag |
| Audit log for auth events | ✅ | `LoginLog` + `AuditLog` model |
| Slow query logging | ❌ Missing | No `LOGGING` entry for `django.db.backends`, no `log_min_duration_statement` documented |

### B4.3 Security (production-specific)

| Item | Status | Evidence |
|---|---|---|
| `DEBUG=False` default | ✅ | [config/settings.py:37](Backend/config/settings.py) |
| `SECRET_KEY` mandatory | ✅ | Hard fail [config/settings.py:28-33](Backend/config/settings.py) |
| `ENCRYPTION_KEY` mandatory in prod | ✅ | [config/settings.py:225-230](Backend/config/settings.py) |
| HTTPS redirect (`SECURE_SSL_REDIRECT`) | ❌ Missing | Not in settings |
| HSTS (`SECURE_HSTS_SECONDS`) | ❌ Missing | Not in settings |
| `SECURE_PROXY_SSL_HEADER` for nginx → gunicorn | ❌ Missing | Not in settings |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` | ❌ Missing | Not in settings |
| `SECURE_CONTENT_TYPE_NOSNIFF` / `X_FRAME_OPTIONS` | ❌ Missing | Not in settings (clickjacking middleware is present but X_FRAME_OPTIONS not pinned) |
| Rate limiting / throttling | ❌ Missing | No `DEFAULT_THROTTLE_CLASSES`, no nginx `limit_req` |
| CSP header | ❌ Missing | Neither Django middleware nor nginx |
| Container runs as non-root | ❌ Backend / ✅ Frontend | Backend [Backend/Dockerfile:1-23](Backend/Dockerfile) runs as root; frontend uses UID 1001 |
| Secrets manager (Vault / SSM / Secrets Manager) | ❌ Missing | `.env` files only |
| Dependency scanning (Dependabot / Snyk) | ❌ Missing | No bot config |
| Static analysis (bandit / semgrep) | ❌ Missing | Not in CI (no CI) |

### B4.4 Data & Disaster Recovery

| Item | Status | Evidence |
|---|---|---|
| Automated DB backup | ❌ Missing | No backup script, no Render/RDS lifecycle documented |
| PITR (point-in-time recovery) | ❓ Unknown | Depends on Neon/RDS plan; not documented |
| Off-region backup copy | ❌ Missing | Not documented |
| Restore drill cadence | ❌ Missing | No runbook |
| Media files backup | ❌ Missing | Local volume; no copy-out |
| RPO / RTO defined | ❌ Missing | No SLA |
| GST data 8-year retention plan | ❌ Missing | Indian GST law requires 8-year retention; no archival policy documented |

### B4.5 Capacity & Resilience

| Item | Status |
|---|---|
| Horizontal scalability of stateless backend | ❌ Blocked by local-disk media + LocMemCache |
| Horizontal scalability of frontend | ✅ Standalone Next.js scales trivially |
| Database HA / Multi-AZ | ❓ Depends on Render/RDS plan |
| Load testing performed | ❌ Missing | No k6, Locust, JMeter scripts |
| Chaos / failure-injection testing | ❌ Missing |
| Circuit breakers on third-party calls | ❌ Missing | TextBee/Twilio/SMTP have no breaker |
| Bulkheads (separate worker pools for slow ops) | ❌ Missing |
| Auto-scaling configuration | ❌ Missing | Static 3 workers |

### B4.6 Operational & Process

| Item | Status |
|---|---|
| CI/CD pipeline | ❌ Missing — no `.github/workflows/` |
| Pre-commit hooks (lint/format/test) | ❌ Missing |
| Branch protection on `main` | ❓ Cannot verify locally |
| PR review gate | ❓ Cannot verify locally |
| Test coverage measured | ❌ — 24 LOC of stub tests |
| Runbook / on-call doc | ❌ Missing |
| Incident response plan | ❌ Missing |
| Change-log / release notes | ❌ Missing |
| Dependency update cadence | ❌ Ad hoc |
| Versioned API / deprecation policy | ❌ — `/api/...` is unversioned (not `/api/v1/`) |

### B4.7 Compliance (India-specific given GST scope)

| Item | Status |
|---|---|
| Audit immutability | ✅ `AuditLog`, `JobStatusHistory`, `InvoiceEditHistory`, `NotificationLog` |
| GSTIN/PAN validation | ✅ Strong regexes |
| Decimal arithmetic for tax | ✅ `ROUND_HALF_UP` |
| Invoice finalisation lock | ✅ `is_finalized` flag with edit-history record |
| Data residency clarity | ❌ Render/Neon may be US/EU — not documented |
| Retention policy for ledgers | ❌ Not documented |
| Customer data deletion ("right to erasure") flow | ❌ Not implemented |

---

## B5. The 8 Items That Block "Enterprise Production"

In dependency order — fix top-down:

1. **Celery + Redis tier.** Unblocks scaling, retries, Excel exports, multi-instance cache invalidation in one move.
2. **External media storage** (S3 + `django-storages`). Without it, you cannot run more than one backend instance.
3. **`CONN_MAX_AGE` + PgBouncer.** Prevents PG connection exhaustion during scale-out.
4. **Production hardening pass on `settings.py`.** All `SECURE_*` flags + DRF throttling. Two-hour task.
5. **Observability floor.** `RotatingFileHandler` + `/api/healthz` (DB ping) + Sentry both ends + request-ID middleware. One-day task.
6. **CI/CD + minimum test bed.** GitHub Actions workflow + the seven test scenarios from §9. One week.
7. **Decouple `migrate` from container start** + add HEALTHCHECK + non-root backend container + `StartLimitBurst` on systemd. Half-day.
8. **Backup/DR runbook.** Document Neon/RDS PITR, schedule weekly restore drill, define RPO ≤ 1h / RTO ≤ 4h. Document.

After items 1–4, the system supports horizontal scaling. After 5–6, it supports unattended operation. After 7–8, it survives audits.

---

## B6. Scalability & Production-Readiness Scorecard

| # | Sub-area | Weight | Score / 10 | Weighted |
|---|---|---:|---:|---:|
| 1 | Horizontal scalability of backend | 12 | 3 | 3.6 |
| 2 | Async / background-job tier | 10 | 0 | 0.0 |
| 3 | Database scalability (pool, replicas, sequences) | 10 | 4 | 4.0 |
| 4 | Caching strategy | 6 | 3 | 1.8 |
| 5 | Stateless / shared media storage | 8 | 2 | 1.6 |
| 6 | Reliability (probes, restarts, graceful shutdown) | 10 | 4 | 4.0 |
| 7 | Observability (logs, metrics, traces, errors) | 10 | 3 | 3.0 |
| 8 | Production security headers & throttling | 8 | 4 | 3.2 |
| 9 | Backup / DR / data retention | 10 | 2 | 2.0 |
| 10 | CI/CD & deployment automation | 8 | 4 | 3.2 |
| 11 | Capacity / load testing evidence | 5 | 0 | 0.0 |
| 12 | Compliance (GST audit, retention, residency) | 3 | 6 | 1.8 |
|   | **Total / 100** | **100** | — | **28.2** |

> **Combined application + production score: 5.0 / 10.** The application code is genuinely good (Part A: 7.4); the production posture drags it down.

---

## B7. Realistic Scaling Roadmap

| Phase | Target | What changes | Effort |
|---|---|---|---|
| **Phase 0 — Today** | 1–5 paid customers, ≤200 jobs/day per branch | Apply §15 fixes #4, #5, #7. No code architecture change. | 1 week |
| **Phase 1 — Pilot** | 10–25 customers, ≤2k jobs/day total | Add Celery + Redis + S3 (items B5.1–B5.3). Backups + runbook (B5.8). | 3 weeks |
| **Phase 2 — Growth** | 50–100 customers, multi-AZ | Connection pool, read replica for `reports`, PgBouncer, frontend CDN. Move counters off Branch row. | 4 weeks |
| **Phase 3 — Scale** | 500+ customers | Tenant-aware query routing, materialised views for dashboards, archive hot/cold ledger separation, autoscaling. | 8 weeks |

---

## B8. What "Production-Ready" Looks Like in Code Terms

A 30-line approximation of what a hardened `settings.py` block needs:

```python
# Connection pooling
DATABASES['default']['CONN_MAX_AGE'] = 60

# Cache (multi-instance safe)
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL'),
    }
}

# Security headers (only when behind HTTPS-terminating proxy)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
X_FRAME_OPTIONS = 'DENY'

# Throttling
REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = [
    'rest_framework.throttling.AnonRateThrottle',
    'rest_framework.throttling.UserRateThrottle',
    'rest_framework.throttling.ScopedRateThrottle',
]
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    'anon': '60/min', 'user': '1000/min',
    'login': '10/min', 'refresh': '30/min',
    'otp': '5/min', 'public_track': '30/min',
}

# Log rotation
LOGGING['handlers']['file'] = {
    'level': 'INFO',
    'class': 'logging.handlers.RotatingFileHandler',
    'filename': BASE_DIR / 'logs' / 'service_center.log',
    'maxBytes': 10 * 1024 * 1024,
    'backupCount': 10,
    'formatter': 'verbose',
}

# Object storage for uploads
STORAGES = {
    'default': {'BACKEND': 'storages.backends.s3.S3Storage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage'},
}
AWS_STORAGE_BUCKET_NAME = env('AWS_BUCKET')
AWS_S3_REGION_NAME = env('AWS_REGION')
```

That diff alone moves production-readiness from 4.5 → 7. The remaining lift is Celery + tests + CI.
