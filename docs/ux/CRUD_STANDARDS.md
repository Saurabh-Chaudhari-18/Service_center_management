# CRUD Standards

**Companion:** [INTERACTION_RULES.md](./INTERACTION_RULES.md) · [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md)

Unified **Create, Read, Update, Delete** behavior for all entities. Preserves business logic and routes unless a strategic migration is approved.

---

## 1. Vocabulary

| Operation | Meaning |
|-----------|---------|
| **Create** | New persistent record |
| **Read** | Detail / list / preview |
| **Update** | Field or status change |
| **Delete / Deactivate** | Remove or soft-disable |
| **Status transition** | Workflow-only update (job, pickup, enquiry) |

---

## 2. Create

### 2.1 Surface selection

| Complexity | Surface |
|------------|---------|
| Few fields, no dependencies | Modal (M1) or quick row |
| Multi-section, calculations, attachments | Full page (A7) |
| Interrupting another flow (e.g. job intake) | Modal **reusing** same form component as page |

### 2.2 Rules

1. **Single form component** per entity where possible (props: `mode`, `onSuccess`, `onCancel`, `variant: "page" | "modal"`).
2. **Primary submit** label: `Save` / `Create` / context-specific (`Create job`) — consistent with action hierarchy §5.
3. On success: **toast** + invalidate queries + navigate or close modal per [OPERATIONAL_PATTERNS.md](./OPERATIONAL_PATTERNS.md).

### 2.3 Current duplication to remove

- **New customer** appears in: `customers/page.tsx` modal, `/customers/new`, `jobs/new`, `billing/new`, command palette → **must** share `CustomerCreateForm` (already partially true for customers page).

---

## 3. Read (list + detail)

### 3.1 List

- Registers use **one loading / empty / error** pattern (React Query + shared `LoadingState` / `EmptyState`).
- **No silent failures** — ledger/payments style `toast.error` is minimum; align copy in composite.

### 3.2 Detail

- **Canonical detail = route** (`/…/[id]`) for operational records ([INTERACTION_RULES.md](./INTERACTION_RULES.md)).
- **Customer** exception: migrate to `/customers/[id]`.
- **Preview** drawer allowed with URL contract when implemented.

---

## 4. Update (edit)

### 4.1 Surface

- Same as create: **modal** for small edits (user, branch fields); **page** for invoice/job edit.
- **Inline edit** in table: only for trivial fields (future); must not bypass validation.

### 4.2 Save / cancel placement

- **Page forms:** `ActionBar` footer — `Cancel` left of `Save` on desktop; stacked full-width on mobile ([LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md)).
- **Modals:** use `Modal` **`footer` prop** consistently (not floating buttons in body).

---

## 5. Action hierarchy

1. **Primary** — One per view: the main forward action (Save, Create invoice, Record payment).
2. **Secondary** — Outline / ghost: Cancel, Back, Export.
3. **Tertiary** — Icon-only or kebab: duplicate, print, less-used.
4. **Destructive** — Never primary; require confirm; use `danger` variant.

---

## 6. Delete & deactivate

- **Soft deactivate** (users): explain effect; `ConfirmDialog` with clear consequence.
- **Hard delete** (rare): typed confirmation or admin-only.
- **Pattern:** `ConfirmDialog` from `@/components/ui` — no custom two-button divs except during migration.

---

## 7. Status updates (workflow)

- **Job / pickup / enquiry:** dedicated modal or inline flow; **same copy and step order** across similar domains (e.g. assign → status → notes).
- Always show: **current status → allowed transitions**; optional note field when API supports it.
- **Technician** vs **manager** capabilities enforced by API; UI hides disallowed actions.

---

## 8. Validation & errors

- Client: `react-hook-form` + zod where used today; extend consistently.
- Server errors: map to field-level or toast; **no** raw stack traces in UI.
- **Financial forms:** show inline totals and blocking errors before submit (billing already pattern-heavy — consolidate).

---

## 9. Notifications

- **Toast** for success/failure of mutations.
- **No** duplicate toast + modal alert for same event.

---

## 10. Routing policy

- **Preserve existing URLs** during migration; new detail routes **add** paths (e.g. `/customers/[id]`) without breaking list-only flows until cutover.
- **Strategic** route changes require changelog + redirect if bookmarked.

---

*End of CRUD Standards.*
