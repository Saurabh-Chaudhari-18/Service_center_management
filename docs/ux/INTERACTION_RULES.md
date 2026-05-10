# Interaction Rules

**Companion:** [UX_CONSTITUTION.md](./UX_CONSTITUTION.md) · [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md)

These rules eliminate ad hoc decisions about **surface** (modal vs drawer vs page), **density** (table vs cards), and **motion**. They apply product-wide unless a breakpoint or role explicitly requires otherwise.

---

## 1. Tables vs cards

### 1.1 Default: registers use tables (desktop)

Use a **tabular register** when **any** of the following holds:

- Users **scan, compare, or sort** many rows (invoices, stock lines, ledger entries, payments history, GST registers).
- Users **reconcile** or **audit** (accountant, owner).
- Row count is expected to **grow beyond ~50** visible without scrolling in typical usage.

**Implementation target:** shared `EntityTable` / register table composite ([PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md)).

### 1.2 Cards are allowed when

- **Viewport:** `md` breakpoint and below, as **fallback** for the same dataset (see mobile strategy).
- **Workflow queue** where each row is **rich state** (multiple badges, SLA, assignee) **and** total daily volume is moderate — then **compact cards** or **split view** may be used if table ergonomics are worse (document decision in module README).
- **Dashboard / summary** tiles (not a register).

### 1.3 Mobile fallback strategy

- **Same data, different presentation:** table → **stacked rows** or **entity cards** driven by one data hook (no duplicate fetch logic).
- **Horizontal scroll** is a **last resort**; prefer reflow. (Project already forces table scroll on small screens in `globals.css` — composites should own this behavior explicitly.)

### 1.4 Scaling rules

- Registers **must** support **pagination** (or virtualization) consistently; never unbounded DOM lists for operational data.
- If a screen today uses infinite card scroll for hundreds of jobs, classify as **technical debt**; migrate to Register + pagination.

---

## 2. Modals vs drawers vs full pages

Use the **simplest surface that fits cognitive load + field count**, in this order:

| Surface | When | Constraints |
|---------|------|----------------|
| **Modal** (`Modal` from UI kit) | Short forms, confirmations, picker lists, auxiliary creates (e.g. quick customer) | **≤ ~6 primary fields** OR single focused action (assign, record payment line). Must use **shared `Modal`**; no raw `fixed inset-0` panels. |
| **Drawer** (future `RecordDrawer`) | **Contextual** actions on a record while keeping list visible; multi-field edits that are not full “wizards” | **Not yet widely implemented** — when introduced, must replace one-off pickup/supplier overlays first. |
| **Full page** | Multi-section forms, wizards, legal/financial review (invoice builder), print-friendly views | Primary **create/edit** for complex entities; URL must reflect route. |

### 2.1 Hard rules

1. **No duplicate “create” stories** for the same entity without documentation: e.g. customer via list modal, `/customers/new`, job new-customer modal, command palette — must share **one form component** ([CRUD_STANDARDS.md](./CRUD_STANDARDS.md)).
2. **Detail of record-of-reference** (customer, supplier, branch, org) → **route-based detail** or **drawer preview** with **URL sync** (query or sub-route), not modal-only.
3. **Destructive** actions → `ConfirmDialog` pattern; no silent deletes.

---

## 3. Detail views

### 3.1 Require route-based pages

Entities that staff **reference externally** or need **bookmark/refresh**:

- Job card, invoice, pickup, purchase, public track page (already routes).
- **Customer** (currently modal — **non-compliant**).
- **Supplier** (ensure detail URL when introduced; today list + modal overlay).

### 3.2 Quick preview (drawer)

Allowed if:

- Opening from a register **does not lose list state**, and
- URL updates with at least `?record=` or `/[id]/overview` child route for shareability, **or** the preview is explicitly **ephemeral** (e.g. pick-one modal in a form) and not the main way to manage the entity.

### 3.3 Stable URL requirements

Any screen that shows **authoritative** business state must be **deep-linkable** without losing the shell (except auth). Job/invoice meet this; customer list detail does not.

---

## 4. Navigation & command palette

- **Command palette** actions are **shortcuts** to the same canonical routes or modals — never the only path to a primary workflow.
- **Naming:** avoid “in-place” vs “page” user-facing split; use neutral verbs (“New customer”, “Open billing register”).
- **GST:** must not rely on a **second permanent vertical nav** long term; fold into global IA or horizontal sub-nav under one module header ([REFACTOR_STRATEGY.md](./REFACTOR_STRATEGY.md)).

---

## 5. Action placement (global)

1. **Primary page action** — `Header` `actions` slot (right), one **primary** per page.
2. **Row actions** — trailing cell or kebab; destructive last.
3. **Form actions** — footer right: Cancel (secondary) → Save (primary); mobile full-width stack in **FormLayout** ([LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md)).

---

## 6. Motion & feedback

- **No decorative hover lift** on dense registers (tables). Cards on dashboard may keep subtle elevation if tokenized ([DESIGN_TOKENS.md](./DESIGN_TOKENS.md)).
- **Global `transition` on all elements** (see `globals.css`) is risky for performance and perceived stability — **do not extend**; remove during layout-system hardening.

---

## 7. Design-system violations (current)

| Issue | Location | Remediation |
|-------|-----------|-------------|
| Custom modal overlay | `pickups/[id]/page.tsx` | Replace with `Modal` or `RecordDrawer` |
| Custom supplier overlay | `suppliers/page.tsx` | Same |
| Bespoke primary CTA | `purchases/page.tsx` | `Button` primary variant |
| GST inner sidebar | `gst/layout.tsx` | Merge to global shell pattern |
| Modal-only customer detail | `customers/page.tsx` | Route detail + optional preview |

---

## 8. Breakpoint defaults

- **`< lg`:** stack toolbars; register → cards/stacked table rows.
- **`≥ lg`:** register table default for operational lists per §1.

---

*End of Interaction Rules.*
