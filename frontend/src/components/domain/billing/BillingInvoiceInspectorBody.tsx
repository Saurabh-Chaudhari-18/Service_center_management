"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { billingApi } from "@/lib/api";
import { formatDateLong } from "@/lib/formatters";
import type { Invoice, InvoiceLineItem, Payment } from "@/types";
import { getInvoiceStatusPresentation, SemanticStatusBadge } from "@/platform/semantics";

export interface BillingInvoiceInspectorBodyProps {
  invoice: Invoice;
}

/**
 * Billing register inspector body — owns React Query for this pane only.
 * Governance: shell `EntityInspector` is chrome-only; domain body owns fetch + mapping.
 */
export function BillingInvoiceInspectorBody({
  invoice,
}: BillingInvoiceInspectorBodyProps) {
  const { data: fullInvoice } = useQuery({
    queryKey: ["invoice", invoice.id],
    queryFn: () => billingApi.getInvoice(invoice.id),
    enabled: !!invoice.id,
  });

  const { data: payments } = useQuery({
    queryKey: ["invoice-payments", invoice.id],
    queryFn: () => billingApi.getPayments(invoice.id),
    enabled: !!invoice.id,
  });

  const inv = fullInvoice || invoice;
  const statusPresentation = getInvoiceStatusPresentation(inv.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SemanticStatusBadge presentation={statusPresentation} size="md" />
        <div className="text-right">
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            ₹{Number(inv.total_amount).toLocaleString("en-IN")}
          </p>
          <p
            className={`text-sm font-medium ${inv.balance_due > 0 ? "text-red-600" : "text-green-600"}`}
          >
            {inv.balance_due > 0
              ? `₹${inv.balance_due.toLocaleString("en-IN")} due`
              : "Fully Paid"}
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-slate-800/50">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Date</p>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">
              {formatDateLong(inv.invoice_date)}
            </p>
          </div>
          {inv.due_date && (
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500">Due Date</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">
                {formatDateLong(inv.due_date)}
              </p>
            </div>
          )}
          {inv.job_number && (
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500">Job Reference</p>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{inv.job_number}</p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500">Customer</p>
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{inv.customer_name}</p>
            <p className="text-xs text-neutral-500">{inv.customer_mobile}</p>
          </div>
        </div>
      </div>

      {inv.line_items && inv.line_items.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700 dark:text-slate-300">
            Line Items
          </h4>
          <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-slate-600">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-slate-800/80">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-neutral-500">
                    Item
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-neutral-500">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-neutral-500">
                    Rate
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-neutral-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-700">
                {inv.line_items.map((item: InvoiceLineItem, idx: number) => (
                  <tr key={idx}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">{item.description}</p>
                      <span className="text-xs text-neutral-400">{item.item_type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-neutral-600 dark:text-slate-300">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2.5 text-right text-neutral-600 dark:text-slate-300">
                      ₹{Number(item.unit_price).toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-neutral-900 dark:text-neutral-100">
                      ₹{Number(item.amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-1 border-t border-neutral-200 bg-neutral-50 px-3 py-3 text-sm dark:border-slate-600 dark:bg-slate-800/50">
              <div className="flex justify-between">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium">
                  ₹{Number(inv.subtotal).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Tax (GST)</span>
                <span className="font-medium">
                  ₹{Number(inv.total_tax).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-neutral-300 pt-2 text-base font-bold dark:border-slate-600">
                <span>Total</span>
                <span>₹{Number(inv.total_amount).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {payments && payments.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-700 dark:text-slate-300">
            Payments ({payments.length})
          </h4>
          <div className="space-y-2">
            {payments.map((payment: Payment, idx: number) => (
              <div
                key={payment.id || idx}
                className="flex items-center justify-between rounded-xl bg-neutral-50 p-3 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                    <CreditCard className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                      ₹{Number(payment.amount).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatDateLong(payment.payment_date)} • {payment.payment_method}
                    </p>
                  </div>
                </div>
                {payment.reference && (
                  <span className="text-xs text-neutral-400">Ref: {payment.reference}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {inv.notes && (
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700 dark:text-slate-300">
            Notes
          </h4>
          <p className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-slate-800/50 dark:text-slate-300">
            {inv.notes}
          </p>
        </div>
      )}
    </div>
  );
}
