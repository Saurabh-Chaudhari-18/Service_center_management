# Design Tokens & UI Primitives

**Companion:** [LAYOUT_SYSTEM.md](./LAYOUT_SYSTEM.md) · [UX_CONSTITUTION.md](./UX_CONSTITUTION.md)

This product’s **visual system** is anchored in `frontend/src/app/globals.css` (`@theme`, `@layer components`) and Tailwind v4 `@custom-variant dark`. **No new parallel token sets** (e.g. GST-only greens as primary CTA) without merging into this spine.

---

## 1. Color roles (semantic)

| Role | Usage | Source |
|------|--------|--------|
| **Primary** | Primary actions, key focus rings | `--color-primary-*`, `.btn-primary` gradient |
| **Neutral** | Text, borders, surfaces | `--color-neutral-*` |
| **Success / warning / danger / info** | Status, alerts, semantic badges | Tailwind semantic + Alert variants |
| **Accent violet** | Brand chrome (sidebar marketing) | Sidebar gradient (decorative, not content CTA) |

**Rule:** Content CTAs use **primary button** — not ad hoc `emerald`/`teal` per page (fix `purchases/page.tsx`).

---

## 2. Dark mode

- Toggle: `ThemeContext` → `class="dark"` on `html`.
- **Surfaces:** `.dark .card`, `.dark .glass-card`, `.dark .main-content` defined in `globals.css`.
- **Text:** broad `.dark .text-neutral-*` overrides — prefer **semantic** classes for new code to reduce `!important` reliance long term.
- **Requirement:** new UI **must** work in dark mode; **no light-only overlays** (pickup/supplier modals — debt).

---

## 3. Typography

- **Font:** Inter via `layout.tsx` variable `--font-inter`.
- **Hierarchy:** page title via `Header`; in-body `h2` section / `h3` subsection; table headers `text-xs uppercase tracking-wider` for registers.
- **Monospace:** job/invoice numbers (`font-mono`).

---

## 4. Components (primitive — existing)

**Location:** `frontend/src/components/ui/index.tsx`

| Primitive | Role |
|-----------|------|
| `Button` | Variants: primary, secondary, danger, ghost; sizes sm/md/lg |
| `Input`, `Select`, `Textarea` | Form controls; `Select` uses portal dropdown |
| `Card` | Section container; padding none/sm/md/lg |
| `StatsCard` | KPI tiles |
| `Badge` | Generic pill |
| `JobStatusBadge`, `InvoiceStatusBadge` | Domain status (config from `@/types`) |
| `Modal`, `ConfirmDialog` | Overlays |
| `Alert`, `EmptyState`, `LoadingState`, `Spinner` | Feedback |

**Governance:** new features import these; **extend** primitives rather than fork.

---

## 5. Status & badges

1. **Domain configs** in `@/types` (`*_CONFIG`) are the **source of truth** for labels + colors.
2. **New statuses** must extend config, not inline classes.
3. **Role badges** (`users/page.tsx`) should migrate to a **small token map** (e.g. `ROLE_BADGE`) in one file.

---

## 6. Motion

- **Buttons:** subtle scale on active (`.btn`).
- **Cards:** hover lift on `.glass-card` / `.stats-card` — acceptable on **dashboard**; **discourage** on future register rows.
- **Global transition** on `html *` in `globals.css` — **do not expand**; plan reduction ([REFACTOR_STRATEGY.md](./REFACTOR_STRATEGY.md)).

---

## 7. Borders, radius, shadow

- **Radius:** `rounded-xl` / `rounded-2xl` for cards and modals (existing language).
- **Shadow:** `--shadow-card`, glass shadows — use CSS variables, not arbitrary per-page shadow strings.

---

## 8. Icons

- **Library:** `lucide-react` (existing).
- **Sizes:** 16–20px inline with text; 24px for empty states.

---

## 9. Anti-patterns (enforce in review)

- Raw `<button className="bg-gradient...">` for primary actions
- New `fixed inset-0` modals outside `Modal`
- Page-specific **primary color** in dark mode (emerald/teal) not in token doc
- Emoji in production status chips (accessibility + consistency) — remove over time

---

## 10. Token evolution

When adding tokens:

1. Add to `@theme` in `globals.css` **or** document Tailwind semantic extension.
2. Reference in [INTERACTION_RULES.md](./INTERACTION_RULES.md) if it changes behavior (density, motion).

---

*End of Design Tokens.*
