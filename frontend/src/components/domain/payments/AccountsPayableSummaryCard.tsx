"use client";

import React from "react";
import { IndianRupee } from "lucide-react";

export interface AccountsPayableSummaryCardProps {
  totalOutstandingDisplay?: React.ReactNode;
  loading?: boolean;
}

/** Workspace context banner — operational AP total, not a decorative dashboard widget. */
export function AccountsPayableSummaryCard({
  totalOutstandingDisplay,
  loading,
}: AccountsPayableSummaryCardProps) {
  return (
    <div className="card flex min-w-[220px] flex-1 items-center gap-3 px-4 py-3 md:max-w-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
        <IndianRupee className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 dark:text-slate-400">
          Total accounts payable
        </p>
        <p className="text-xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {loading ? "—" : totalOutstandingDisplay}
        </p>
      </div>
    </div>
  );
}
