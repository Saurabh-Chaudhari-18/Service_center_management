"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  StatsCard,
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
  Calendar,
  IndianRupee,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";
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

type DatePeriod = "this_month" | "last_30" | "this_year";

function getDateRange(period: DatePeriod) {
  const today = new Date();
  switch (period) {
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_30":
      return { from: subDays(today, 30), to: today };
    case "this_year":
      return { from: startOfYear(today), to: today };
  }
}

const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_30", label: "Last 30 Days" },
  { value: "this_year", label: "This Year" },
];

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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="block hover:scale-[1.02] transition-transform"
        >
          <StatsCard
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            variant={stat.variant}
          />
        </Link>
      ))}
    </div>
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
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Revenue Trend
          </h3>
          <p className="text-sm text-neutral-500">Daily revenue overview</p>
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
              <div className="absolute right-0 mt-1 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg z-20 py-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setPeriod(opt.value);
                      setShowPeriodMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                      period === opt.value
                        ? "text-primary-700 font-medium bg-primary-50"
                        : "text-neutral-700"
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

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingState />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <EmptyState
            icon={<TrendingUp className="w-8 h-8 text-neutral-400" />}
            title="No revenue data"
            description="Revenue data will appear as invoices are paid"
          />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
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
                  padding: "12px",
                }}
                formatter={(value: number) => [
                  `₹${value.toLocaleString("en-IN")}`,
                  "Revenue",
                ]}
                labelStyle={{ fontWeight: 600, color: "#1e293b" }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ fill: "#6366f1", r: 4, strokeWidth: 2, stroke: "#fff" }}
                activeDot={{
                  r: 6,
                  fill: "#6366f1",
                  stroke: "#fff",
                  strokeWidth: 3,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
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
    <Card className="h-full flex flex-col">
      <h3 className="text-lg font-semibold text-neutral-900 mb-6">
        Financial Summary
      </h3>
      <div className="flex-1 flex flex-col justify-center space-y-6">
        {/* Incoming */}
        <div className="text-center p-4 rounded-xl bg-green-50 border border-green-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">
              Collected
            </span>
          </div>
          <span className="text-2xl font-bold text-green-700">
            ₹{incoming.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Outgoing / Pending */}
        <div className="text-center p-4 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              Outstanding
            </span>
          </div>
          <span className="text-2xl font-bold text-amber-700">
            ₹{outstanding.toLocaleString("en-IN")}
          </span>
        </div>

        {/* Net */}
        <div className="text-center p-4 rounded-xl bg-primary-50 border border-primary-100">
          <div className="flex items-center justify-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">
              Total Invoiced
            </span>
          </div>
          <span className="text-2xl font-bold text-primary-700">
            ₹{totalInvoiced.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
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
      <h3 className="text-lg font-semibold text-neutral-900 mb-2">
        Jobs by Status
      </h3>
      <p className="text-sm text-neutral-500 mb-4">
        {data?.total_pending || 0} active jobs
      </p>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <LoadingState />
        </div>
      ) : chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center">
          <EmptyState
            icon={<FileText className="w-8 h-8 text-neutral-400" />}
            title="No active jobs"
            description="Job statistics will appear here"
          />
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
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
                formatter={(value: number, name: string) => [value, name]}
              />
              <Legend
                layout="vertical"
                verticalAlign="middle"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", lineHeight: "20px" }}
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
    <Card className="h-full">
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
      color: "bg-primary-500",
      visible: hasPermission("canCreateJobCards"),
    },
    {
      label: "Add Customer",
      icon: <Users className="w-5 h-5" />,
      href: "/customers/new",
      color: "bg-blue-500",
      visible: isRole("SUPER_ADMIN", "OWNER", "MANAGER", "RECEPTIONIST"),
    },
    {
      label: "Create Invoice",
      icon: <FileText className="w-5 h-5" />,
      href: "/billing/new",
      color: "bg-green-500",
      visible: hasPermission("canCreateInvoices"),
    },
    {
      label: "View Reports",
      icon: <TrendingUp className="w-5 h-5" />,
      href: "/reports",
      color: "bg-purple-500",
      visible: hasPermission("canViewReports"),
    },
    {
      label: "New Pickup",
      icon: <Truck className="w-5 h-5" />,
      href: "/pickups/new",
      color: "bg-cyan-500",
      visible: hasPermission("canViewPickups"),
    },
  ].filter((action) => action.visible);

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-neutral-50 transition-all"
          >
            <div
              className={`w-9 h-9 rounded-lg ${action.color} text-white flex items-center justify-center`}
            >
              {action.icon}
            </div>
            <span className="font-medium text-sm text-neutral-700">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </Card>
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
      jobsApi.list({ assigned_to: user?.id, ordering: "-created_at" }),
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
              ? `${currentBranch.name} Branch`
              : "Dashboard Overview"
          }
          actions={
            hasPermission("canCreateJobCards") ? (
              <Link href="/jobs/new">
                <Button leftIcon={<Plus className="w-4 h-4" />}>
                  New Job Card
                </Button>
              </Link>
            ) : undefined
          }
        />

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <DashboardStats />

          {/* Revenue Section */}
          {hasPermission("canViewReports") && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Revenue Chart - 2/3 width */}
              <div className="lg:col-span-2">
                <RevenueTrendChart />
              </div>
              {/* Financial Summary - 1/3 width */}
              <div>
                <RevenueSummary />
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Jobs - 2/3 width */}
            {hasPermission("canViewJobCards") && (
              <div className="lg:col-span-2">
                <RecentJobs />
              </div>
            )}

            {/* Right Sidebar */}
            <div className="space-y-6">
              {hasPermission("canViewJobCards") && <JobStatusChart />}
              <QuickActions />
              {hasPermission("canViewPickups") && <PendingPickups />}
              {hasPermission("canViewInventory") && <LowStockAlerts />}
              {isRole("TECHNICIAN") && <TechnicianJobs />}
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
