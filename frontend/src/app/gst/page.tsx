"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { GSTDateFilter, type DateRange } from "./GSTDateFilter";

function StatCard({ label, value, sub, color = "neutral" }: {
  label: string; value: string; sub?: string; color?: "green" | "blue" | "red" | "neutral";
}) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    red: "bg-red-50 border-red-200 text-red-700",
    neutral: "bg-white border-neutral-200 text-neutral-700",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

export default function GSTDashboardPage() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gst-dashboard", range.from, range.to, currentBranch?.id],
    queryFn: () => gstApi.getDashboard({ from_date: range.from, to_date: range.to, branch: currentBranch?.id }),
  });

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">GST Dashboard</h1>
          <p className="text-sm text-neutral-500 mt-1">Net liability = Output GST − Input Tax Credit</p>
        </div>
        <GSTDateFilter onChange={setRange} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-neutral-400">Loading...</div>
      ) : data ? (
        <>
          {/* Net Payable Hero */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-2xl p-6 text-white">
            <p className="text-sm font-medium opacity-80">Net GST Payable</p>
            <p className="text-4xl font-bold mt-1">{fmt(data.net_payable?.total)}</p>
            <div className="flex gap-6 mt-4 text-sm opacity-80">
              <span>CGST: {fmt(data.net_payable?.cgst)}</span>
              <span>SGST: {fmt(data.net_payable?.sgst)}</span>
            </div>
            <div className="mt-4 flex gap-3">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                data.filing_status?.gstr1_filed ? "bg-white/20" : "bg-orange-400/40"
              }`}>
                {data.filing_status?.gstr1_filed
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />}
                GSTR-1 {data.filing_status?.gstr1_filed ? "Filed" : "Pending"}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                data.filing_status?.gstr3b_filed ? "bg-white/20" : "bg-orange-400/40"
              }`}>
                {data.filing_status?.gstr3b_filed
                  ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : <AlertCircle className="w-3.5 h-3.5" />}
                GSTR-3B {data.filing_status?.gstr3b_filed ? "Filed" : "Pending"}
              </div>
            </div>
          </div>

          {/* Output GST */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Output Tax (Collected)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Taxable Amount" value={fmt(data.output?.taxable)} color="neutral" />
              <StatCard label="CGST Collected" value={fmt(data.output?.cgst)} color="blue" />
              <StatCard label="SGST Collected" value={fmt(data.output?.sgst)} color="blue" />
              <StatCard label="Total Output" value={fmt(data.output?.total)}
                sub={`${data.output?.invoice_count} invoices`} color="blue" />
            </div>
          </div>

          {/* ITC */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-500" /> Input Tax Credit (Purchases + Expenses)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Purchase CGST" value={fmt(data.itc?.purchases_cgst)} color="green" />
              <StatCard label="Purchase SGST" value={fmt(data.itc?.purchases_sgst)} color="green" />
              <StatCard label="Expense CGST" value={fmt(data.itc?.expenses_cgst)} color="green" />
              <StatCard label="Total ITC" value={fmt(data.itc?.total)} color="green" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
