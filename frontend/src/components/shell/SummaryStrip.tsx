"use client";

import React from "react";
import { cx } from "./cx";

export interface SummaryStripProps {
  children: React.ReactNode;
  /** Responsive column count for KPI / summary tiles */
  columns?: 2 | 3 | 4;
  /** Optional accessible name for the strip region */
  "aria-label"?: string;
  className?: string;
}

const COLS: Record<NonNullable<SummaryStripProps["columns"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

/**
 * Horizontal summary KPI row — layout only; tiles stay in domain/pages.
 */
export function SummaryStrip({
  children,
  columns = 3,
  className,
  "aria-label": ariaLabel,
}: SummaryStripProps) {
  return (
    <div
      className={cx("grid min-w-0 grid-cols-1 gap-3", COLS[columns], className)}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
