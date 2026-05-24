/**
 * ServiceHub UX shell composites (@/components/shell).
 *
 * Governance: docs/ux/LAYOUT_SYSTEM.md, PAGE_ARCHETYPES.md, CRUD_STANDARDS.md,
 * INTERACTION_RULES.md, REFACTOR_STRATEGY.md (Phase 1).
 *
 * Usage (incremental):
 * - Wrap page bodies: `PageShell` under `Header` instead of bespoke `div.p-6`.
 * - Toolbar rows on registers: `RegisterToolbar` (`filters`, `search`, `secondaryActions`).
 * - Tables: `EntityTable` with `loading`/`empty`/pagination slots wrapping existing `<table>`.
 * - Card queues / triage lists: `EntityCards` (`columns="single"` for one-column queues) feeding existing card markup.
 * - Form footers: `ActionBar` with `secondary` + `primary` props.
 * - Pagination: `PaginationFooter` (range + prev/next, mobile-friendly).
 * - Docked inspector chrome: `EntityInspector` (queries live in domain/route bodies).
 * - Vertical activity list chrome: `ActivityTimeline` (caller maps domain → items).
 * - Scope toggles: `SegmentedControl` (presentational tablist; callers own state).
 * - Workspace chrome: `WorkspaceEyebrow`, `WorkspaceSurface`, `SummaryStrip`.
 * - Queue section label: `OperationalSectionLabel`.
 * - Group fields: `FormSection` titles + descriptions.
 * - Detail pages: `RecordLayout` for main + sidebar columns.
 */

export type { PageShellProps, PageShellWidth } from "./PageShell";
export { PageShell } from "./PageShell";

export type { RegisterToolbarProps } from "./RegisterToolbar";
export { RegisterToolbar } from "./RegisterToolbar";

export type { EntityTableProps } from "./EntityTable";
export { EntityTable } from "./EntityTable";

export type { EntityCardsProps } from "./EntityCards";
export { EntityCards } from "./EntityCards";

export type { RegisterListCardProps } from "./RegisterListCard";
export { RegisterListCard } from "./RegisterListCard";

export type { PaginationFooterProps } from "./PaginationFooter";
export { PaginationFooter } from "./PaginationFooter";

export type { EntityInspectorProps, EntityInspectorWidth } from "./EntityInspector";
export { EntityInspector } from "./EntityInspector";

export type { ActivityTimelineItem, ActivityTimelineProps } from "./ActivityTimeline";
export { ActivityTimeline } from "./ActivityTimeline";

export type { SegmentedControlProps, SegmentedOption } from "./SegmentedControl";
export { SegmentedControl } from "./SegmentedControl";

export type { WorkspaceEyebrowProps } from "./WorkspaceEyebrow";
export { WorkspaceEyebrow } from "./WorkspaceEyebrow";

export type { WorkspaceSurfaceProps } from "./WorkspaceSurface";
export { WorkspaceSurface } from "./WorkspaceSurface";

export type { SummaryStripProps } from "./SummaryStrip";
export { SummaryStrip } from "./SummaryStrip";

export type { OperationalSectionLabelProps } from "./OperationalSectionLabel";
export { OperationalSectionLabel } from "./OperationalSectionLabel";

export type { ActionBarProps } from "./ActionBar";
export { ActionBar } from "./ActionBar";

export type { FormSectionProps } from "./FormSection";
export { FormSection } from "./FormSection";

export type { RecordLayoutProps } from "./RecordLayout";
export { RecordLayout } from "./RecordLayout";
