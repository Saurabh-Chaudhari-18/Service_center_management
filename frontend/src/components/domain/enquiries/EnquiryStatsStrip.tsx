"use client";

import React from "react";
import { UserSearch, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { SummaryStrip } from "@/components/shell";

export type EnquiryStatsStripProps = {
  total?: number;
  conversion_rate?: number;
  today_followups?: number;
  overdue_followups?: number;
};

/**
 * Dense horizontal queue context (A3) — triage counts at a glance.
 * Domain-only; no fetching.
 */
export function EnquiryStatsStrip({
  total = 0,
  conversion_rate = 0,
  today_followups = 0,
  overdue_followups = 0,
}: EnquiryStatsStripProps) {
  return (
    <SummaryStrip columns={4} aria-label="Enquiry queue overview">
      <div className="card px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
            <UserSearch className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Total leads</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{total}</p>
          </div>
        </div>
      </div>
      <div className="card px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <TrendingUp className="h-4 w-4 text-green-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Conversion</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{conversion_rate}%</p>
          </div>
        </div>
      </div>
      <div className="card px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Today&apos;s follow-ups</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{today_followups}</p>
          </div>
        </div>
      </div>
      <div className="card px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Overdue</p>
            <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{overdue_followups}</p>
          </div>
        </div>
      </div>
    </SummaryStrip>
  );
}
