"use client";

// Focused interactive island below the server route boundary.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ArrowDownCircle, ShoppingCart, Receipt } from "lucide-react";
import { GSTDateFilter, type DateRange } from "../GSTDateFilter";
import { SegmentedControl, type SegmentedOption } from "@/components/shell";

type SourceFilter = "all" | "purchases" | "expenses";

const SOURCE_OPTS: readonly SegmentedOption<SourceFilter>[] = [
  { value: "all", label: "All Sources", selectedClassName: "bg-white text-primary-700 shadow-sm dark:bg-primary-600 dark:text-white" },
  { value: "purchases", label: "Purchases Only", selectedClassName: "bg-white text-primary-700 shadow-sm dark:bg-primary-600 dark:text-white" },
  { value: "expenses", label: "Expenses Only", selectedClassName: "bg-white text-primary-700 shadow-sm dark:bg-primary-600 dark:text-white" },
];

export default function ITCRegisterPage() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  });
  const [source, setSource] = useState<SourceFilter>("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gst-itc", range.from, range.to, source, currentBranch?.id],
    queryFn: () => gstApi.getITCRegister({ from_date: range.from, to_date: range.to, source, branch: currentBranch?.id }),
  });

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6 text-green-600" /> ITC Register
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Input Tax Credit from purchases and opted-in expenses</p>
        </div>
        <GSTDateFilter onChange={setRange} />
      </div>

      {/* Source Filter */}
      <SegmentedControl
        aria-label="ITC source"
        value={source}
        onValueChange={setSource}
        options={SOURCE_OPTS}
        className="w-full sm:w-fit"
      />

      {/* Totals */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total CGST ITC", value: fmt(data.totals?.cgst) },
            { label: "Total SGST ITC", value: fmt(data.totals?.sgst) },
            { label: "Total ITC", value: fmt(data.totals?.total_itc) },
          ].map(s => (
            <div key={s.label} className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wider">{s.label}</p>
              <p className="text-xl font-bold text-green-700 mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {["Date", "Source", "Vendor", "GSTIN", "Invoice #", "Taxable", "CGST", "SGST", "Total ITC"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-400">Loading...</td></tr>
            ) : !data?.entries?.length ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-neutral-400">No ITC entries for this period.</td></tr>
            ) : (
              data.entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-700">{e.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.source === "PURCHASE" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                    }`}>
                      {e.source === "PURCHASE" ? <ShoppingCart className="w-3 h-3" /> : <Receipt className="w-3 h-3" />}
                      {e.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">{e.vendor || "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 font-mono text-xs">{e.vendor_gstin || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{e.invoice_number || "—"}</td>
                  <td className="px-4 py-3 text-right">{fmt(e.taxable_amount)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmt(e.cgst)}</td>
                  <td className="px-4 py-3 text-right text-green-700">{fmt(e.sgst)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(e.total_itc)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data?.entries?.length > 0 && (
            <tfoot className="bg-green-50 border-t border-green-200">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-bold text-green-800">Total</td>
                <td className="px-4 py-3 text-right font-bold text-green-800">{fmt(data.entries.reduce((s: number, e: any) => s + e.taxable_amount, 0))}</td>
                <td className="px-4 py-3 text-right font-bold text-green-800">{fmt(data.totals?.cgst)}</td>
                <td className="px-4 py-3 text-right font-bold text-green-800">{fmt(data.totals?.sgst)}</td>
                <td className="px-4 py-3 text-right font-bold text-green-800">{fmt(data.totals?.total_itc)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
