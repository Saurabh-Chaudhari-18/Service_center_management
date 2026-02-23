"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, Input, LoadingState } from "@/components/ui";
import { reportsApi } from "@/lib/api";
import {
  Users,
  Package,
  DollarSign,
  Download,
  Calendar,
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
  Legend,
} from "recharts";

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
  const totalRevenue = data.totals?.total_revenue || 0;
  const totalInvoices = data.totals?.total_invoices || 0;

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
            ₹{totalRevenue.toLocaleString("en-IN")}
          </p>
          <p className="text-sm text-neutral-500">{totalInvoices} invoices</p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) =>
                format(new Date(value), "MMM dd")
              }
              stroke="#64748b"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value: number) =>
                `₹${(value / 1000).toFixed(0)}k`
              }
              stroke="#64748b"
              fontSize={12}
            />
            <Tooltip
              formatter={(value: number) => [
                `₹${Number(value).toLocaleString("en-IN")}`,
                "Revenue",
              ]}
              labelFormatter={(label: string) =>
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
  if (!data || !data.by_status || data.by_status.length === 0) return null;

  const COLORS = ["#6366f1", "#f59e0b", "#f97316", "#06b6d4", "#22c55e"];

  const chartData = data.by_status.map(
    (item: { status: string; count: number }, index: number) => ({
      name: item.status.replace(/_/g, " "),
      value: item.count,
      color: COLORS[index % COLORS.length],
    }),
  );

  const totalPending = data.total_pending || 0;

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
            {chartData.map((entry: { color: string }, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [value, "Jobs"]}
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
        {chartData.map(
          (item: { name: string; value: number; color: string }) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-neutral-600">
                {item.name} ({item.value})
              </span>
            </div>
          ),
        )}
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
  if (!data || !data.technicians || data.technicians.length === 0) {
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
        {data.technicians.map(
          (tech: {
            technician_id: string;
            technician_name: string;
            jobs_completed: number;
            jobs_in_progress: number;
            total_assigned: number;
          }) => {
            const completionRate =
              tech.total_assigned > 0
                ? Math.round((tech.jobs_completed / tech.total_assigned) * 100)
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
                        {tech.total_assigned} total jobs
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
                      {tech.total_assigned}
                    </p>
                    <p className="text-xs text-neutral-500">Assigned</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-green-600">
                      {tech.jobs_completed}
                    </p>
                    <p className="text-xs text-neutral-500">Completed</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-amber-600">
                      {tech.jobs_in_progress}
                    </p>
                    <p className="text-xs text-neutral-500">In Progress</p>
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
          },
        )}
      </div>
    </Card>
  );
}

// =====================================================
// Inventory Overview Component
// =====================================================

interface InventoryOverviewProps {
  fromDate: string;
  toDate: string;
}

function InventoryOverview({ fromDate, toDate }: InventoryOverviewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["inventory-consumption", fromDate, toDate],
    queryFn: () =>
      reportsApi.getInventoryConsumption({
        from_date: fromDate,
        to_date: toDate,
      }),
  });

  if (isLoading) return <LoadingState />;
  if (!data || !data.top_items || data.top_items.length === 0) return null;

  const categoryData = data.by_category || [];
  const chartData = categoryData.map(
    (item: {
      inventory_item__category__name: string;
      total_value: number;
    }) => ({
      name: item.inventory_item__category__name || "Uncategorized",
      value: item.total_value || 0,
    }),
  );

  const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F"];

  return (
    <Card className="h-full">
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <Package className="w-5 h-5 text-primary-500" />
        Inventory Overview
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {chartData.length > 0 ? (
          <div className="h-64">
            <p className="text-sm text-neutral-500 mb-2 text-center">
              Consumption by Category
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((_entry: unknown, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `₹${Number(value).toLocaleString("en-IN")}`
                  }
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-neutral-500">
            No category data
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-neutral-500 mb-2">Top Consumed Items</p>
          {data.top_items.slice(0, 5).map(
            (
              item: {
                inventory_item__name: string;
                inventory_item__sku: string;
                total_quantity: number;
                total_value: number;
              },
              idx: number,
            ) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm"
              >
                <div
                  className="truncate pr-4"
                  title={item.inventory_item__name}
                >
                  <span className="font-medium text-neutral-700">
                    {idx + 1}. {item.inventory_item__name}
                  </span>
                  <p className="text-xs text-neutral-400">
                    {item.inventory_item__sku}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="font-medium block">
                    {item.total_quantity} units
                  </span>
                  <span className="text-xs text-neutral-500">
                    ₹{(item.total_value || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Customer Insights Component
// =====================================================

interface CustomerInsightsProps {
  fromDate: string;
  toDate: string;
}

function CustomerInsights({ fromDate, toDate }: CustomerInsightsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-analysis", fromDate, toDate],
    queryFn: () =>
      reportsApi.getCustomerAnalysis({ from_date: fromDate, to_date: toDate }),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return null;

  const topCustomers = data.top_customers || [];

  return (
    <Card className="h-full">
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <Users className="w-5 h-5 text-blue-500" />
        Customer Insights
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">
            {data.new_customers || 0}
          </p>
          <p className="text-xs text-blue-600 font-medium uppercase tracking-wider">
            New Customers
          </p>
        </div>
        <div className="p-4 bg-neutral-50 rounded-lg text-center">
          <p className="text-2xl font-bold text-neutral-700">
            {data.total_customers || 0}
          </p>
          <p className="text-xs text-neutral-500 font-medium uppercase tracking-wider">
            Total Active
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium text-neutral-500">
          Top Spending Customers
        </p>
        {topCustomers.length === 0 ? (
          <p className="text-neutral-400 text-center py-4">No customer data</p>
        ) : (
          topCustomers.slice(0, 5).map(
            (
              customer: {
                job__customer__first_name: string;
                job__customer__last_name: string;
                invoice_count: number;
                total_revenue: number;
              },
              idx: number,
            ) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                    {customer.job__customer__first_name?.[0] || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {customer.job__customer__first_name || ""}{" "}
                      {customer.job__customer__last_name || ""}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {customer.invoice_count || 0} invoices
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-green-600">
                  ₹{(customer.total_revenue || 0).toLocaleString("en-IN")}
                </p>
              </div>
            ),
          )
        )}
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

  const summary = data.summary || {};
  const taxable = summary.total_taxable || 0;
  const cgst = summary.total_cgst || 0;
  const sgst = summary.total_sgst || 0;
  const igst = summary.total_igst || 0;
  const totalTax = summary.total_tax || 0;

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-green-500" />
        GST Summary
      </h3>

      <div className="space-y-4">
        <div className="flex justify-between items-center py-2 border-b border-neutral-100">
          <span className="text-neutral-600">Taxable Amount</span>
          <span className="font-medium">
            ₹{taxable.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-neutral-100">
          <span className="text-neutral-600">CGST</span>
          <span className="font-medium text-neutral-900">
            ₹{cgst.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-neutral-100">
          <span className="text-neutral-600">SGST</span>
          <span className="font-medium text-neutral-900">
            ₹{sgst.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-neutral-100">
          <span className="text-neutral-600">IGST</span>
          <span className="font-medium text-neutral-900">
            ₹{igst.toLocaleString("en-IN")}
          </span>
        </div>
        <div className="flex justify-between items-center pt-2 font-bold text-lg">
          <span className="text-neutral-900">Total Tax</span>
          <span className="text-green-600">
            ₹{totalTax.toLocaleString("en-IN")}
          </span>
        </div>
      </div>
    </Card>
  );
}

// =====================================================
// Low Stock List Component
// =====================================================

function LowStockList() {
  const { data, isLoading } = useQuery({
    queryKey: ["low-stock-report"],
    queryFn: () => reportsApi.getLowStock(),
  });

  if (isLoading) return <LoadingState />;

  // Backend returns { total_items, items: [...] }
  const items = data?.items || (Array.isArray(data) ? data : []);
  if (items.length === 0) return null;

  return (
    <Card className="h-full">
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-red-500" />
        Low Stock Alerts
      </h3>

      <div className="space-y-4">
        {items.slice(0, 5).map(
          (
            item: {
              id?: string;
              name: string;
              sku: string;
              quantity: number;
              threshold?: number;
              low_stock_threshold?: number;
            },
            idx: number,
          ) => (
            <div
              key={item.id || idx}
              className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
            >
              <div>
                <p className="font-medium text-neutral-900">{item.name}</p>
                <p className="text-xs text-neutral-500">SKU: {item.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-red-600">
                  {item.quantity} /{" "}
                  {item.threshold || item.low_stock_threshold || 10}
                </p>
                <p className="text-xs text-red-500">In Stock</p>
              </div>
            </div>
          ),
        )}
        {items.length > 5 && (
          <p className="text-center text-sm text-neutral-500 pt-2">
            + {items.length - 5} more items
          </p>
        )}
      </div>
    </Card>
  );
}

// =====================================================
// Main Reports Content (exported as default)
// =====================================================

export default function ReportsContent() {
  const { currentBranch } = useAuth();
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
            <CustomerInsights fromDate={dateRange.from} toDate={dateRange.to} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InventoryOverview
              fromDate={dateRange.from}
              toDate={dateRange.to}
            />
            <div className="space-y-6">
              <GstSummary fromDate={dateRange.from} toDate={dateRange.to} />
              <LowStockList />
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
