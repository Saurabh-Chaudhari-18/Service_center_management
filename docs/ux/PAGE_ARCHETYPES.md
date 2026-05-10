# Page Archetypes

**Companion:** [INTERACTION_RULES.md](./INTERACTION_RULES.md) · [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md)

Archetypes define **layout structure**, **allowed components**, and **interaction contracts**. Every app route should map to **exactly one** primary archetype (secondary patterns, e.g. embedded wizard step, are explicit).

---

## Archetype index

| ID | Name | Typical routes (current / target) |
|----|------|-------------------------------------|
| A1 | **Register / list** | `billing`, `inventory`, `expenses`, GST tables, *target:* `customers`, `purchases`, `jobs` (desktop) |
| A2 | **Record detail** | `jobs/[id]`, `billing/[id]`, `pickups/[id]`, `purchases/[id]` |
| A3 | **Workflow queue** | `jobs`, `pickups`, `my-jobs`, `enquiries` |
| A4 | **Dashboard** | `dashboard`, `gst` (summary) |
| A5 | **Configuration** | `users`, `branches`, `organizations`, `settings`, `gst/hsn` |
| A6 | **Analytics / finance** | `reports`, GST reports, ledger summaries |
| A7 | **Wizard / multi-step** | `billing/new`, `billing/[id]/edit`, `jobs/new` |
| A8 | **Auth / public** | `login`, `track/[job_number]` |
| M1 | **Modal form** (not a page) | User/org/branch modals, quick customer, inventory item |
| D1 | **Drawer workspace** (target) | Quick record preview + contextual edits |

---

## A1 — Register / list page

**Purpose:** High-volume scan, filter, act on rows.

### Layout structure

1. `PageShell` → `PageHeader` (title, subtitle, primary action)
2. `RegisterToolbar` (search scope, filters, secondary actions, export)
3. **Main:** `EntityTable` (desktop) / `EntityCards` or stacked rows (mobile)
4. Pagination / page size
5. Optional: summary strip above table (`PaymentSummaryBanner`-style **only** if tokenized as `SummaryStrip`)

### Allowed components

- `EntityTable`, `RegisterToolbar`, `StatusBadge`, `EmptyState`, `LoadingState`, `ActionMenu` (row)
- **Forbidden:** one-off `max-w-*` page centers that differ from [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) without exception.

### Interaction rules

- Row click → detail route or **drawer** with URL contract ([INTERACTION_RULES.md](./INTERACTION_RULES.md)).
- Sort/filter state should be **restorable** (future: query params).

### Density

- **Comfortable** default; optional **compact** toggle for accountant roles later.

### Action placement

- Primary: header. Secondary: toolbar. Row: kebab / icon group.

---

## A2 — Record detail page

**Purpose:** Single source of truth for one record; supports print/share.

### Layout structure

1. `PageShell` → `PageHeader` (title = record identifier, status badges, primary actions)
2. `RecordLayout`: main column (sections) + optional **side rail** (metadata, branch, dates)
3. Optional `DetailTabs` (Overview / History / Documents)

### Allowed components

- `Card` / `FormSection` for blocks, `StatusBadge`, `ActionBar` (sticky optional for long job pages)
- Modals for **sub-actions** only (assign tech, update status) — same modals as today but unified API

### Interaction rules

- **No** modal as sole container for this record class.
- Destructive actions require confirmation ([CRUD_STANDARDS.md](./CRUD_STANDARDS.md)).

### Density

- Sectioned; avoid infinite single-column scroll without anchors for technician field use.

---

## A3 — Workflow queue

**Purpose:** Triage and state transitions (not full accounting register).

### Layout structure

- Same shell as A1 but main content may be **cards** or **kanban-like** tabs if justified.
- Must expose **counts** and **filters** consistent with toolbar pattern.

### When cards are allowed

See [INTERACTION_RULES.md](./INTERACTION_RULES.md) §1.2 — document per module.

### Migration note

**Jobs** today: glass cards + status tabs → target **hybrid**: table (`lg+`) + cards (`<lg`) sharing one query.

---

## A4 — Dashboard

**Purpose:** At-a-glance KPIs + **entry points**, not authoritative registers.

### Layout structure

- `StatsCard` grid (tokenized), charts, recent activity lists embedding **links** to A1/A2.

### Rules

- No unique navigation chrome (GST exception pending removal).

---

## A5 — Configuration page

**Purpose:** Rarely edited system/master data.

### Layout structure

- Register (A1) **or** simple list + modal CRUD (`users`, `branches`).
- Prefer **modal** for create/edit if forms are bounded; prefer **page** if many sections (org settings).

---

## A6 — Analytics / finance view

**Purpose:** Registers + period filters + export.

### Layout structure

- A1 + `SummaryStrip` + date filters (`GSTDateFilter` pattern generalized to `PeriodFilter`).
- Tables first; charts supplementary.

---

## A7 — Wizard / multi-step flow

**Purpose:** Invoice builder, complex job intake.

### Layout structure

- `PageShell` with **narrower max width** ([LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md)) — wizard column.
- Clear step indicator; **preview** modal allowed if print-oriented (billing).

### Rules

- Autosave / draft behavior is product-defined; UX must show **explicit save** for financial finalization.

---

## A8 — Auth / public

**Purpose:** Login, customer tracking.

### Rules

- No `AppLayout` chrome where inappropriate; still use **tokens** for inputs/buttons.

---

## M1 — Modal form (pattern)

Not a route; embedded in A1/A2/A5.

### Contract

- `Modal` from UI kit, title + body + **footer** for actions.
- Field count ≤ modal rule ([INTERACTION_RULES.md](./INTERACTION_RULES.md)).

---

## D1 — Drawer workspace (target)

### Contract

- Slides from right; **focus trap**; URL query `detail=` or parallel route.
- Used when user must **compare list + detail** (e.g. ledger customer pick + statement).

**Current gap:** implement only after replacing bespoke pickup/supplier overlays.

---

## Route → archetype mapping (maintenance table)

*Engineering should update this table when adding routes.*

| Route pattern | Archetype |
|---------------|-----------|
| `/billing`, `/inventory`, … | A1 |
| `/jobs/[id]`, `/billing/[id]`, … | A2 |
| `/jobs`, `/pickups`, `/my-jobs` | A3 (migrate toward A1 hybrid) |
| `/dashboard` | A4 |
| `/users`, `/branches`, `/organizations` | A5 |
| `/gst/*` reports | A6 (after shell unification) |
| `/billing/new`, `/jobs/new` | A7 |
| `/login`, `/track/*` | A8 |

---

*End of Page Archetypes.*
