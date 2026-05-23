# ServiceHub — Product UX Constitution

**Status:** Active architecture (governance)  
**Audience:** Product, design, engineering  
**Scope:** Entire `frontend/` application

This document defines **non-negotiable principles** that all screens, refactors, and new features must satisfy. Detailed rules live in linked documents:

| Topic | Document |
|--------|----------|
| Modals, pages, density, navigation contracts | [INTERACTION_RULES.md](./INTERACTION_RULES.md) |
| Page templates and allowed building blocks | [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md) |
| Create / read / update / delete / status | [CRUD_STANDARDS.md](./CRUD_STANDARDS.md) |
| Spacing, width, header, toolbar | [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) |
| Color, type, motion, components | [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) |
| Registers, queues, finance, command palette | [OPERATIONAL_PATTERNS.md](./OPERATIONAL_PATTERNS.md) |
| Migration sequencing | [REFACTOR_STRATEGY.md](./REFACTOR_STRATEGY.md) |

---

## 1. Mission

Deliver a **single coherent operational platform**: predictable layouts, predictable CRUD, predictable places for primary actions, and **one visual/interaction system** (no parallel “sub-products” without explicit temporary exceptions).

---

## 2. Principles

1. **Predictability over novelty** — Users build muscle memory; pattern variance is a defect unless role- or breakpoint-driven and documented.
2. **Stable URLs for operational records** — Anything staff discuss by phone or WhatsApp (job, invoice, customer, pickup, purchase, payment context) must be **linkable and refreshable** ([CRUD_STANDARDS.md](./CRUD_STANDARDS.md)).
3. **One design system spine** — Shared primitives and composites from `@/components/ui` and future `components/shell/*`; **no bespoke primary buttons**, overlays, or register toolbars except during explicit migration ([DESIGN_TOKENS.md](./DESIGN_TOKENS.md)).
4. **Operational density by default** — High-volume flows use **registers (tables)** on desktop; **cards** are for constrained viewports or genuinely workflow-tile UIs, not an aesthetic preference ([INTERACTION_RULES.md](./INTERACTION_RULES.md)).
5. **Preserve business behavior** — UX refactors **do not** change API contracts or domain rules without a product decision; they **unify presentation and flow**.

---

## 3. Current codebase findings (inventory)

*Inventory updated after Phase 0–7 migrations. Remaining deviations are noted.*

### 3.1 Global shell

- **`AppLayout` + `Sidebar` + `Header`** (`frontend/src/components/layout/Layout.tsx`): primary chrome, role/permission-based nav, branch switch, command palette entry, theme toggle.
- **Mobile:** sidebar as overlay drawer. ✅ **GST inner sidebar removed** — `gst/layout.tsx` now uses horizontal tab strip inside `PageShell` (migrated).

### 3.2 List patterns (by route)

| Pattern | Examples (app routes) |
|--------|-------------------------|
| **Responsive hybrid (table lg+ / cards mobile)** | `jobs/page.tsx`, `customers/page.tsx`, `pickups/page.tsx`, `my-jobs/page.tsx` |
| **Data table** | `billing/page.tsx`, `inventory/page.tsx`, `expenses/page.tsx`, GST registers (`gst/*.tsx`) |
| **Card grid** | `suppliers/page.tsx`, `users/page.tsx` |
| **Custom / div lists** | `ledger/page.tsx`, `payments/page.tsx`, `enquiries/page.tsx` |

### 3.3 Detail patterns

- **Route-based detail:** `jobs/[id]`, `billing/[id]`, `pickups/[id]`, `purchases/[id]`, `customers/[id]`, `track/[job_number]`. ✅ **`customers/[id]` route added** (stable URL; previously modal-only).
- All detail pages use `RecordLayout` (A2 archetype) or equivalent shell composite.

### 3.4 CRUD surfaces

- **Full-page create/edit:** `jobs/new`, `jobs/[id]/edit`, `billing/new`, `billing/[id]/edit`, `customers/new`, `pickups/new`, `purchases/new`, etc.
- **Shared `Modal` from UI kit:** users, branches, organizations, customers (add), inventory, suppliers, parts of billing, job-related modals (`components/jobs/*`), command palette fast-create modals. ✅ **`suppliers/page.tsx` migrated** from custom overlay to shared `Modal`.
- **`ConfirmDialog` for destructive actions:** suppliers, expenses, customers (delete), users (deactivate), purchases. ✅ All destructive actions now use shared `ConfirmDialog`.

### 3.5 Data fetching

- **React Query (`useQuery` / `useMutation`):** all primary pages — `dashboard`, `jobs`, `billing`, `customers`, `pickups`, `inventory`, `suppliers`, `expenses`, `receipts`, settings, GST, users, branches. ✅ `expenses/page.tsx` and `receipts/page.tsx` migrated from manual `useEffect`.
- **Manual `useEffect` + `useState`:** `payments/page.tsx`, `enquiries/page.tsx` — remaining candidates for Phase 2 migration.

### 3.6 Status systems

- **Central config:** `JOB_STATUS_CONFIG`, `INVOICE_STATUS_CONFIG`, `PICKUP_STATUS_CONFIG`, `ENQUIRY_STATUS_CONFIG` in `@/types` with corresponding `*StatusBadge` components.
- **Role badges:** `users/page.tsx` — `RoleBadge` now uses shared `Badge` component with `ROLE_COLORS` config. ✅ Migrated.
- **Remaining ad hoc pills:** minor instances in `purchases/page.tsx` — scheduled for Phase 2.

### 3.7 Design-system bypasses

- **Input / Select components:** all primary forms now use shared `Input` / `Select` from `@/components/ui`. ✅ GST HSN form, expense filters, receipt forms migrated.
- **Remaining raw inputs:** inline forms in `payments/page.tsx`, `enquiries/page.tsx`.

---

## 4. Enforcement

1. **PR review:** UX-related PRs MUST cite archetype + rules (e.g. “Register Page per PAGE_ARCHETYPES.md”).
2. **Exceptions:** Allowed only with **Exception** subsection in PR description + link to refactor phase that removes it.
3. **No new parallel systems:** No new modal implementations, inner sidebars, or register toolbars outside shared composites once introduced ([REFACTOR_STRATEGY.md](./REFACTOR_STRATEGY.md)).

---

## 5. Versioning

- Bump **“Constitution amendments”** in PR when principles change.
- Bump **inventory** when a module completes migration out of legacy patterns.

---

## 6. Related engineering paths

- UI primitives: `frontend/src/components/ui/index.tsx`
- Global styles / tokens source: `frontend/src/app/globals.css`
- Navigation config: `frontend/src/components/layout/Layout.tsx`
