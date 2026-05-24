"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { PageShell } from "@/components/shell/PageShell";
import {
  Card,
  JobStatusBadge,
  LoadingState,
  EmptyState,
  Button,
} from "@/components/ui";
import {
  jobsApi,
  billingApi,
  pickupsApi,
  reportsApi,
  inventoryApi,
} from "@/lib/api";
import {
  FileText,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  ArrowRight,
  Users,
  Truck,
  Package,
  ChevronDown,
  X,
  CheckCircle2,
  Sparkles,
  Wrench,
  PackageSearch,
} from "lucide-react";
import Link from "next/link";
import { format, subDays, startOfMonth, endOfMonth, startOfYear, subMonths } from "date-fns";
import type { JobCard, PickupRequest, InventoryItem } from "@/types";
import { PICKUP_STATUS_CONFIG, JOB_STATUS_CONFIG } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// =====================================================
// Date Period Helper
// =====================================================

type DatePeriod = "last_7_days" | "this_month" | "last_30" | "last_month" | "this_year";

function getDateRange(period: DatePeriod) {
  const today = new Date();
  switch (period) {
    case "last_7_days":
      return { from: subDays(today, 7), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_30":
      return { from: subDays(today, 30), to: today };
    case "last_month": {
      const prev = subMonths(today, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "this_year":
      return { from: startOfYear(today), to: today };
  }
}

const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "this_month",  label: "This Month"  },
  { value: "last_30",     label: "Last 30 Days" },
  { value: "last_month",  label: "Last Month"   },
  { value: "this_year",   label: "This Year"    },
];

// =====================================================
// Shop Briefing — "what's happening right now"
// =====================================================

function ShopBriefing() {
  const { currentBranch, hasPermission } = useAuth();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayLabel = format(new Date(), "EEEE, d MMM");

  const { data } = useQuery({
    queryKey: ["pending-jobs-report", currentBranch?.id],
    queryFn: () => reportsApi.getPendingJobs({ branch: currentBranch?.id }),
    enabled: !!currentBranch,
  });

  const { data: lowStockItems } = useQuery({
    queryKey: ["low-stock", currentBranch?.id],
    queryFn: () => inventoryApi.getLowStock(),
    enabled: !!currentBranch && hasPermission("canViewInventory"),
  });

  const byStatus = useMemo(() => {
    if (!data?.by_status) return {} as Record<string, number>;
    return Object.fromEntries(
      data.by_status.map((s: { status: string; count: number }) => [
        s.status,
        s.count,
      ]),
    );
  }, [data]);

  const readyCount = byStatus["READY_FOR_DELIVERY"] || 0;
  const inProgressCount = byStatus["REPAIR_IN_PROGRESS"] || 0;
  const waitingPartsCount = byStatus["WAITING_FOR_PARTS"] || 0;
  const needsAttentionCount =
    (byStatus["RECEIVED"] || 0) + (byStatus["DIAGNOSIS"] || 0);
  const lowStockCount = lowStockItems?.length || 0;
  const total = data?.total_pending || 0;

  if (!data || (total === 0 && lowStockCount === 0)) return null;

  const chips = [
    readyCount > 0 && {
      count: readyCount,
      label: "Ready to collect",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      cls: "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400",
      href: "/jobs?status=READY_FOR_DELIVERY",
      pulse: true,
    },
    inProgressCount > 0 && {
      count: inProgressCount,
      label: "In workshop",
      icon: <Wrench className="w-3.5 h-3.5" />,
      cls: "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-400",
      href: "/jobs?status=REPAIR_IN_PROGRESS",
      pulse: false,
    },
    waitingPartsCount > 0 && {
      count: waitingPartsCount,
      label: "Waiting for parts",
      icon: <PackageSearch className="w-3.5 h-3.5" />,
      cls: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400",
      href: "/jobs?status=WAITING_FOR_PARTS",
      pulse: false,
    },
    needsAttentionCount > 0 && {
      count: needsAttentionCount,
      label: "Need diagnosis",
      icon: <FileText className="w-3.5 h-3.5" />,
      cls: "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-400",
      href: "/jobs",
      pulse: false,
    },
    lowStockCount > 0 &&
      hasPermission("canViewInventory") && {
        count: lowStockCount,
        label: "Low stock",
        icon: <Package className="w-3.5 h-3.5" />,
        cls: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-400",
        href: "/inventory",
        pulse: false,
      },
  ].filter(
    (c): c is Exclude<typeof c, false | undefined | null | 0 | ""> => !!c,
  );

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white dark:bg-slate-900 dark:border-slate-700 p-4 md:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <p className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {dayLabel}
          </p>
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 mt-0.5">
            {greeting} — here&apos;s your shop right now
          </h2>
        </div>
        <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
          {total} active job{total !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Link
            key={chip.href + chip.label}
            href={chip.href}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${chip.cls}`}
          >
            {chip.icon}
            <span className="text-lg font-bold tabular-nums leading-none">
              {chip.count}
            </span>
            <span className="text-xs">{chip.label}</span>
            {chip.pulse && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Onboarding Checklist — shown only for new accounts
// =====================================================

function OnboardingChecklist() {
  const { currentBranch } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("onboarding_dismissed") === "true";
  });

  const { data } = useQuery({
    queryKey: ["total-jobs-count", currentBranch?.id],
    queryFn: () => jobsApi.list({ branch: currentBranch?.id, page_size: 1 }),
    enabled: !!currentBranch && !dismissed,
    staleTime: 5 * 60 * 1000,
  });

  const totalJobs = data?.count ?? -1;

  if (dismissed || totalJobs === -1 || totalJobs > 0) return null;

  const handleDismiss = () => {
    localStorage.setItem("onboarding_dismissed", "true");
    setDismissed(true);
  };

  const steps = [
    { label: "Account created", done: true, href: null },
    { label: "Add shop details & GSTIN", done: false, href: "/branches" },
    { label: "Set up SMS notifications", done: false, href: "/notifications" },
    { label: "Create your first job card", done: false, href: "/jobs/new" },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="rounded-2xl border-2 border-primary-200 bg-primary-50/40 dark:bg-primary-900/10 dark:border-primary-800/50 p-4 md:p-5 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Dismiss setup guide"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
            Welcome! Set up your service center
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Complete these steps to unlock the full value of your dashboard.
          </p>

          <div className="mt-3 h-1.5 bg-neutral-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((completed / steps.length) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {completed} of {steps.length} completed
          </p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {steps.map((step) => (
              <div key={step.label} className="flex items-center gap-2.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    step.done
                      ? "bg-primary-500"
                      : "border-2 border-neutral-300 dark:border-slate-600"
                  }`}
                >
                  {step.done && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  )}
                </div>
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {step.label}
                  </Link>
                ) : (
                  <span
                    className={`text-sm ${
                      step.done
                        ? "text-neutral-400 dark:text-neutral-600 line-through"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {step.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Dashboard Stats Component
// =====================================================

function DashboardStats() {
  const { currentBranch } = useAuth();

  const { data: pendingJobsData } = useQuery({
    queryKey: ["pending-jobs", currentBranch?.id],
    queryFn: () => jobsApi.getPending(),
    enabled: !!currentBranch,
  });

  const { data: invoiceStats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats(),
    enabled: !!currentBranch,
  });

  const { data: pickupStats } = useQuery({
    queryKey: ["pickup-stats", currentBranch?.id],
    queryFn: () => pickupsApi.getStats(),
    enabled: !!currentBranch,
  });

  const stats = [
    {
      label: "Pending Jobs",
      value: pendingJobsData?.count || 0,
      icon: <FileText className="w-6 h-6 text-primary-600" />,
      variant: "primary" as const,
      href: "/jobs",
    },
    {
      label: "Total Revenue",
      value: `₹${(invoiceStats?.total_paid || 0).toLocaleString("en-IN")}`,
      icon: <DollarSign className="w-6 h-6 text-green-600" />,
      variant: "success" as const,
      href: "/billing",
    },
    {
      label: "Pending Payments",
      value: `₹${(invoiceStats?.total_pending || 0).toLocaleString("en-IN")}`,
      icon: <Clock className="w-6 h-6 text-amber-600" />,
      variant: "warning" as const,
      href: "/billing?status=PENDING",
    },
    {
      label: "Pending Pickups",
      value: pickupStats?.pending || 0,
      icon: <Truck className="w-6 h-6 text-indigo-600" />,
      variant: "accent" as const,
      href: "/pickups",
    },
  ];

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-neutral-900">Overview Stats</h3>
        <p className="text-xs text-neutral-400 mt-0.5">Live counts · All-time financials</p>
      </div>
      <div className="flex flex-col space-y-1">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="flex justify-between items-center p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg stats-icon-${stat.variant}`}>
                {stat.icon}
              </div>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {stat.label}
              </span>
            </div>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              {stat.value}
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// Revenue Trend Chart Component
// =====================================================

function RevenueTrendChart() {
  const { currentBranch } = useAuth();
  const [period, setPeriod] = useState<DatePeriod>("this_month");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  // Reuses the cache from DashboardStats — no extra network request
  const { data: invoiceStats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats(),
    enabled: !!currentBranch,
  });

  const { data: revenueData, isLoading } = useQuery({
    queryKey: [
      "revenue-report",
      currentBranch?.id,
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd"),
    ],
    queryFn: () =>
      reportsApi.getRevenue({
        from_date: format(dateRange.from, "yyyy-MM-dd"),
        to_date: format(dateRange.to, "yyyy-MM-dd"),
        branch: currentBranch?.id,
      }),
    enabled: !!currentBranch,
  });

  const chartData = useMemo(() => {
    if (!revenueData?.daily_breakdown) return [];
    return revenueData.daily_breakdown.map((d) => ({
      date: format(new Date(d.date), period === "this_year" ? "MMM" : "dd MMM"),
      revenue: d.revenue,
      invoices: d.invoices,
    }));
  }, [revenueData, period]);

  const currentLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label;

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Revenue Trend
          </h3>
          <p className="text-sm text-neutral-500">Monthly earnings analysis</p>
        </div>
        {/* Period Selector */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodMenu(!showPeriodMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
          >
            {currentLabel}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showPeriodMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPeriodMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-20 py-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setPeriod(opt.value);
                      setShowPeriodMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors ${
                      period === opt.value
                        ? "text-primary-700 font-medium bg-primary-50 dark:bg-primary-900/30"
                        : "text-neutral-700 dark:text-neutral-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Financial summary — replaces the standalone RevenueSummary card */}
      {invoiceStats && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 pb-3 border-b border-neutral-100 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Collected</span>
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              ₹{(invoiceStats.total_paid || 0).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Outstanding</span>
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              ₹{(invoiceStats.total_pending || 0).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-400" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Total invoiced</span>
            <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              ₹{(invoiceStats.total_invoiced || 0).toLocaleString("en-IN")}
            </span>
          </div>
          <Link href="/reports" className="ml-auto text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline">
            Statement →
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 min-h-[12rem] sm:min-h-[16rem] flex items-center justify-center">
          <LoadingState />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex-1 min-h-[12rem] sm:min-h-[16rem] flex items-center justify-center">
          <EmptyState
            icon={<TrendingUp className="w-8 h-8 text-neutral-400" />}
            title="No revenue data"
            description="Revenue data will appear as invoices are paid"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-[12rem] sm:min-h-[16rem] relative">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={{ stroke: "#e2e8f0" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) =>
                    val >= 1000 ? `₹${(val / 1000).toFixed(0)}K` : `₹${val}`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    padding: "10px 14px",
                    fontSize: "13px",
                  }}
                  formatter={(value: number | undefined) =>
                    [`₹${(value ?? 0).toLocaleString("en-IN")}`, "Revenue"]
                  }
                  labelStyle={{ fontWeight: 600, color: "#1e293b" }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ fill: "#6366f1", r: 3, strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{
                    r: 5,
                    fill: "#6366f1",
                    stroke: "#fff",
                    strokeWidth: 3,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Revenue Summary Card
// =====================================================

function RevenueSummary() {
  const { currentBranch } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats(),
    enabled: !!currentBranch,
  });

  const incoming = stats?.total_paid || 0;
  const outstanding = stats?.total_pending || 0;
  const totalInvoiced = stats?.total_invoiced || 0;

  return (
    <Card className="flex flex-col">
      <h3 className="text-lg font-semibold text-neutral-900 mb-1">
        Financial Summary
      </h3>
      <p className="text-sm text-neutral-500 mb-4">Real-time billing status</p>

      <div className="flex-1 flex flex-col justify-between space-y-3">
        {/* Collected */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-green-700">Collected</span>
          </div>
          <span className="text-lg font-bold text-green-700">
            ₹{incoming.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Outstanding */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-sm font-medium text-amber-700">Outstanding</span>
          </div>
          <span className="text-lg font-bold text-amber-700">
            ₹{outstanding.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Total Invoiced */}
        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-700">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-600">Total Invoiced</span>
            <span className="text-xl font-bold text-neutral-900">
              ₹{totalInvoiced.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Generate Statement Button */}
        <Link href="/reports">
          <Button className="w-full mt-1" size="md">
            Generate Statement
          </Button>
        </Link>
      </div>
    </Card>
  );
}

// =====================================================
// Net Profit Widget
// =====================================================

function NetProfitWidget() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const from_date = format(startOfMonth(today), "yyyy-MM-dd");
  const to_date = format(today, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["net-profit", currentBranch?.id, from_date],
    queryFn: () =>
      reportsApi.getNetProfit({
        from_date,
        to_date,
        branch: currentBranch?.id,
      }),
    enabled: !!currentBranch,
  });

  const revenue = data?.revenue || 0;
  const expenses = data?.expenses || 0;
  const netProfit = data?.net_profit || 0;
  const margin = data?.profit_margin || 0;
  const isPositive = netProfit >= 0;

  return (
    <Card className="flex flex-col">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
        Net Profit
      </h3>
      <p className="text-sm text-neutral-500 mb-4">This month so far</p>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-6">
          <LoadingState />
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-3">
          {/* Revenue */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Revenue</span>
            </div>
            <span className="text-base font-bold text-green-700 dark:text-green-300">
              ₹{Number(revenue).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Expenses */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Expenses</span>
            </div>
            <span className="text-base font-bold text-red-700 dark:text-red-300">
              ₹{Number(expenses).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Net Profit */}
          <div
            className={`flex items-center justify-between p-3 rounded-xl border ${
              isPositive
                ? "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700"
                : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
            }`}
          >
            <span className={`text-sm font-bold ${
              isPositive ? "text-violet-700 dark:text-violet-300" : "text-amber-700 dark:text-amber-300"
            }`}>Net Profit</span>
            <span className={`text-lg font-bold ${
              isPositive ? "text-violet-700 dark:text-violet-300" : "text-amber-700 dark:text-amber-300"
            }`}>
              ₹{Math.abs(netProfit).toLocaleString("en-IN")}
            </span>
          </div>

          {/* Profit Margin Bar */}
          <div>
            <div className="flex justify-between text-xs text-neutral-500 mb-1">
              <span>Profit Margin</span>
              <span className={isPositive ? "text-violet-600 font-semibold" : "text-amber-600 font-semibold"}>
                {margin}%
              </span>
            </div>
            <div className="h-2 bg-neutral-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isPositive ? "bg-violet-500" : "bg-amber-500"
                }`}
                style={{ width: `${Math.min(Math.abs(margin), 100)}%` }}
              />
            </div>
          </div>

          <Link href="/expenses" className="text-center text-xs text-violet-600 dark:text-violet-400 hover:underline">
            Manage Expenses →
          </Link>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Job Status Donut Chart
// =====================================================

function JobStatusChart() {
  const { currentBranch } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["pending-jobs-report", currentBranch?.id],
    queryFn: () => reportsApi.getPendingJobs({ branch: currentBranch?.id }),
    enabled: !!currentBranch,
  });

  const chartData = useMemo(() => {
    if (!data?.by_status) return [];
    return data.by_status
      .filter((s) => s.count > 0)
      .map((s) => {
        const config =
          JOB_STATUS_CONFIG[s.status as keyof typeof JOB_STATUS_CONFIG];
        return {
          name: config?.label || s.status,
          value: s.count,
          color: config?.color || "#94a3b8",
        };
      });
  }, [data]);

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-1">
        Jobs by Status
      </h3>
      <p className="text-sm text-neutral-500 mb-3">
        {data?.total_pending || 0} active jobs
      </p>

      {isLoading ? (
        <div className="h-36 flex items-center justify-center">
          <LoadingState />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-28 sm:h-36 flex items-center justify-center">
          <EmptyState
            icon={<FileText className="w-8 h-8 text-neutral-400" />}
            title="No active jobs"
            description="Job statistics will appear here"
          />
        </div>
      ) : (
        <div className="h-32 sm:h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="35%"
                cy="50%"
                innerRadius={35}
                outerRadius={60}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                  padding: "8px 12px",
                  fontSize: "13px",
                }}
                formatter={(value: number | undefined, name: string | undefined) => [value ?? 0, name ?? ""]}
              />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", lineHeight: "18px" }}
                formatter={(value) => (
                  <span className="text-neutral-700 dark:text-neutral-300 font-medium ml-1">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Recent Jobs Component
// =====================================================

function RecentJobs() {
  const { currentBranch } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["recent-jobs", currentBranch?.id],
    queryFn: () => jobsApi.list({ branch: currentBranch?.id, page: 1 }),
    enabled: !!currentBranch,
  });

  const recentJobs = data?.results?.slice(0, 5) || [];

  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Recent Job Cards
          </h3>
          <p className="text-sm text-neutral-500">Latest service requests</p>
        </div>
        <Link href="/jobs">
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            View All
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : recentJobs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-neutral-400" />}
          title="No job cards yet"
          description="Create your first job card to get started"
        />
      ) : (
        <div className="space-y-3">
          {recentJobs.map((job: JobCard) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block p-4 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-neutral-900">
                      {job.job_number}
                    </span>
                    <JobStatusBadge status={job.status} />
                    {job.is_urgent && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600 truncate">
                    {job.customer?.first_name} {job.customer?.last_name} •{" "}
                    {job.brand} {job.model}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {format(new Date(job.created_at), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Quick Actions Component
// =====================================================

function QuickActions() {
  const { hasPermission, isRole } = useAuth();

  const actions = [
    {
      label: "New Job Card",
      icon: <Plus className="w-5 h-5" />,
      href: "/jobs/new",
      iconClass: "bg-gradient-to-br from-indigo-500 to-violet-600",
      visible: hasPermission("canCreateJobCards"),
    },
    {
      label: "Add Customer",
      icon: <Users className="w-5 h-5" />,
      href: "/customers/new",
      iconClass: "bg-gradient-to-br from-blue-500 to-indigo-600",
      visible: isRole("SUPER_ADMIN", "OWNER", "MANAGER", "RECEPTIONIST"),
    },
    {
      label: "Create Invoice",
      icon: <FileText className="w-5 h-5" />,
      href: "/billing/new",
      iconClass: "bg-gradient-to-br from-violet-500 to-purple-600",
      visible: hasPermission("canCreateInvoices"),
    },
    {
      label: "View Reports",
      icon: <TrendingUp className="w-5 h-5" />,
      href: "/reports",
      iconClass: "bg-gradient-to-br from-blue-500 to-cyan-600",
      visible: hasPermission("canViewReports"),
    },
    {
      label: "New Pickup",
      icon: <Truck className="w-5 h-5" />,
      href: "/pickups/new",
      iconClass: "bg-gradient-to-br from-cyan-500 to-blue-600",
      visible: hasPermission("canViewPickups"),
    },
  ].filter((a) => a.visible);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {actions.map((action) => (
        <Link key={action.label} href={action.href} className="block group">
          <Card className="h-full hover:border-primary-200 hover:shadow-md transition-all flex flex-col items-center justify-center p-5 text-center dark:hover:border-indigo-500/50">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-3 shadow-sm group-hover:scale-105 transition-transform ${action.iconClass}`}
            >
              {action.icon}
            </div>
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 text-sm">
              {action.label}
            </span>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// =====================================================
// Pending Pickups Component
// =====================================================

function PendingPickups() {
  const { currentBranch, hasPermission } = useAuth();

  const { data } = useQuery({
    queryKey: ["pending-pickups", currentBranch?.id],
    queryFn: () =>
      pickupsApi.list({
        status: "REQUESTED",
        ordering: "-is_urgent,-created_at",
      }),
    enabled: !!currentBranch && hasPermission("canViewPickups"),
  });

  const pendingPickups = data?.results || [];

  if (!hasPermission("canViewPickups") || pendingPickups.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-indigo-500">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-neutral-900">Pending Pickups</h3>
          <p className="text-sm text-neutral-600 mt-1">
            {pendingPickups.length} pickup
            {pendingPickups.length !== 1 ? "s" : ""} awaiting assignment
          </p>
          <div className="mt-3 space-y-2">
            {pendingPickups.slice(0, 4).map((pickup: PickupRequest) => (
              <Link
                key={pickup.id}
                href={`/pickups/${pickup.id}`}
                className="flex items-center justify-between text-sm p-2 -mx-2 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {pickup.is_urgent && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-neutral-700 truncate">
                    {pickup.customer_name}
                  </span>
                </div>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
                  style={{
                    backgroundColor:
                      PICKUP_STATUS_CONFIG[pickup.status].bgColor,
                    color: PICKUP_STATUS_CONFIG[pickup.status].textColor,
                  }}
                >
                  {PICKUP_STATUS_CONFIG[pickup.status].label}
                </span>
              </Link>
            ))}
          </div>
          <Link href="/pickups">
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              View All Pickups
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Low Stock Alerts Component
// =====================================================

function LowStockAlerts() {
  const { currentBranch, hasPermission } = useAuth();

  const { data: lowStockItems } = useQuery({
    queryKey: ["low-stock", currentBranch?.id],
    queryFn: () => inventoryApi.getLowStock(),
    enabled: !!currentBranch && hasPermission("canViewInventory"),
  });

  if (!hasPermission("canViewInventory") || !lowStockItems?.length) return null;

  return (
    <Card className="border-l-4 border-l-amber-500">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Package className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-neutral-900">Low Stock Alert</h3>
          <p className="text-sm text-neutral-600 mt-1">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""}{" "}
            running low
          </p>
          <div className="mt-3 space-y-2">
            {lowStockItems.slice(0, 4).map((item: InventoryItem) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm p-2 -mx-2 rounded-lg"
              >
                <span className="text-neutral-700 truncate">{item.name}</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    item.quantity === 0
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {item.quantity} left
                </span>
              </div>
            ))}
          </div>
          <Link href="/inventory">
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              View Inventory
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Technician Assigned Jobs Component
// =====================================================

function TechnicianJobs() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["technician-jobs", user?.id],
    queryFn: () =>
      jobsApi.list({ technician: user?.id }),
    enabled: !!user,
  });

  const jobs = data?.results?.slice(0, 5) || [];

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-neutral-900">
          My Assigned Jobs
        </h3>
        <Link href="/jobs">
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            View All
          </Button>
        </Link>
      </div>
      {isLoading ? (
        <LoadingState />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8 text-neutral-400" />}
          title="No assigned jobs"
          description="You have no jobs assigned at the moment."
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job: JobCard) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block p-4 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-medium text-neutral-900">
                      {job.job_number}
                    </span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <p className="mt-1 text-sm text-neutral-600 truncate">
                    {job.customer?.first_name} {job.customer?.last_name} •{" "}
                    {job.brand} {job.model}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {format(new Date(job.created_at), "MMM dd, yyyy h:mm a")}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Main Dashboard Page
// =====================================================

export default function DashboardPage() {
  const { user, currentBranch, hasPermission, isRole, organizationBranding } =
    useAuth();
  const [revenueOpen, setRevenueOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(true);

  return (
    <ProtectedRoute requiredPermission="canViewDashboard">
      <AppLayout>
        <Header
          title={
            organizationBranding?.name &&
            organizationBranding.name !== "ServiceHub"
              ? organizationBranding.name
              : `Welcome, ${user?.first_name}!`
          }
          subtitle={
            currentBranch
              ? currentBranch.name
              : "Dashboard Overview"
          }
          actions={
            hasPermission("canCreateJobCards") ? (
              <div className="flex items-center gap-3">
                <Link href="/jobs/new">
                  <Button leftIcon={<Plus className="w-4 h-4" />}>
                    New Job Card
                  </Button>
                </Link>
              </div>
            ) : undefined
          }
        />

        <PageShell className="space-y-5">
          {/* Shop Briefing — actionable status overview */}
          {hasPermission("canViewJobCards") && <ShopBriefing />}

          {/* Onboarding checklist — only for new accounts */}
          <OnboardingChecklist />

          {/* Quick Actions */}
          <section aria-label="Quick actions">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Quick Actions
            </p>
            <QuickActions />
          </section>

          {/* Jobs & Stats */}
          <section aria-label="Jobs and statistics">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Jobs &amp; Activity
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 min-w-0">
                {hasPermission("canViewJobCards") && <RecentJobs />}
                {isRole("TECHNICIAN") && <TechnicianJobs />}
              </div>
              <div className="space-y-5">
                <DashboardStats />
                {hasPermission("canViewJobCards") && <JobStatusChart />}
              </div>
            </div>
          </section>

          {/* Revenue & Financials — collapsible */}
          {hasPermission("canViewReports") && (
            <section aria-label="Revenue and financials">
              <button
                type="button"
                onClick={() => setRevenueOpen((v) => !v)}
                aria-expanded={revenueOpen}
                className="mb-3 flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <p className="flex-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Revenue &amp; Financials
                </p>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${revenueOpen ? "rotate-180" : ""}`}
                />
              </button>
              {revenueOpen && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2 min-w-0">
                    <RevenueTrendChart />
                  </div>
                  <div>
                    <NetProfitWidget />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Alerts Row — collapsible */}
          {(hasPermission("canViewPickups") || hasPermission("canViewInventory")) && (
            <section aria-label="Alerts">
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                aria-expanded={alertsOpen}
                className="mb-3 flex w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <p className="flex-1 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Alerts
                </p>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-neutral-400 transition-transform duration-200 ${alertsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {alertsOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {hasPermission("canViewInventory") && <LowStockAlerts />}
                  {hasPermission("canViewPickups") && <PendingPickups />}
                </div>
              )}
            </section>
          )}
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
