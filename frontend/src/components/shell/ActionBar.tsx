"use client";

import React from "react";
import { cx } from "./cx";

export interface ActionBarProps {
  /** Cancel / secondary — appears above primary on narrow screens, to the left on `sm+` */
  secondary?: React.ReactNode;
  /** Save / submit — primary action, below secondary on narrow screens, right on `sm+` */
  primary?: React.ReactNode;
  /** Use instead of `secondary`/`primary` when layout is non-standard — still aligns end/right on `sm+` */
  children?: React.ReactNode;
  /** Pin to viewport bottom inside scroll containers (opaque backdrop for readability) */
  sticky?: boolean;
  className?: string;
}

/**
 * Form/footer action row per CRUD_STANDARDS.md (Cancel → Save on desktop, stacked on mobile).
 *
 * Intended migration: page & drawer footers outside `Modal` `footer`.
 *
 * Anti-patterns avoided: hard-wired `Button`s — pass instances from callers.
 */
export function ActionBar({
  secondary,
  primary,
  children,
  sticky = false,
  className,
}: ActionBarProps) {
  return (
    <div
      className={cx(
        `border-t border-neutral-200/80 pt-6 dark:border-slate-800/80`,
        sticky &&
          cx(
            "sticky bottom-0 z-20 -mx-4 border-t px-4 py-4 backdrop-blur-md lg:-mx-6 lg:px-6",
            "border-neutral-200/80 bg-white/92 dark:border-slate-800/85 dark:bg-slate-950/92",
          ),
        className,
      )}
      data-shell-action-bar
    >
      {children !== undefined ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
          {children}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
          {secondary !== undefined ? (
            <div className="w-full sm:w-auto">{secondary}</div>
          ) : null}
          {primary !== undefined ? (
            <div className="w-full sm:w-auto">{primary}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
