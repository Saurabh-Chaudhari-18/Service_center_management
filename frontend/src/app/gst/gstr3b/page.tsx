"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { GSTDateFilter, type DateRange } from "../GSTDateFilter";

export default function GSTR3BPage() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gstr3b", range.from, range.to, currentBranch?.id],
    queryFn: () => gstApi.getGSTR3BSummary({ from_date: range.from, to_date: range.to, branch: currentBranch?.id }),
  });

  const markFiled = useMutation({
    mutationFn: (returnType: "gstr1" | "gstr3b") =>
      gstApi.markFiled({ period_month: range.from.slice(0, 7) + "-01", return_type: returnType }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gst-dashboard"] }),
  });

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const d = data;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" /> GSTR-3B Summary
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Monthly return summary for filing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <GSTDateFilter onChange={setRange} />
          <button onClick={() => markFiled.mutate("gstr1")} disabled={markFiled.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-medium hover:bg-neutral-50 transition-colors">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Mark GSTR-1 Filed
          </button>
          <button onClick={() => markFiled.mutate("gstr3b")} disabled={markFiled.isPending}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Mark GSTR-3B Filed
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-neutral-400">Loading...</div>
      ) : d ? (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden font-mono text-sm">
          {/* Header */}
          <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
            <p className="text-xs text-orange-600 font-bold uppercase tracking-widest">Form GSTR-3B</p>
            <p className="font-semibold text-neutral-800 mt-0.5">{range.from} to {range.to}</p>
          </div>

          {/* 3.1 Outward */}
          <div className="px-6 py-5 border-b border-neutral-100">
            <p className="font-bold text-neutral-700 mb-3">3.1 — Outward Taxable Supplies</p>
            <div className="grid grid-cols-4 gap-4 text-xs text-neutral-500 font-sans font-semibold mb-2">
              <span>Description</span><span className="text-right">Taxable</span>
              <span className="text-right">CGST</span><span className="text-right">SGST</span>
            </div>
            <div className="grid grid-cols-4 gap-4 py-2 bg-neutral-50 rounded-lg px-3">
              <span className="text-neutral-700">(a) Taxable (other than zero rated)</span>
              <span className="text-right font-semibold">{fmt(d.table_3_1?.taxable_outward)}</span>
              <span className="text-right text-blue-700 font-semibold">{fmt(d.table_3_1?.cgst)}</span>
              <span className="text-right text-blue-700 font-semibold">{fmt(d.table_3_1?.sgst)}</span>
            </div>
          </div>

          {/* 4 ITC */}
          <div className="px-6 py-5 border-b border-neutral-100">
            <p className="font-bold text-neutral-700 mb-3">4 — Eligible ITC</p>
            <div className="space-y-2">
              {[
                { label: "Purchases ITC", cgst: d.table_4?.itc_purchases_cgst, sgst: d.table_4?.itc_purchases_sgst },
                { label: "Expense ITC",   cgst: d.table_4?.itc_expenses_cgst,  sgst: d.table_4?.itc_expenses_sgst },
              ].map(row => (
                <div key={row.label} className="grid grid-cols-4 gap-4 py-2 px-3">
                  <span className="text-neutral-600 font-sans">{row.label}</span>
                  <span />
                  <span className="text-right text-green-700 font-semibold">{fmt(row.cgst)}</span>
                  <span className="text-right text-green-700 font-semibold">{fmt(row.sgst)}</span>
                </div>
              ))}
              <div className="grid grid-cols-4 gap-4 py-2 bg-green-50 rounded-lg px-3 border border-green-200">
                <span className="text-green-800 font-bold font-sans">Total ITC</span>
                <span />
                <span className="text-right font-bold text-green-800">{fmt(d.table_4?.total_cgst)}</span>
                <span className="text-right font-bold text-green-800">{fmt(d.table_4?.total_sgst)}</span>
              </div>
            </div>
          </div>

          {/* Net Payable */}
          <div className="px-6 py-5 bg-orange-50">
            <p className="font-bold text-neutral-700 mb-3 font-sans">Net Tax Payable</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "CGST Payable", val: d.net_payable?.cgst },
                { label: "SGST Payable", val: d.net_payable?.sgst },
                { label: "Total Payable", val: d.net_payable?.total },
              ].map(s => (
                <div key={s.label} className="bg-white border border-orange-200 rounded-xl p-4 text-center">
                  <p className="text-xs text-orange-600 font-sans font-semibold uppercase">{s.label}</p>
                  <p className="text-xl font-bold text-orange-700 mt-1">{fmt(s.val)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
