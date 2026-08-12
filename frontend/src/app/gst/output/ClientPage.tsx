"use client";

// Focused interactive island below the server route boundary.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ArrowUpCircle } from "lucide-react";
import { GSTDateFilter, type DateRange } from "../GSTDateFilter";

export default function OutputRegisterPage() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gst-output", range.from, range.to, currentBranch?.id],
    queryFn: () => gstApi.getOutputRegister({ from_date: range.from, to_date: range.to, branch: currentBranch?.id }),
  });

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ArrowUpCircle className="w-6 h-6 text-blue-600" /> Output Tax Register
          </h1>
          <p className="text-sm text-neutral-500 mt-1">GST collected on finalized invoices</p>
        </div>
        <GSTDateFilter onChange={setRange} />
      </div>

      {/* Totals */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Taxable", value: fmt(data.totals?.taxable) },
            { label: "CGST", value: fmt(data.totals?.cgst) },
            { label: "SGST", value: fmt(data.totals?.sgst) },
            { label: "Grand Total", value: fmt(data.totals?.total) },
          ].map(s => (
            <div key={s.label} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-bold text-blue-700 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {["Invoice #", "Date", "Customer", "Type", "Taxable", "CGST", "SGST", "Total"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-400">Loading...</td></tr>
            ) : !data?.invoices?.length ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-neutral-400">No invoices in this period.</td></tr>
            ) : (
              data.invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{inv.invoice_number}</td>
                  <td className="px-4 py-3 text-neutral-600">{inv.date}</td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{inv.customer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.invoice_type === "B2B" ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-600"
                    }`}>{inv.invoice_type}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{fmt(inv.taxable)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt(inv.cgst)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt(inv.sgst)}</td>
                  <td className="px-4 py-3 text-right font-bold">{fmt(inv.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
