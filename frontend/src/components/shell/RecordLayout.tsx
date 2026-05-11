"use client";

import React from "react";
import { cx } from "./cx";

export interface RecordLayoutProps {
  /** Primary column (overview, timelines, printable blocks) */
  main: React.ReactNode;
  /** Optional metadata / summaries — collapses beneath main below `lg` */
  sidebar?: React.ReactNode;
  className?: string;
}

/**
 * Two-column detail scaffolding (PAGE_ARCHETYPES A2) — main + slim side rail on desktop.
 *
 * Intended migration: `jobs/[id]`, invoices, pickups once sections are chunked.
 *
 * Anti-patterns avoided: embedding mutations or tabs — callers keep existing components.
 */
export function RecordLayout({ main, sidebar, className }: RecordLayoutProps) {
  const hasRail = sidebar !== undefined;

  return (
    <div
      className={cx(
        "grid min-w-0 grid-cols-1 items-start gap-6",
        hasRail && "lg:grid-cols-[minmax(0,1fr),minmax(260px,22rem)]",
        className,
      )}
    >
      <div className="min-w-0 space-y-6">{main}</div>

      {hasRail ? (
        <aside
          className={cx(
            "min-w-0 space-y-4",
            "lg:border-l lg:border-neutral-200/80 lg:pl-6 dark:lg:border-slate-800/80",
          )}
        >
          {sidebar}
        </aside>
      ) : null}
    </div>
  );
}
