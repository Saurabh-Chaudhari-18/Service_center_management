"use client";

import React from "react";
import { IndianRupee } from "lucide-react";
import { formatDateTime } from "@/lib/formatters";

type PaymentLine = {
  id?: string;
  amount?: string | number;
  payment_method?: string;
  reference?: string;
  created_at?: string;
};

export interface PaymentHistoryListProps {
  payments: PaymentLine[];
}

/** Inline drill-down for vendor payments on a purchase (workspace pattern). */
export function PaymentHistoryList({ payments }: PaymentHistoryListProps) {
  return (
    <div className="border-t border-neutral-100 bg-neutral-50/80 px-3 pb-3 pt-2 dark:border-slate-700/60 dark:bg-slate-900/25 sm:px-4">
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-slate-400">
        Payment history
      </h5>
      <ul className="space-y-2">
        {payments.map((payment, idx) => (
          <li
            key={payment.id || String(idx)}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <IndianRupee className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold tabular-nums text-neutral-900 dark:text-white">
                  ₹{parseFloat(String(payment.amount)).toLocaleString()}
                </p>
                <p className="truncate text-[11px] text-neutral-500">
                  {payment.payment_method}
                  {payment.reference ? ` • Ref: ${payment.reference}` : ""}
                </p>
              </div>
            </div>
            <div className="shrink-0 pl-2 text-right text-[11px] text-neutral-500">
              {formatDateTime(payment.created_at || new Date().toISOString())}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
