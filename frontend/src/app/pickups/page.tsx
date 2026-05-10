"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  StatsCard,
  LoadingState,
  EmptyState,
  Button,
} from "@/components/ui";
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
import type { PickupRequest, PickupRequestStatus } from "@/types";
import { PICKUP_STATUS_CONFIG } from "@/types";

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
// Pickup Status Badge
// =====================================================

function PickupStatusBadge({ status }: { status: PickupRequestStatus }) {
  const config = PICKUP_STATUS_CONFIG[status];
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    >
      {config.label}
    </span>
  );
}

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
            <Link href="/pickups/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>
                New Pickup Request
              </Button>
            </Link>
          }
        />

        <div className="p-6 space-y-6">
          {/* Stats */}
          <PickupStats />

          {/* Filters & Search */}
          <Card>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
              {/* Status Tabs */}
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === tab.value
                        ? "bg-primary-500 text-white shadow-sm"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search pickups..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* List */}
            {isLoading ? (
              <LoadingState />
            ) : pickups.length === 0 ? (
              <EmptyState
                icon={<Truck className="w-8 h-8 text-neutral-400" />}
                title="No pickup requests found"
                description="Create a new pickup request when a customer calls"
              />
            ) : (
              <div className="space-y-3">
                {pickups.map((pickup: PickupRequest) => (
                  <Link
                    key={pickup.id}
                    href={`/pickups/${pickup.id}`}
                    className="block p-4 rounded-xl border border-neutral-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-sm font-medium text-neutral-900">
                            {pickup.pickup_number}
                          </span>
                          <PickupStatusBadge status={pickup.status} />
                          {pickup.is_urgent && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              URGENT
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-neutral-600">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {pickup.customer_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {formatPhone(pickup.customer_mobile)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-neutral-500">
                          <span>
                            {pickup.brand} {pickup.model_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(pickup.pickup_date)}
                          </span>
                          {pickup.pickup_time_slot && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {pickup.pickup_time_slot}
                            </span>
                          )}
                        </div>
                        {pickup.assigned_technician_name && (
                          <div className="mt-1 text-xs text-neutral-400">
                            Assigned: {pickup.assigned_technician_name}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-1" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {!isLoading && pickups.length > 0 && (hasPrevPage || hasNextPage) && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
                <p className="text-sm text-neutral-500">
                  Showing {(currentPage - 1) * PICKUPS_PAGE_SIZE + 1} to{" "}
                  {Math.min(currentPage * PICKUPS_PAGE_SIZE, totalCount)} of{" "}
                  {totalCount} results
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hasPrevPage}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hasNextPage}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
