"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { TrendingUp, TrendingDown, CheckCircle2, AlertCircle, FileText, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui";
import { GSTDateFilter, type DateRange } from "./GSTDateFilter";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{label}</p>
      <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
      {sub && <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{sub}</p>}
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
            <div className="mt-4 flex gap-3 flex-wrap">
              <Link href="/gst/gstr1" className="inline-flex">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity ${
                    data.filing_status?.gstr1_filed
                      ? "bg-white/20 text-white"
                      : "bg-orange-400/40 text-white"
                  }`}
                >
                  {data.filing_status?.gstr1_filed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  GSTR-1 {data.filing_status?.gstr1_filed ? "Filed ✓" : "Pending →"}
                </span>
              </Link>
              <Link href="/gst/gstr3b" className="inline-flex">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity ${
                    data.filing_status?.gstr3b_filed
                      ? "bg-white/20 text-white"
                      : "bg-orange-400/40 text-white"
                  }`}
                >
                  {data.filing_status?.gstr3b_filed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  GSTR-3B {data.filing_status?.gstr3b_filed ? "Filed ✓" : "Pending →"}
                </span>
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/gst/gstr1">
              <Button variant="secondary" size="sm" leftIcon={<FileText className="h-4 w-4" />}>
                View GSTR-1
              </Button>
            </Link>
            <Link href="/gst/gstr3b">
              <Button variant="secondary" size="sm" leftIcon={<FileText className="h-4 w-4" />}>
                View GSTR-3B
              </Button>
            </Link>
            <Link href="/gst/hsn">
              <Button variant="secondary" size="sm" leftIcon={<BarChart2 className="h-4 w-4" />}>
                HSN Summary
              </Button>
            </Link>
            <Link href="/gst/itc">
              <Button variant="secondary" size="sm" leftIcon={<TrendingDown className="h-4 w-4" />}>
                Input Tax Credit
              </Button>
            </Link>
          </div>

          {/* Output GST */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Output Tax (Collected)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Taxable Amount" value={fmt(data.output?.taxable)} />
              <StatCard label="CGST Collected" value={fmt(data.output?.cgst)} />
              <StatCard label="SGST Collected" value={fmt(data.output?.sgst)} />
              <StatCard label="Total Output" value={fmt(data.output?.total)}
                sub={`${data.output?.invoice_count} invoices`} />
            </div>
          </div>

          {/* ITC */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-green-500" /> Input Tax Credit (Purchases + Expenses)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Purchase CGST" value={fmt(data.itc?.purchases_cgst)} />
              <StatCard label="Purchase SGST" value={fmt(data.itc?.purchases_sgst)} />
              <StatCard label="Expense CGST" value={fmt(data.itc?.expenses_cgst)} />
              <StatCard label="Total ITC" value={fmt(data.itc?.total)} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
