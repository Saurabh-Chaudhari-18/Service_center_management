# Refactor Strategy

**Companion:** All `docs/ux/*.md`

**Goal:** Migrate from fragmented screens to **one UX architecture** without breaking business logic, big-bang rewires, or random visual redesigns.

---

## 1. Principles

1. **Module-by-module** — Finish one bounded area before reshaping the next.
2. **Composites-first** — Introduce `PageShell`, `RegisterToolbar`, `EntityTable` (+ mobile fallback) **then** migrate routes to use them.
3. **Behavior preserved** — Same API calls, validations, permissions; JSX structure may change.
4. **Routing preserved** unless constitution requires addition (e.g. `/customers/[id]`) **with** backward-compatible list behavior during transition.
5. **GST last in shell** — Unify visuals only after composites exist; avoids double rework.

---

## 2. Phases

### Phase 0 — Governance (complete)

- [x] Author `docs/ux/*` constitution pack.
- [ ] Team acknowledgment in README or CONTRIBUTING pointer.

### Phase 1 — Composites scaffolding (no feature redesign)

Implement minimal **API-stable** composites (thin wrappers):

| Component | Definition doc | Acceptance |
|-----------|----------------|------------|
| `PageShell` | [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) | Wraps padding + spacing + optional max width |
| `PageHeader` / use `Header` | Same | Document slots only; may alias existing `Header` |
| `RegisterToolbar` | [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md) | Search + filters row; no business logic |
| `EntityTable` | [INTERACTION_RULES.md](./INTERACTION_RULES.md) | Accessible table + empty + loading slots |
| `EntityCards` | Same | Responsive fallback |
| `ActionBar` | [CRUD_STANDARDS.md](./CRUD_STANDARDS.md) | Form footer |
| `FormSection` | [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) §9 | Heading + grouped fields |
| `RecordLayout` | [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md) A2 | Detail main + sidebar rail |

**Deliverable:** components exported from `frontend/src/components/shell/` (or similar); Storybook optional.

**Status:** Phase 1 shell primitives landed in [`frontend/src/components/shell/`](../../frontend/src/components/shell/) (`PageShell`, `RegisterToolbar`, `EntityTable`, `EntityCards`, `ActionBar`, `FormSection`, `RecordLayout`). Route migrations remain optional follow-up work.

### Phase 2 — Data layer normalization

Migrate **manual fetch** pages to React Query:

- `purchases/page.tsx`
- `enquiries/page.tsx`
- `ledger/page.tsx`
- `payments/page.tsx` (partially structured — align hooks)

**Why first:** inconsistent loading/error states **amplify** UX fragmentation during UI migration.

**Status:** Phase 2 applied to all four routes — shared `LoadingState` / `EmptyState`, toast on query failures where silent before, `@tanstack/react-query` queries + mutations, `invalidateQueries({ queryKey: ["purchases"] | ["enquiries"] | ["ledger"] })` on mutations, and low-risk `PageShell` / `RegisterToolbar` on purchases, enquiries, payments, ledger.

### Phase 3 — Overlay unification

Replace bespoke overlays:

1. `pickups/[id]/page.tsx` — use `Modal` or new `RecordDrawer`.
2. `suppliers/page.tsx` — same.

**Risk:** focus trap z-index conflicts with `Select` portals — test with inventory forms.

### Phase 4 — High-impact registers

Order (highest ROI for daily ops):

1. **Customers** — table desktop + **`/customers/[id]`** detail route; modal becomes optional quick view only.
2. **Purchases** — register alignment + design-system CTA.
3. **Jobs** — hybrid table/card with shared pagination/filter state.

### Phase 5 — CRUD duplication reduction

- Consolidate **NewCustomer** flows (job, billing, palette, customers).
- Standardize **modal footers** and **confirm** flows per [CRUD_STANDARDS.md](./CRUD_STANDARDS.md).

### Phase 6 — GST shell convergence

- Remove inner permanent sidebar **or** re-skin to global tokens + include `Header`.
- Reuse `RegisterToolbar` / `PeriodFilter` abstraction from billing/GST date filter.

### Phase 7 — Polish & debt

- Reduce `globals.css` global `transition` scope.
- Role/status badge centralization ([DESIGN_TOKENS.md](./DESIGN_TOKENS.md)).

---

## 3. Migration order (summary)

| Priority | Module | Rationale |
|----------|--------|-----------|
| P0 | Composites scaffolding | Enables consistent refactors |
| P1 | React Query on ledger/payments/enquiries/purchases | Stabilizes UX feedback |
| P2 | Pickup/supplier modals | Security/focus consistency |
| P3 | Customers register + detail URL | Highest receptionist/accountant friction |
| P4 | Purchases register | Accountant alignment |
| P5 | Jobs hybrid register | Volume scaling |
| P6 | GST shell | Removes “second product” feel |

---

## 4. Minimizing fragmentation during transition

- **Feature flags:** not required initially; route-level incremental migration suffices.
- **Dual patterns:** acceptable **only inside same module** for ≤1 sprint (e.g. customer list migrates before detail route ships).
- **Definition of done per module:** all new code in that module passes **archetype + interaction** checklist in PR template.

---

## 5. PR checklist (suggested snippet)

```markdown
- [ ] Archetype: (A1–A8 / M1 / D1)
- [ ] Uses shared primitives (`@/components/ui` or `components/shell/*`)
- [ ] CRUD surface matches INTERACTION_RULES + CRUD_STANDARDS
- [ ] Dark mode verified for new overlays
- [ ] No new `fixed inset-0` modals
- [ ] Lists: pagination or explicit reason
```

---

## 6. Out of scope (this strategy)

- Backend API redesign
- Permission model changes (unless unblockable)
- Decorative rebranding / animation passes

---

*End of Refactor Strategy.*
