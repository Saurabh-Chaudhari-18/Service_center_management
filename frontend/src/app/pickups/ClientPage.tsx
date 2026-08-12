"use client";

// Focused interactive island below the server route boundary.

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  StatsCard,
  LoadingState,
  EmptyState,
  Button,
  Input,
  Badge,
  PickupStatusBadge,
} from "@/components/ui";
import {
  PageShell,
  PaginationFooter,
  RegisterToolbar,
  WorkspaceSurface,
} from "@/components/shell";
import { pickupsApi } from "@/lib/api";
import {
  Truck,
  Plus,
  Phone,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Search,
  ArrowRight,
  User,
} from "lucide-react";
import Link from "next/link";
import { formatPhone, formatDate } from "@/lib/formatters";
import type { PickupRequest } from "@/types";

// =====================================================
// Status Filter Tabs
// =====================================================

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "REQUESTED", label: "Requested" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "EN_ROUTE", label: "En Route" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "DELIVERED_TO_CENTER", label: "At Center" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

// =====================================================
// Stats Section
// =====================================================

function PickupStats() {
  const { currentBranch } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["pickup-stats", currentBranch?.id],
    queryFn: () => pickupsApi.getStats(),
    enabled: !!currentBranch,
  });

  const statCards = [
    {
      label: "Pending Pickups",
      value: stats?.pending || 0,
      icon: <Truck className="w-6 h-6 text-primary-600" />,
      variant: "primary" as const,
    },
    {
      label: "En Route",
      value: stats?.en_route || 0,
      icon: <MapPin className="w-6 h-6 text-cyan-600" />,
      variant: "accent" as const,
    },
    {
      label: "At Center",
      value: stats?.delivered_to_center || 0,
      icon: <Clock className="w-6 h-6 text-green-600" />,
      variant: "success" as const,
    },
    {
      label: "Total Completed",
      value: stats?.completed || 0,
      icon: <Calendar className="w-6 h-6 text-amber-600" />,
      variant: "warning" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((s) => (
        <StatsCard
          key={s.label}
          label={s.label}
          value={s.value}
          icon={s.icon}
          variant={s.variant}
        />
      ))}
    </div>
  );
}

// =====================================================
// Main Page
// =====================================================

const PICKUPS_PAGE_SIZE = 10;

export default function PickupsPage() {
  const { currentBranch } = useAuth();
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["pickups", currentBranch?.id, activeTab, searchQuery, currentPage],
    queryFn: () =>
      pickupsApi.list({
        branch: currentBranch?.id,
        ...(activeTab !== "ALL" ? { status: activeTab } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        page: currentPage,
        page_size: PICKUPS_PAGE_SIZE,
      }),
    enabled: !!currentBranch,
  });

  const router = useRouter();
  const pickups = data?.results || [];
  const totalCount = data?.count ?? pickups.length;
  const hasNextPage = !!(data?.next);
  const hasPrevPage = !!(data?.previous);

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title="Pickup & Drop"
          subtitle="Manage device pickup requests from customers"
          actions={
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => router.push("/pickups/new")}
            >
              New Pickup Request
            </Button>
          }
        />

        <PageShell width="fluid">
          <PickupStats />

          <RegisterToolbar
            filters={
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.value);
                      setCurrentPage(1);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                      activeTab === tab.value
                        ? "bg-primary-500 text-white shadow-sm"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-700 dark:text-neutral-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
            search={
              <Input
                type="text"
                placeholder="Search pickups..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="h-4 w-4" />}
                aria-label="Search pickups"
                className="py-3 text-sm"
              />
            }
          />

          <WorkspaceSurface>
            {isLoading ? (
              <div className="p-8">
                <LoadingState message="Loading pickups…" />
              </div>
            ) : pickups.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Truck className="h-8 w-8 text-neutral-400" />}
                  title="No pickup requests found"
                  description="Create a new pickup request when a customer calls"
                />
              </div>
            ) : (
              <div className="min-w-0">

                {/* Desktop table — lg+ */}
                <div className="hidden lg:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                        <th scope="col" className="px-4 py-3">Pickup #</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3">Urgent</th>
                        <th scope="col" className="px-4 py-3">Customer</th>
                        <th scope="col" className="px-4 py-3">Mobile</th>
                        <th scope="col" className="px-4 py-3">Device</th>
                        <th scope="col" className="px-4 py-3">Date</th>
                        <th scope="col" className="px-4 py-3">Time Slot</th>
                        <th scope="col" className="px-4 py-3">Technician</th>
                        <th scope="col" className="w-8 px-2 py-3" aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody className="text-neutral-800 dark:text-slate-200">
                      {pickups.map((pickup: PickupRequest) => (
                        <tr
                          key={pickup.id}
                          className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                          onClick={() => router.push(`/pickups/${pickup.id}`)}
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/pickups/${pickup.id}`); }}
                        >
                          <td className="px-4 py-3 align-middle font-mono font-medium text-neutral-900 dark:text-white">
                            {pickup.pickup_number}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            <PickupStatusBadge status={pickup.status} />
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {pickup.is_urgent ? (
                              <Badge variant="danger" size="sm" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Urgent
                              </Badge>
                            ) : (
                              <span className="text-neutral-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle font-medium text-neutral-900 dark:text-white">
                            {pickup.customer_name}
                          </td>
                          <td className="px-4 py-3 align-middle tabular-nums text-neutral-600 dark:text-slate-400">
                            {formatPhone(pickup.customer_mobile)}
                          </td>
                          <td className="px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">
                            {pickup.brand} {pickup.model_name}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-500 dark:text-slate-500">
                            {formatDate(pickup.pickup_date)}
                          </td>
                          <td className="px-4 py-3 align-middle text-neutral-500 dark:text-slate-500">
                            {pickup.pickup_time_slot || "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-neutral-500 dark:text-slate-500">
                            {pickup.assigned_technician_name || "—"}
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <ArrowRight className="h-4 w-4 text-neutral-300 dark:text-slate-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards — below lg */}
                <div className="space-y-3 p-4 md:p-6 lg:hidden">
                  {pickups.map((pickup: PickupRequest) => (
                    <Link
                      key={pickup.id}
                      href={`/pickups/${pickup.id}`}
                      className="block rounded-xl border border-neutral-100 p-4 transition-all hover:border-primary-200 hover:bg-primary-50/50 dark:border-slate-600 dark:hover:bg-slate-700/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {pickup.pickup_number}
                            </span>
                            <PickupStatusBadge status={pickup.status} />
                            {pickup.is_urgent && (
                              <Badge variant="danger" size="sm" className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Urgent
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {pickup.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {formatPhone(pickup.customer_mobile)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                            <span>
                              {pickup.brand} {pickup.model_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatDate(pickup.pickup_date)}
                            </span>
                            {pickup.pickup_time_slot && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {pickup.pickup_time_slot}
                              </span>
                            )}
                          </div>
                          {pickup.assigned_technician_name && (
                            <div className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                              Assigned: {pickup.assigned_technician_name}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-neutral-400" />
                      </div>
                    </Link>
                  ))}
                </div>

                {(hasPrevPage || hasNextPage) && (
                  <PaginationFooter
                    className="md:px-6"
                    page={currentPage}
                    pageSize={PICKUPS_PAGE_SIZE}
                    totalCount={totalCount}
                    onPrevious={() => setCurrentPage((p) => p - 1)}
                    onNext={() => setCurrentPage((p) => p + 1)}
                    disabledPrevious={!hasPrevPage}
                    disabledNext={!hasNextPage}
                  />
                )}
              </div>
            )}
          </WorkspaceSurface>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
