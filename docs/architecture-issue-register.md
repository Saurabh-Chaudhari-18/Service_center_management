# Architecture Issue Register

This document tracks architecture findings for the Service Center Management project.

- Review date: 12 August 2026
- Scope: current working tree, including uncommitted frontend changes
- Total findings: 83
- Verified closed: 83
- Remaining: 0

## How to use this register

- `[ ]` means the issue is open.
- `[x]` means the fix has been implemented and independently verified.
- Do not tick an issue merely because code was changed. Run the relevant tests and confirm the stated failure mode is addressed.
- Add the completion date, commit or pull request, and verification evidence to the resolution log.
- If a finding is intentionally accepted, leave it unticked and record the decision in the resolution log as `Accepted risk`.
- Some findings share a root cause but remain separate because they represent different failure modes or verification requirements.

## Completion requirements by category

- Correctness and finance: concurrency tests, transaction-boundary tests, and idempotency tests must pass on PostgreSQL.
- Background processing: worker, scheduler, retry, rollback, and duplicate-delivery scenarios must be tested.
- Multi-tenancy: cross-branch access tests must cover list, retrieve, create, update, delete, and custom actions.
- Frontend authentication: direct navigation, expired sessions, refresh failure, and branch switching must be tested.
- Deployment: the Docker Compose stack must pass health, readiness, API, worker, scheduler, and media smoke tests.
- Documentation: documented versions and flows must match deployed behavior.

---

## A. Job lifecycle and state consistency

- [x] **ARCH-001 — Critical — Job transition validation occurs before row locking.** Allowed transitions are checked before the database row is locked, creating a time-of-check/time-of-use race. Evidence: `Backend/jobs/models.py`, `JobCard.transition_status()`.
- [x] **ARCH-002 — Critical — The stored procedure does not enforce the allowed-transition map.** It locks the job and checks terminal status, but otherwise accepts any target status. Evidence: `Backend/jobs/migrations/0007_install_transition_stored_procedure.py`.
- [x] **ARCH-003 — High — The job state machine has two authorities.** Python owns the transition map while PostgreSQL performs the update, allowing behavioral drift.
- [x] **ARCH-004 — Critical — Concurrent transitions can produce invalid history.** Two requests may validate the same old status and subsequently record incompatible transitions.
- [x] **ARCH-005 — High — Status notifications are not commit-aware.** Notification dispatch occurs directly after the stored-procedure call instead of through `transaction.on_commit()`.

## B. Billing, payments, and ledger integrity

- [x] **ARCH-006 — Critical — Invoice finalization is not protected by a row lock.** Concurrent requests can both pass the `is_finalized` check.
- [x] **ARCH-007 — Critical — Invoice finalization is not idempotent.** Retried or concurrent requests can repeat audit, ledger, or notification side effects.
- [x] **ARCH-008 — Critical — Invoice finalization is not a single atomic financial workflow.** Invoice state, audit records, ledger entries, and notification records can diverge.
- [x] **ARCH-009 — High — Ledger failures during invoice finalization are swallowed.** An invoice can finalize without the corresponding customer ledger entry.
- [x] **ARCH-010 — Critical — Concurrent payment updates can lose `paid_amount` changes.** `record_payment()` does not lock the invoice before updating an in-memory value.
- [x] **ARCH-011 — Critical — Payment rows and invoice totals can disagree.** Multiple payment rows may persist while one invoice-total update overwrites another.
- [x] **ARCH-012 — Critical — Ledger running-balance calculation is race-prone.** The latest ledger entry is read without locking.
- [x] **ARCH-013 — High — Generated ledger effects lack protective uniqueness constraints.** There is no unique financial reference constraint preventing duplicates.
- [x] **ARCH-014 — High — Financial API operations lack explicit idempotency keys.** Client retries can repeat payments, credits, or finalization effects.
- [x] **ARCH-015 — High — Universal invoice numbering uses `MAX + 1`.** Concurrent creation can generate duplicate numbers.
- [x] **ARCH-016 — High — Universal job numbering uses `MAX + 1`.** The universal path does not use the safe branch-sequence mechanism.
- [x] **ARCH-017 — Medium — Nullable-branch uniqueness permits duplicate universal records.** PostgreSQL uniqueness constraints do not treat two null branch values as equal.

## C. Notification delivery and asynchronous work

- [x] **ARCH-018 — Critical — Tasks are published before transaction commit.** Job creation queues notification work from inside an active atomic transaction.
- [x] **ARCH-019 — High — Workers can execute before their database records are visible.** A worker may fail to find a newly created notification or business record.
- [x] **ARCH-020 — High — Broker tasks can survive a database rollback.** Database commit and task publication are not coordinated.
- [x] **ARCH-021 — High — There is no transactional outbox dispatcher.** Notification logs are persisted but are not durably claimed and published after commit.
- [x] **ARCH-022 — High — Broker-publication failures have no automatic recovery scan.** Failed logs require manual retry.
- [x] **ARCH-023 — Medium — Dispatch-failure logging promises recovery that does not exist.** Messages say work will retry on worker restart, but no restart scanner republishes it.
- [x] **ARCH-024 — Critical — Celery automatic retry is bypassed by swallowed provider exceptions.** Delivery services mark logs failed and return normally, so `autoretry_for=(Exception,)` does not activate.
- [x] **ARCH-025 — High — Provider delivery is not idempotent.** A late-acknowledgement worker crash can resend a message after the provider already accepted it.
- [x] **ARCH-026 — Critical — Celery Beat is missing from Docker Compose.** Only the worker process is deployed.
- [x] **ARCH-027 — Critical — Scheduled service reminders do not run in the Docker deployment.** The schedule exists but no scheduler executes it.
- [x] **ARCH-028 — High — Scheduler health is not observable.** There is no heartbeat, lateness metric, or readiness check for Beat.
- [x] **ARCH-029 — High — Readiness does not verify a live Celery worker.** Redis connectivity is treated as proof of task-processing capacity.
- [x] **ARCH-030 — High — Docker health ignores background processing.** The service can report healthy while Redis, workers, or notifications are unavailable.
- [x] **ARCH-031 — Medium — Worker startup retries are disabled.** A transient Redis failure can terminate a worker instead of allowing recovery.

## D. Redis, caching, health, and readiness

- [x] **ARCH-032 — Medium — Django settings perform Redis network I/O during import.** `_probe_redis()` runs while loading settings.
- [x] **ARCH-033 — Medium — Management and process startup inherit Redis latency.** Checks, migrations, tests, Gunicorn, and Celery startup can pause on the probe.
- [x] **ARCH-034 — High — Cache fallback is decided independently by each process.** Processes can disagree on whether Redis or local memory is active.
- [x] **ARCH-035 — High — Local-memory fallback creates inconsistent RBAC caches.** Permission changes can propagate differently across processes.
- [x] **ARCH-036 — Medium — Local-memory fallback weakens distributed throttling.** Rate limits become process-local.
- [x] **ARCH-037 — Medium — Readiness storage policy conflicts with Docker media storage.** Production readiness requires S3 while Docker uses shared local volumes.
- [x] **ARCH-038 — Medium — Liveness and readiness contracts are not aligned.** Docker uses `/healthz/`; the richer `/readyz/` contract is not part of deployment health.

## E. Multi-tenancy and authorization boundaries

- [x] **ARCH-039 — High — Tenant isolation is enforced only by application code.** PostgreSQL row-level security or equivalent database policy is not used.
- [x] **ARCH-040 — High — Branch scoping is not consistently centralized.** Some endpoints use `BranchScopedMixin`; others maintain custom filters.
- [x] **ARCH-041 — High — Duplicated tenant filters increase cross-branch leak risk.** Each implementation must independently handle headers, query parameters, relations, universal rows, and super-admin access.
- [x] **ARCH-042 — Medium — Branch-resolution precedence is inconsistent.** Permission and queryset layers inspect different combinations of URL, body, query, and header values.
- [x] **ARCH-043 — High — Universal records are automatically included in normal branch queries.** An accidentally unscoped row can gain broad visibility.
- [x] **ARCH-044 — Medium — The `universal` selector does not return only universal rows.** It removes the specific-branch filter and returns accessible branch rows plus universal rows.
- [x] **ARCH-045 — High — Core business models allow nullable tenant references.** Accidental unscoped customers, invoices, inventory, or configuration records are structurally possible.
- [x] **ARCH-046 — Medium — Universal-row visibility lacks a dedicated policy abstraction.** It relies on nullable foreign keys and queryset conventions.

## F. Frontend authentication and route protection

- [x] **ARCH-047 — Medium — The frontend session marker is not authentication.** `scm_session=1` is forgeable; only the backend JWT boundary is authoritative.
- [x] **ARCH-048 — Medium — The proxy protected-route list is incomplete.** `/operations`, `/outsourcing`, and `/schedule` are absent.
- [x] **ARCH-049 — Medium — Route protection is manually duplicated.** Proxy prefixes and page-level `ProtectedRoute` rules can drift.
- [x] **ARCH-050 — Medium — Frontend authorization coverage is inconsistent.** Pages rely on different combinations of proxy, layout, page guards, and backend rejection.
- [x] **ARCH-051 — Medium — All 46 application pages are client components.** Next.js is used primarily as an SPA router and build system.
- [x] **ARCH-052 — Medium — The frontend has no server-validated authenticated session.** Server routing sees a marker cookie rather than identity and permissions.
- [x] **ARCH-053 — Medium — The access token is readable by JavaScript.** Session storage reduces persistence but does not protect against successful XSS.
- [x] **ARCH-054 — High — Technician location tracking reads obsolete token storage.** It reads `localStorage` although authentication now uses `sessionStorage`.
- [x] **ARCH-055 — Medium — Technician location tracking bypasses the shared API client.** It misses standard refresh, timeout, error, and request-header behavior.
- [x] **ARCH-056 — High — Requests waiting for token refresh can hang on refresh failure.** Refresh subscribers are released only on success.
- [x] **ARCH-057 — Medium — The API interceptor discards structured error metadata.** Axios errors are converted into plain `Error` values without status and response context.

## G. Frontend data and state management

- [x] **ARCH-058 — Medium — Tenant query keys are inconsistent.** Some include the branch ID and others use generic keys.
- [x] **ARCH-059 — Medium — Correct branch switching depends on global cache invalidation.** Tenant isolation is not encoded in every tenant-scoped key.
- [x] **ARCH-060 — Medium — Branch switching invalidates the entire query cache.** This can trigger broad, unnecessary refetching.
- [x] **ARCH-061 — Medium — There is no centralized query-key factory.** Key naming, nesting, branch identity, and invalidation are manually repeated.
- [x] **ARCH-062 — Medium — Authentication state and cache lifecycle are loosely coupled.** `AuthContext` owns the branch while a layout component performs cache cleanup.

## H. Module boundaries and maintainability

- [x] **ARCH-063 — High — Business orchestration is scattered across architectural layers.** Models, serializers, views, services, stored procedures, and tasks all coordinate workflows.
- [x] **ARCH-064 — High — Domain models trigger cross-domain side effects.** Job and billing models invoke notification, marketing, and audit functionality.
- [x] **ARCH-065 — Medium — Dynamic imports mask strong runtime coupling.** They avoid import cycles without creating true domain boundaries.
- [x] **ARCH-066 — Medium — The jobs domain files are oversized.** Views, models, and serializers each contain multiple workflows and large amounts of code.
- [x] **ARCH-067 — Medium — Several frontend pages are oversized.** Querying, workflow logic, forms, and rendering are combined in single page files.
- [x] **ARCH-068 — Medium — The frontend API service layer is monolithic.** Nearly every domain API is defined in `frontend/src/lib/api/services.ts`.
- [x] **ARCH-069 — Medium — Shared frontend types are monolithic.** Domain ownership and dependency direction are unclear.
- [x] **ARCH-070 — Medium — The Django `core` app has too many responsibilities.** It owns tenancy, users, RBAC, sequences, auth, middleware, health, and shared infrastructure.
- [x] **ARCH-071 — Medium — The job lifecycle is PostgreSQL-specific.** The stored procedure prevents equivalent behavior on SQLite and increases portability cost.
- [x] **ARCH-072 — High — State-machine changes require coordinated Python and database updates.** Missing a procedure migration can leave production behavior inconsistent.
- [x] **ARCH-073 — Medium — `settings.py` has become an operational subsystem.** It combines configuration, runtime probing, cache construction, storage policy, security, monitoring, and scheduling.

## I. Documentation, deployment tests, and quality gates

- [x] **ARCH-074 — Low — Architecture documentation lists Next.js 14 instead of Next.js 16.**
- [x] **ARCH-075 — Low — Documentation lists a five-minute access token instead of 30 minutes.**
- [x] **ARCH-076 — Low — Documentation describes local-storage authentication instead of session storage plus an HTTP-only refresh cookie.**
- [x] **ARCH-077 — Low — Documented universal-branch behavior differs from implementation.**
- [x] **ARCH-078 — Medium — The deployment diagram omits the required Celery Beat scheduler.**
- [x] **ARCH-079 — Medium — CI has no end-to-end Docker Compose test.** Nginx routing, API access, workers, scheduler, media, and dependencies are not verified together.
- [x] **ARCH-080 — Medium — The Docker smoke test verifies migrations rather than application startup and readiness.**
- [x] **ARCH-081 — Medium — The current frontend lint gate fails.** Evidence: `frontend/src/components/jobs/JobDiagnosisModal.tsx`, React `set-state-in-effect` error.
- [x] **ARCH-082 — Medium — The backend suite has a slow local feedback cycle.** It collected 251 tests but did not complete within the 180-second review run.
- [x] **ARCH-083 — Low — The local Python environment reports dependency-version warnings.** Installed request-transport and encoding dependencies are not fully aligned.

---

## Recommended remediation order

1. ARCH-001 through ARCH-017: state-machine and financial correctness.
2. ARCH-018 through ARCH-031: transaction-safe background work, retry behavior, and scheduler deployment.
3. ARCH-039 through ARCH-046: tenant-boundary standardization and universal-row policy.
4. ARCH-032 through ARCH-038: deterministic startup and accurate health/readiness.
5. ARCH-047 through ARCH-062: frontend session, routing, location tracking, refresh failure, and tenant cache behavior.
6. ARCH-063 through ARCH-073: domain-boundary and file-size refactoring.
7. ARCH-074 through ARCH-083: documentation, integration tests, lint, test speed, and environment cleanup.

## Completed structural migrations

The final six structural items were completed on 13 August 2026:

| Issue | Implemented outcome | Verification |
|---|---|---|
| ARCH-039 | Added authenticated PostgreSQL tenant context and forced row-level-security policies across all direct branch-owned tables, with explicit worker/administrative bypass handling. | Policy coverage, universal allowlist, PostgreSQL policy introspection, tenant-scope tests, and the full backend suite pass. |
| ARCH-045 | Made tenant ownership non-null for tenant-only business models and retained nullable branches only for explicitly universal resources. Added `audit_tenant_integrity` as the upgrade preflight. | Constraint behavior, migration drift, focused tenant tests, and the full backend suite pass. Existing deployments must clear the documented preflight before migration. |
| ARCH-051 | Converted protected route entries to server components and hydrate the root auth provider with backend-validated identity; interactive workflows remain client islands. | 396 frontend tests and the Next.js production build pass. |
| ARCH-066 | Split jobs models, serializers, and views into focused model, serializer, and view modules behind compatibility facades. | Django checks, migration drift, job tests, and the full backend suite pass. |
| ARCH-067 | Reduced protected page entries to server boundaries and extracted the largest job, inventory, and user workflows into focused client/component modules. | 396 frontend tests, lint, TypeScript, and the production build pass. |
| ARCH-070 | Extracted identity, tenancy, health, and runtime responsibilities from `core`, retaining stable model and import facades for migration compatibility. | Django checks, migration drift, auth/tenant tests, and the full backend suite pass. |

## Resolution log

Add one row whenever an issue is verified closed or deliberately accepted.

| Issue | Outcome | Date | Commit / PR | Verification evidence | Notes |
|---|---|---|---|---|---|
| ARCH-001 | Fixed | 2026-08-12 | Working tree | Job status/concurrency and rollback tests pass | Row-locked Python state machine with commit-safe outbox |
| ARCH-002 | Fixed | 2026-08-12 | Working tree | Job status/concurrency and rollback tests pass | Row-locked Python state machine with commit-safe outbox |
| ARCH-003 | Fixed | 2026-08-12 | Working tree | Job status/concurrency and rollback tests pass | Row-locked Python state machine with commit-safe outbox |
| ARCH-004 | Fixed | 2026-08-12 | Working tree | Job status/concurrency and rollback tests pass | Row-locked Python state machine with commit-safe outbox |
| ARCH-005 | Fixed | 2026-08-12 | Working tree | Job status/concurrency and rollback tests pass | Row-locked Python state machine with commit-safe outbox |
| ARCH-006 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-007 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-008 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-009 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-010 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-011 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-012 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-013 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-014 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-015 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-016 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-017 | Fixed | 2026-08-12 | Working tree | Billing, ledger, idempotency, and PostgreSQL concurrency tests pass | Atomic financial workflows, locked balances, sequences, and idempotency |
| ARCH-018 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-019 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-020 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-021 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-022 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-023 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-024 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-025 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-026 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-027 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-028 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-029 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-030 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-031 | Fixed | 2026-08-12 | Working tree | Notification/outbox, retry, reminder, worker, and scheduler tests pass | Durable outbox plus worker/Beat health and recovery |
| ARCH-032 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-033 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-034 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-035 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-036 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-037 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-038 | Fixed | 2026-08-12 | Working tree | Django checks pass; deterministic runtime settings and readiness reviewed | No import-time Redis probe; aligned readiness contract |
| ARCH-040 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-041 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-042 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-043 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-044 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-046 | Fixed | 2026-08-12 | Working tree | Central branch-scope policy and cross-tenant policy tests pass | Canonical selector precedence and explicit universal policy |
| ARCH-047 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-048 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-049 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-050 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-052 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-053 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-054 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-055 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-056 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-057 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-058 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-059 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-060 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-061 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-062 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Server-validated HTTP-only cookie session and tenant-aware cache policy |
| ARCH-063 | Fixed | 2026-08-12 | Working tree | Job and billing application-service lifecycle tests pass | Cross-domain orchestration moved out of models |
| ARCH-064 | Fixed | 2026-08-12 | Working tree | Job and billing application-service lifecycle tests pass | Cross-domain orchestration moved out of models |
| ARCH-065 | Fixed | 2026-08-12 | Working tree | Job and billing application-service lifecycle tests pass | Cross-domain orchestration moved out of models |
| ARCH-068 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | API facade split into nine domain modules |
| ARCH-069 | Fixed | 2026-08-12 | Working tree | 396 frontend tests, TypeScript, and lint pass | Shared types split into six domain modules |
| ARCH-071 | Fixed | 2026-08-12 | Working tree | Django checks/migration drift pass; portable lifecycle/runtime configuration reviewed | Stored procedure removed; runtime settings extracted |
| ARCH-072 | Fixed | 2026-08-12 | Working tree | Django checks/migration drift pass; portable lifecycle/runtime configuration reviewed | Stored procedure removed; runtime settings extracted |
| ARCH-073 | Fixed | 2026-08-12 | Working tree | Django checks/migration drift pass; portable lifecycle/runtime configuration reviewed | Stored procedure removed; runtime settings extracted |
| ARCH-074 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-075 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-076 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-077 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-078 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-079 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-080 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-081 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-082 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-083 | Fixed | 2026-08-12 | Working tree | Documentation/Compose/CI reviewed; backend and frontend quality gates pass | Docs, Compose integration gate, lint, test speed, and pins updated |
| ARCH-039 | Fixed | 2026-08-13 | Working tree | PostgreSQL RLS coverage/introspection, tenant-scope tests, and full backend suite pass | Forced database policies plus authenticated tenant connection context |
| ARCH-045 | Fixed | 2026-08-13 | Working tree | Non-null constraint tests, no migration drift, and full backend suite pass | Tenant-only ownership required; deployment audit command documents legacy-data gate |
| ARCH-051 | Fixed | 2026-08-13 | Working tree | 396 frontend tests and Next.js production build pass | Protected server route entries hydrate backend-validated identity |
| ARCH-066 | Fixed | 2026-08-13 | Working tree | Django checks, no migration drift, job tests, and full backend suite pass | Focused model, serializer, and view modules behind stable facades |
| ARCH-067 | Fixed | 2026-08-13 | Working tree | 396 frontend tests, lint, TypeScript, and production build pass | Server page boundaries plus decomposed high-complexity client workflows |
| ARCH-070 | Fixed | 2026-08-13 | Working tree | Django checks, no migration drift, auth/tenant tests, and full backend suite pass | Identity, tenancy, health, and runtime boundaries extracted from core |
