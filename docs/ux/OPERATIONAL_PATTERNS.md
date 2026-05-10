# Operational Patterns

**Companion:** [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md) · [CRUD_STANDARDS.md](./CRUD_STANDARDS.md)

How **role-based work** maps to UI patterns. Optimizes for **speed, scanability, and error reduction** — not visual novelty.

---

## 1. Roles → primary surfaces

| Role | Primary workflows | Preferred patterns |
|------|-------------------|-------------------|
| **Receptionist** | Customer lookup, job intake, pickup coordination | A1 registers, fast search, **route-based customer** |
| **Technician** | My jobs, status, notes, diagnosis | A3 queue, focused A2 detail, minimal finance noise |
| **Accountant** | Invoices, purchases, payments, GST, ledger | A1 tables, summary strips, export |
| **Manager** | Approvals, branch ops, staff | Dashboard + registers + A2 |
| **Owner** | Cross-branch metrics, compliance | A4 + A6 |
| **Super Admin** | Organizations | A5 + modals |

---

## 2. Registers (financial & stock)

**Pattern:** A1 + `RegisterToolbar` + sortable columns + pagination.

- **Today:** `billing/page.tsx` is the **reference implementation** for summary + table ([UX_CONSTITUTION.md](./UX_CONSTITUTION.md)).
- **Align:** ledger, payments, receipts, purchases list to **same loading/empty** and toolbar semantics.
- **GST:** tables are correct; shell must unify with global layout ([INTERACTION_RULES.md](./INTERACTION_RULES.md)).

---

## 3. Queues (operational triage)

**Pattern:** A3 — filters/tabs reflecting **workflow state**.

- **Jobs:** status tabs + counts — keep; add **desktop table mode** sharing query key.
- **Pickups:** status tabs + stats cards — acceptable; replace **bespoke modals** with shared `Modal`.
- **Enquiries:** follow-up urgency — ensure **consistent** badge/overdue styling via config.

---

## 4. Command palette (`CommandPalette`)

**Role:** **accelerator** for trained users (`Ctrl/Cmd+K`).

### Rules

1. Commands must mirror **canonical** navigation (same as clicking nav).
2. **Fast create modals** must wrap the **same** forms as elsewhere ([CRUD_STANDARDS.md](./CRUD_STANDARDS.md)).
3. Remove jargon (“In-Place”) from labels in future copy pass.

---

## 5. Branch context

- **Branch switch** (`Layout.tsx`) invalidates queries and redirects to `/dashboard` today — document **UX cost** for power users; future: optional “stay on route” if same branch has access.

---

## 6. Payments & purchases

- **Payments page:** purchase-centric payment recording + expand rows — operational pattern is **valid**; unify **fetch layer** with React Query and shared empty/error.
- **Purchases list:** move to **register** pattern; fix CTA to design system ([DESIGN_TOKENS.md](./DESIGN_TOKENS.md)).

---

## 7. Invoice builder (wizard)

- **Pattern:** A7 — long-form, preview modal acceptable for **print fidelity**; avoid second navigation paradigm inside GST.

---

## 8. Print & PDF

- **Invoice print:** dedicated template component (`InvoiceTemplate`) — **do not duplicate** preview HTML in unrelated modals without shared partials.

---

## 9. Search & filters

- **Debounce:** shared hook (billing uses debounced search — promote to `lib/useDebouncedValue.ts` when refactoring).
- **Minimum characters:** avoid silent “no search until >2 chars” without UI hint (`purchases/page.tsx`) — show helper text.

---

## 10. Telemetry (future)

Operational UX improvements benefit from lightweight **task completion** metrics (time to create job, errors on invoice) — out of scope for doc-only phase; hooks should live outside components when added.

---

*End of Operational Patterns.*
