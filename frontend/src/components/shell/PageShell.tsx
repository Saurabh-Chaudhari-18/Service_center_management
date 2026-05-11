"use client";

import React from "react";
import { cx } from "./cx";

export type PageShellWidth = "fluid" | "constrained" | "wizard";

export interface PageShellProps {
  /** Page body placed under global `Header`. Normalizes rhythm per LAYOUT_SYSTEM.md */
  children: React.ReactNode;
  /** `fluid`: full-width register/detail; `constrained`: centered ~5xl; `wizard`: centered ~4xl */
  width?: PageShellWidth;
  className?: string;
}

const WIDTH_CLASS: Record<PageShellWidth, string> = {
  fluid: "w-full max-w-none min-w-0",
  constrained: "mx-auto w-full max-w-5xl min-w-0",
  wizard: "mx-auto w-full max-w-4xl min-w-0",
};

/**
 * Normalizes horizontal padding (`px-4 lg:px-6`), vertical padding (`py-6`),
 * section spacing (`space-y-6`), and max-width policy.
 *
 * Intended migration: replace ad-hoc `div className="p-6 space-y-6"` wrappers.
 *
 * Anti-patterns avoided: nesting multiple scroll containers; conflicting max-widths per page without `width`.
 */
export function PageShell({
  children,
  width = "fluid",
  className,
}: PageShellProps) {
  return (
    <div
      className={cx(
        "box-border min-h-0 min-w-0 px-4 py-6 lg:px-6",
        WIDTH_CLASS[width],
        "space-y-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
