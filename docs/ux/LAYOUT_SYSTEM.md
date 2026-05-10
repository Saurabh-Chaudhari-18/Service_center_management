# Layout System

**Companion:** [PAGE_ARCHETYPES.md](./PAGE_ARCHETYPES.md) · [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)

Defines **page structure**, **spacing**, **width**, and **density** so all modules share one spatial grammar. Visual **theme** (glass, gradients) stays in tokens/CSS; this doc governs **geometry and placement**.

---

## 1. Layers

1. **Shell** — `AppLayout`: fixed sidebar (`lg+`), scrollable `main.main-content`, global command palette.
2. **Page** — `PageShell`: optional max width, vertical padding, single scroll owner.
3. **Header** — Global `Header` from `Layout.tsx`: title, subtitle, `actions`.
4. **Body** — Toolbar + primary content + secondary panels.

**GST exception:** nested `flex` + inner sidebar violates single shell; treat as temporary ([REFACTOR_STRATEGY.md](./REFACTOR_STRATEGY.md)).

---

## 2. Spacing scale

Use **Tailwind spacing** aligned to 4px grid; prefer these **page-level** values:

| Token use | Classes | Usage |
|-----------|---------|--------|
| Page horizontal padding | `px-4` `lg:px-6` | Matches current `Header` |
| Page vertical padding | `py-6` or `p-6` body | Primary content gutter |
| Section gap | `space-y-6` | Between major blocks |
| Inside card | `p-5` default (`Card` padding `md`) | Forms and lists inside cards |
| Tight stacks | `space-y-3` | Subsections inside one card |

**Rule:** avoid mixing `p-8` / `space-y-8` on the same tier as `p-6` without archetype reason (wizard may use tighter).

---

## 3. Content width

| Archetype | Max width behavior |
|-----------|---------------------|
| A1 Register | **Fluid** — full width of `main-content` (no arbitrary `max-w-6xl` centering unless print/readability doc says so). |
| A2 Detail | Fluid; optional **readable** inner max for prose-only blocks (~`max-w-prose`) — not entire page. |
| A7 Wizard | `max-w-4xl` or `max-w-5xl` **centered** for form focus |
| A4 Dashboard | Fluid; grid columns responsive |

**Current inconsistency:** `purchases/page.tsx` uses `max-w-6xl mx-auto`; **remove** when aligned to register archetype.

---

## 4. Header & title

- **Title:** `Header` `title` prop — page must not duplicate a competing `h1` **unless** submodule explicitly omits `Header` (GST — fix by adding `Header`).
- **Subtitle:** counts, scope, or period — one line.
- **Actions:** max **one primary** button; overflow to menu if needed.

---

## 5. Toolbar (register)

Order left → right:

1. Filters / tabs (primary grouping)
2. Search (if global to list)
3. Secondary actions (export, column visibility — future)
4. **Do not** place primary create here if it’s the page’s main CTA (keep in header).

---

## 6. Action areas

| Context | Placement |
|---------|-----------|
| Page-level | `Header` `actions` (right) |
| Form | Bottom `ActionBar` (sticky optional) |
| Modal | `Modal` `footer` |
| Table row | Trailing cell |

---

## 7. Content density

- **Registers:** prioritize **rows per viewport**; reduce decorative padding on table cells (tokenized compact mode later).
- **Dashboard:** current card density acceptable.
- **Avoid** unnecessary `glass-card` hover motion on register rows when migrated to tables ([DESIGN_TOKENS.md](./DESIGN_TOKENS.md)).

---

## 8. Responsive

- **`globals.css`** already adjusts `p-6` / tables on small screens — composites must **not** fight these rules with inline overrides.
- Sticky table header: consider in `EntityTable` composite (future).

---

## 9. Form layout (page & modal)

- **Sections:** `FormSection` with title + optional description.
- **Columns:** `grid-cols-1 md:grid-cols-2` for short fields; single column for long text.
- **Required fields:** asterisk in label (existing `Input` pattern).

---

## 10. Future composites (geometry only)

| Component | Responsibility |
|-----------|----------------|
| `PageShell` | `p-6 space-y-6`, max-width policy, single scroll |
| `PageHeader` | Thin wrapper if `Header` gains slots for tabs/breadcrumb |
| `RegisterToolbar` | Toolbar row spacing and alignment |
| `ActionBar` | Form footer alignment and mobile stack |

---

*End of Layout System.*
