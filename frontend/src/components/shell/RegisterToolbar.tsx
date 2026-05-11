"use client";

import React from "react";
import { cx } from "./cx";

export interface RegisterToolbarProps {
  /** Primary grouping (tabs / filter chips). Left segment per LAYOUT_SYSTEM.md */
  filters?: React.ReactNode;
  /** Search control(s). Middle/right cluster on desktop */
  search?: React.ReactNode;
  /** Export / column controls — never the page’s sole primary create CTA */
  secondaryActions?: React.ReactNode;
  className?: string;
}

/**
 * Standard register toolbar row (filters → search → secondary actions).
 * Presentational only — callers own state, fetching, permission gates.
 *
 * Intended migration: replace bespoke flex rows on billing/inventory/pickups lists.
 *
 * Anti-patterns avoided: burying mutation logic here; primary “create” duplicated from Header.
 */
export function RegisterToolbar({
  filters,
  search,
  secondaryActions,
  className,
}: RegisterToolbarProps) {
  const hasRight = !!(search ?? secondaryActions);

  return (
    <div
      role="toolbar"
      aria-label="List filters"
      className={cx(
        "flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4",
        className,
      )}
    >
      {filters !== undefined ? (
        <div className="flex min-w-0 shrink flex-wrap items-center gap-2">{filters}</div>
      ) : null}

      {hasRight ? (
        <div
          className={cx(
            "flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
            filters !== undefined ? "lg:justify-end" : "w-full sm:justify-between",
          )}
        >
          {search !== undefined ? (
            <div className="min-w-[12rem] w-full shrink-0 sm:flex-1 sm:max-w-md">{search}</div>
          ) : null}
          {secondaryActions !== undefined ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {secondaryActions}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
