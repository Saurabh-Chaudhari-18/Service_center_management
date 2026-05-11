"use client";

import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatDate } from "@/lib/formatters";

export interface LedgerEntryRowProps {
  description: string;
  entry_type: string;
  amount: number | string;
  reference_type?: string;
  entry_date?: string;
  variant?: "statement" | "feed";
  /** Used when variant is `feed` */
  customer_name?: string | null;
  className?: string;
}

/**
 * Repeated ledger row surface — statement vs. recent list share one operational shape.
 */
export function LedgerEntryRow({
  description,
  entry_type,
  amount,
  reference_type,
  entry_date,
  variant = "statement",
  customer_name,
  className = "",
}: LedgerEntryRowProps) {
  const isCredit = entry_type === "CREDIT";
  const amt = parseFloat(String(amount));
  const dateStr = entry_date ? formatDate(entry_date) : "";

  const statementMeta = [reference_type, dateStr].filter(Boolean).join(" · ");
  const feedMeta = `${customer_name || ""}${customer_name ? " · " : ""}${dateStr}`.trim();

  const badgeCls = isCredit
    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
    : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200";

  if (variant === "feed") {
    return (
      <div
        className={`flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 dark:border-slate-700 ${className}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isCredit ? "bg-amber-100 dark:bg-amber-900/30" : "bg-green-100 dark:bg-green-900/30"}`}
          >
            {isCredit ? (
              <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{description}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}>
                {isCredit ? "Billed" : "Paid"}
              </span>
              <span className="text-[11px] text-neutral-400">{feedMeta}</span>
            </div>
          </div>
        </div>
        <span className={`shrink-0 pl-2 text-sm font-semibold tabular-nums ${isCredit ? "text-amber-700" : "text-green-700"}`}>
          {isCredit ? "-" : "+"}₹{amt.toLocaleString("en-IN")}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 dark:border-slate-700 ${className}`}>
      <div className="min-w-0 pr-2">
        <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{description}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}>{isCredit ? "Billed" : "Paid"}</span>
          <span className="text-[11px] text-neutral-400">{statementMeta}</span>
        </div>
      </div>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${isCredit ? "text-amber-700" : "text-green-700"}`}>
        {isCredit ? "-" : "+"}₹{amt.toLocaleString("en-IN")}
      </span>
    </div>
  );
}
