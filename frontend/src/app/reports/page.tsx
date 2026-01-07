"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Select,
  LoadingState,
  StatsCard,
} from "@/components/ui";
import { reportsApi } from "@/lib/api";
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  Download,
  Calendar,
  FileText,
  Activity,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type {
  TechnicianProductivityData,
  PendingJobsReportData,
} from "@/types";

// =====================================================
// Date Range Presets
// =====================================================

type DatePreset = "today" | "week" | "month" | "custom";

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const today = new Date();

  switch (preset) {
    case "today":
      return {
        from: format(today, "yyyy-MM-dd"),
        to: format(today, "yyyy-MM-dd"),
      };
    case "week":
      return {
        from: format(subDays(today, 7), "yyyy-MM-dd"),
        to: format(today, "yyyy-MM-dd"),
      };
    case "month":
      return {
        from: format(startOfMonth(today), "yyyy-MM-dd"),
        to: format(endOfMonth(today), "yyyy-MM-dd"),
      };
    default:
      return {
        from: format(subDays(today, 30), "yyyy-MM-dd"),
        to: format(today, "yyyy-MM-dd"),
      };
  }
}

// =====================================================
// Revenue Chart Component
// =====================================================

interface RevenueChartProps {
  fromDate: string;
  toDate: string;
}

function RevenueChart({ fromDate, toDate }: RevenueChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["revenue-report", fromDate, toDate],
    queryFn: () =>
      reportsApi.getRevenue({ from_date: fromDate, to_date: toDate }),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  const chartData = data.daily_breakdown || [];

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Revenue Overview
          </h3>
          <p className="text-sm text-neutral-500">Daily revenue breakdown</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600">
            ₹{data.total_revenue.toLocaleString("en-IN")}
          </p>
          <p className="text-sm text-neutral-500">
            {data.total_invoices} invoices
          </p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), "MMM dd")}
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
              stroke="#64748b"
              fontSize={12}
            />
            <Tooltip
              formatter={(value) => [
                `₹${Number(value).toLocaleString("en-IN")}`,
                "Revenue",
              ]}
              labelFormatter={(label) =>
                format(new Date(label), "MMM dd, yyyy")
              }
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-64 text-neutral-500">
          No revenue data for this period
        </div>
      )}
    </Card>
  );
}

// =====================================================
// Jobs by Status Chart
// =====================================================

function JobsByStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["pending-jobs-report"],
    queryFn: () => reportsApi.getPendingJobs(),
  });

  if (isLoading) return <LoadingState />;
  if (!data || data.length === 0) return null;

  const COLORS = ["#6366f1", "#f59e0b", "#f97316", "#06b6d4", "#22c55e"];

  const chartData = data.map((item, index) => ({
    name: item.status_label,
    value: item.count,
    color: COLORS[index % COLORS.length],
  }));

  const totalPending = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">
            Pending Jobs
          </h3>
          <p className="text-sm text-neutral-500">Jobs by current status</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary-600">{totalPending}</p>
          <p className="text-sm text-neutral-500">total pending</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [value, "Jobs"]}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm text-neutral-600">
              {item.name} ({item.value})
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// Technician Productivity Component
// =====================================================

interface TechnicianProductivityProps {
  fromDate: string;
  toDate: string;
}

function TechnicianProductivity({
  fromDate,
  toDate,
}: TechnicianProductivityProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["technician-productivity", fromDate, toDate],
    queryFn: () =>
      reportsApi.getTechnicianProductivity({
        from_date: fromDate,
        to_date: toDate,
      }),
  });

  if (isLoading) return <LoadingState />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">
          Technician Productivity
        </h3>
        <p className="text-neutral-500 text-center py-8">
          No technician data available
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary-500" />
        Technician Productivity
      </h3>

      <div className="space-y-4">
        {data.map((tech) => {
          const completionRate =
            tech.assigned_jobs > 0
              ? Math.round((tech.completed_jobs / tech.assigned_jobs) * 100)
              : 0;

          return (
            <div
              key={tech.technician_id}
              className="p-4 bg-neutral-50 rounded-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">
                    {tech.technician_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {tech.technician_name}
                    </p>
                    <p className="text-sm text-neutral-500">
                      Avg. {tech.avg_completion_days.toFixed(1)} days/job
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-600">
                    {completionRate}%
                  </p>
                  <p className="text-xs text-neutral-500">completion rate</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-semibold text-neutral-900">
                    {tech.assigned_jobs}
                  </p>
                  <p className="text-xs text-neutral-500">Assigned</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-green-600">
                    {tech.completed_jobs}
                  </p>
                  <p className="text-xs text-neutral-500">Completed</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-amber-600">
                    {tech.pending_jobs}
                  </p>
                  <p className="text-xs text-neutral-500">Pending</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${completionRate}%` }}
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
// GST Summary Component
// =====================================================

interface GstSummaryProps {
  fromDate: string;
  toDate: string;
}

function GstSummary({ fromDate, toDate }: GstSummaryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["gst-summary", fromDate, toDate],
    queryFn: () =>
      reportsApi.getGstSummary({ from_date: fromDate, to_date: toDate }),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary-500" />
        GST Summary
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <span className="text-neutral-600">Taxable Amount</span>
          <span className="font-medium text-neutral-900">
            ₹{data.taxable_amount.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <span className="text-neutral-600">CGST Collected</span>
          <span className="font-medium text-neutral-900">
            ₹{data.total_cgst.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <span className="text-neutral-600">SGST Collected</span>
          <span className="font-medium text-neutral-900">
            ₹{data.total_sgst.toLocaleString("en-IN")}
          </span>
        </div>
        {data.total_igst > 0 && (
          <div className="flex items-center justify-between py-3 border-b border-neutral-100">
            <span className="text-neutral-600">IGST Collected</span>
            <span className="font-medium text-neutral-900">
              ₹{data.total_igst.toLocaleString("en-IN")}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between py-3 bg-primary-50 px-4 rounded-lg -mx-4">
          <span className="font-semibold text-primary-900">Total Tax</span>
          <span className="font-bold text-primary-600 text-lg">
            ₹{data.total_tax.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Main Reports Page
// =====================================================

export default function ReportsPage() {
  const { currentBranch, hasPermission } = useAuth();
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");

  const dateRange =
    datePreset === "custom" && customFromDate && customToDate
      ? { from: customFromDate, to: customToDate }
      : getDateRange(datePreset);

  const handleExport = async (reportType: string) => {
    try {
      await reportsApi.exportExcel(reportType, {
        from_date: dateRange.from,
        to_date: dateRange.to,
        branch: currentBranch?.id,
      });
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  return (
    <ProtectedRoute requiredPermission="canViewReports">
      <AppLayout>
        <Header
          title="Reports & Analytics"
          subtitle="Business insights and performance metrics"
          actions={
            <Button
              variant="secondary"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => handleExport("revenue")}
            >
              Export Report
            </Button>
          }
        />

        <div className="p-6 space-y-6">
          {/* Date Range Selector */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-neutral-700">
                Period:
              </span>
              <div className="flex gap-2">
                {[
                  { value: "today", label: "Today" },
                  { value: "week", label: "Last 7 Days" },
                  { value: "month", label: "This Month" },
                  { value: "custom", label: "Custom" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDatePreset(opt.value as DatePreset)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      datePreset === opt.value
                        ? "bg-primary-500 text-white"
                        : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {datePreset === "custom" && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-neutral-400">to</span>
                  <Input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}

              <div className="ml-auto text-sm text-neutral-500">
                <Calendar className="w-4 h-4 inline mr-1" />
                {format(new Date(dateRange.from), "MMM dd, yyyy")} -{" "}
                {format(new Date(dateRange.to), "MMM dd, yyyy")}
              </div>
            </div>
          </Card>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueChart fromDate={dateRange.from} toDate={dateRange.to} />
            <JobsByStatusChart />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TechnicianProductivity
              fromDate={dateRange.from}
              toDate={dateRange.to}
            />
            <GstSummary fromDate={dateRange.from} toDate={dateRange.to} />
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
