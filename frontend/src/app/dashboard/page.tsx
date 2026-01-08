"use client";

import React from "react";
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
import { jobsApi, billingApi, inventoryApi } from "@/lib/api";
import {
  FileText,
  DollarSign,
  Package,
  Clock,
  TrendingUp,
  AlertTriangle,
  Plus,
  ArrowRight,
  Users,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobCard } from "@/types";

// =====================================================
// Dashboard Stats Component
// =====================================================

function DashboardStats() {
  const { currentBranch } = useAuth();

  // Fetch pending jobs count
  // Fetch pending jobs
  const { data: pendingJobsData } = useQuery({
    queryKey: ["pending-jobs", currentBranch?.id],
    queryFn: () => jobsApi.getPending(),
    enabled: !!currentBranch,
  });

  // Fetch invoice stats
  const { data: invoiceStats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats(),
    enabled: !!currentBranch,
  });

  // Fetch inventory stats
  const { data: inventoryStats } = useQuery({
    queryKey: ["inventory-stats", currentBranch?.id],
    queryFn: () => inventoryApi.getStats(),
    enabled: !!currentBranch,
  });

  const stats = [
    {
      label: "Pending Jobs",
      value: pendingJobsData?.count || 0,
      icon: <FileText className="w-6 h-6 text-primary-600" />,
      variant: "primary" as const,
    },
    {
      label: "Total Revenue",
      value: `₹${(invoiceStats?.total_paid || 0).toLocaleString("en-IN")}`,
      icon: <DollarSign className="w-6 h-6 text-green-600" />,
      variant: "success" as const,
    },
    {
      label: "Pending Payments",
      value: `₹${(invoiceStats?.total_pending || 0).toLocaleString("en-IN")}`,
      icon: <Clock className="w-6 h-6 text-amber-600" />,
      variant: "warning" as const,
    },
    {
      label: "Low Stock Items",
      value: inventoryStats?.low_stock_count || 0,
      icon: <Package className="w-6 h-6 text-red-600" />,
      variant: "danger" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <StatsCard
          key={stat.label}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          variant={stat.variant}
        />
      ))}
    </div>
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
        <div className="space-y-4">
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
      visible: isRole("OWNER", "MANAGER", "RECEPTIONIST"),
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
            className="flex items-center gap-3 p-4 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-neutral-50 transition-all"
          >
            <div
              className={`w-10 h-10 rounded-lg ${action.color} text-white flex items-center justify-center`}
            >
              {action.icon}
            </div>
            <span className="font-medium text-neutral-700">{action.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// Low Stock Alert Component
// =====================================================

function LowStockAlert() {
  const { hasPermission } = useAuth();

  const { data: lowStockItems = [] } = useQuery({
    queryKey: ["low-stock-items"],
    queryFn: () => inventoryApi.getLowStock(),
    enabled: hasPermission("canViewInventory"),
  });

  if (!hasPermission("canViewInventory") || lowStockItems.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-amber-500">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-neutral-900">Low Stock Alert</h3>
          <p className="text-sm text-neutral-600 mt-1">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? "s" : ""}{" "}
            running low on stock
          </p>
          <div className="mt-3 space-y-2">
            {lowStockItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-neutral-700">{item.name}</span>
                <span className="font-medium text-red-600">
                  {item.quantity} left
                </span>
              </div>
            ))}
          </div>
          <Link href="/inventory?filter=low_stock">
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              View All
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Job Status Summary Component
// =====================================================

function JobStatusSummary() {
  const { currentBranch } = useAuth();

  const { data } = useQuery({
    queryKey: ["pending-jobs", currentBranch?.id],
    queryFn: () => jobsApi.getPending(),
    enabled: !!currentBranch,
  });

  const jobs = data?.results || [];

  // Group by status
  const statusCounts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusItems = [
    { status: "RECEIVED", label: "Received", color: "bg-blue-500" },
    { status: "DIAGNOSIS", label: "Diagnosis", color: "bg-amber-500" },
    {
      status: "WAITING_FOR_PARTS",
      label: "Waiting Parts",
      color: "bg-orange-500",
    },
    {
      status: "REPAIR_IN_PROGRESS",
      label: "In Progress",
      color: "bg-cyan-500",
    },
    { status: "READY_FOR_DELIVERY", label: "Ready", color: "bg-green-500" },
  ];

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-4">
        Jobs by Status
      </h3>
      <div className="space-y-3">
        {statusItems.map((item) => {
          const count = statusCounts[item.status] || 0;
          const percentage = jobs.length > 0 ? (count / jobs.length) * 100 : 0;

          return (
            <div key={item.status} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{item.label}</span>
                <span className="font-medium text-neutral-900">{count}</span>
              </div>
              <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// =====================================================
// Main Dashboard Page
// =====================================================

export default function DashboardPage() {
  const { user, currentBranch } = useAuth();

  return (
    <ProtectedRoute requiredPermission="canViewDashboard">
      <AppLayout>
        <Header
          title={`Welcome back, ${user?.first_name}!`}
          subtitle={
            currentBranch
              ? `${currentBranch.name} Branch`
              : "Dashboard Overview"
          }
          actions={
            <Link href="/jobs/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>
                New Job Card
              </Button>
            </Link>
          }
        />

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <DashboardStats />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Jobs - Takes 2 columns */}
            <div className="lg:col-span-2">
              <RecentJobs />
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              <QuickActions />
              <JobStatusSummary />
              <LowStockAlert />
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
