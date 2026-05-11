"use client";

import React from "react";
import { cx } from "@/components/shell/cx";

export interface LedgerWorkspaceProps {
  /** Left/narrow operational rail (e.g. customers with dues) */
  rail: React.ReactNode;
  /** Primary workspace surface (statement or recent entries) */
  workspace: React.ReactNode;
  className?: string;
}

/**
 * Ledger-specific two-pane workspace: dues rail first, detail second (matches existing workflow).
 * Widths aligned with RecordLayout rails without forcing DOM order swaps on mobile.
 */
export function LedgerWorkspace({ rail, workspace, className }: LedgerWorkspaceProps) {
  return (
    <div
      className={cx(
        "grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(260px,22rem),minmax(0,1fr)] lg:gap-6",
        className,
      )}
    >
      <aside className="min-w-0 space-y-3 lg:border-r lg:border-neutral-200/80 lg:pr-6 dark:lg:border-slate-800/80">
        {rail}
      </aside>
      <div className="min-w-0 space-y-4">{workspace}</div>
    </div>
  );
}
