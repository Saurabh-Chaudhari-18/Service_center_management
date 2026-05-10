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
  JobStatusBadge,
  LoadingState,
  EmptyState,
  Badge,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import {
  Plus,
  Search,
  Filter,
  FileText,
  ArrowRight,
  Calendar,
  AlertCircle,
  Clock,
  User,
  Laptop,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import type { JobCard } from "@/types";
import { formatDate, formatPhone } from "@/lib/formatters";

const JOB_LIST_PAGE_SIZE = 10;

// =====================================================
// Job Card Item Component
// =====================================================

interface JobCardItemProps {
  job: JobCard;
}

function JobCardItem({ job }: JobCardItemProps) {
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(job.created_at).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div className="glass-card p-5 hover:shadow-lg transition-all duration-200 cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header Row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-semibold text-neutral-900">
                {job.job_number}
              </span>
              {!job.branch_name && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                  🌍 Universal
                </span>
              )}
              <JobStatusBadge status={job.status} />
              {job.is_urgent && (
                <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  URGENT
                </span>
              )}
              {job.is_warranty_repair && (
                <Badge variant="info" size="sm">
                  Warranty
                </Badge>
              )}
            </div>

            {/* Customer & Device Info */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <User className="w-4 h-4 text-neutral-400" />
                <span className="truncate">
                  {job.customer?.first_name} {job.customer?.last_name}
                  {job.customer?.mobile ? (
                    <span className="text-neutral-400 ml-1">
                      · {formatPhone(job.customer.mobile)}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Laptop className="w-4 h-4 text-neutral-400" />
                <span className="truncate">
                  {job.brand} {job.model}
                </span>
              </div>
            </div>

            {/* Complaint Summary */}
            <p className="mt-2 text-sm text-neutral-500 line-clamp-1">
              {job.customer_complaint}
            </p>

            {/* Footer Info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-neutral-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(job.created_at)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {daysSinceCreated} day{daysSinceCreated !== 1 ? "s" : ""} ago
                </span>
              </div>
              {job.assigned_technician_name && (
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Assigned to {job.assigned_technician_name}</span>
                </div>
              )}
            </div>
          </div>

          <ArrowRight className="w-5 h-5 text-neutral-300 flex-shrink-0" />
        </div>
      </div>
    </Link>
  );
}

// =====================================================
// Status Filter Tabs
// =====================================================

const URGENT_TAB = "URGENT";

interface StatusTabsProps {
  selectedStatus: string | null;
  onStatusChange: (status: string | null) => void;
  jobCounts: Record<string, number>;
  totalJobs: number;
  urgentCount: number;
}

function StatusTabs({
  selectedStatus,
  onStatusChange,
  jobCounts,
  totalJobs,
  urgentCount,
}: StatusTabsProps) {
  const statusTabs = [
    { value: null, label: "All" },
    { value: "RECEIVED", label: "Received" },
    { value: "DIAGNOSIS", label: "Diagnosis" },
    { value: "WAITING_FOR_PARTS", label: "Waiting Parts" },
    { value: "REPAIR_IN_PROGRESS", label: "In Progress" },
    { value: "READY_FOR_DELIVERY", label: "Ready" },
    { value: "DELIVERED", label: "Delivered" },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {statusTabs.slice(0, 1).map((tab) => {
        const isActive = selectedStatus === tab.value;
        const count = totalJobs;

        return (
          <button
            key={tab.value || "all"}
            type="button"
            onClick={() => onStatusChange(tab.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? "bg-primary-500 text-white shadow-md"
                : "status-tab-inactive"
            }`}
          >
            {tab.label}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                isActive ? "bg-white/20" : "bg-neutral-100"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
      <button
        key="urgent"
        type="button"
        onClick={() => onStatusChange(URGENT_TAB)}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
          selectedStatus === URGENT_TAB
            ? "border-b-2 border-red-500 text-red-600 bg-red-50/80"
            : "text-gray-600 hover:text-red-500"
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Urgent
        {urgentCount > 0 && (
          <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-0.5">
            {urgentCount}
          </span>
        )}
      </button>
      {statusTabs.slice(1).map((tab) => {
        const value = tab.value as string;
        const isActive = selectedStatus === value;
        const count = jobCounts[value] || 0;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onStatusChange(value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? "bg-primary-500 text-white shadow-md"
                : "status-tab-inactive"
            }`}
          >
            {tab.label}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                isActive ? "bg-white/20" : "bg-neutral-100"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// Jobs List Page
// =====================================================

export default function JobsPage() {
  const { currentBranch, hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", currentBranch?.id, statusFilter, search, page],
    queryFn: () => {
      const params: Parameters<typeof jobsApi.list>[0] = {
        branch: currentBranch?.id,
        search: search || undefined,
        page,
        page_size: JOB_LIST_PAGE_SIZE,
      };
      if (statusFilter === URGENT_TAB) {
        params.is_urgent = true;
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      return jobsApi.list(params);
    },
    enabled: !!currentBranch,
  });

  // Fetch lightweight per-status counts from the dedicated stats endpoint.
  // Previously this fetched the entire jobs list (potentially thousands of records)
  // just to count statuses client-side — a major performance anti-pattern.
  const { data: statsData } = useQuery({
    queryKey: ["jobs-stats", currentBranch?.id],
    queryFn: () => jobsApi.getStats({ branch: currentBranch?.id }),
    enabled: !!currentBranch,
  });

  const jobCounts: Record<string, number> = statsData?.by_status ?? {};
  const urgentCount = statsData?.urgent ?? 0;
  const totalJobsStat = statsData?.total ?? 0;

  const jobs = data?.results || [];
  const totalCount = data?.count || 0;
  const hasNextPage = !!data?.next;
  const hasPrevPage = !!data?.previous;

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title="Job Cards"
          subtitle={`${totalJobsStat} total job cards`}
          actions={
            hasPermission("canCreateJobCards") && (
              <Link href="/jobs/new">
                <Button leftIcon={<Plus className="w-4 h-4" />}>
                  New Job Card
                </Button>
              </Link>
            )
          }
        />

        <div className="p-6 space-y-6">
          {/* Search & Filters */}
          <Card padding="sm">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by job number, customer name, or device..."
                  leftIcon={<Search className="w-5 h-5" />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  leftIcon={<Filter className="w-4 h-4" />}
                >
                  More Filters
                </Button>
              </div>
            </div>
          </Card>

          {/* Status Tabs */}
          <StatusTabs
            selectedStatus={statusFilter}
            onStatusChange={(status) => {
              setStatusFilter(status);
              setPage(1);
            }}
            jobCounts={jobCounts}
            totalJobs={totalJobsStat}
            urgentCount={urgentCount}
          />

          {/* Jobs List */}
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <Card>
              <EmptyState
                icon={<AlertCircle className="w-8 h-8 text-red-400" />}
                title="Error loading jobs"
                description="Failed to fetch job cards. Please try again."
                action={
                  <Button onClick={() => window.location.reload()}>
                    Retry
                  </Button>
                }
              />
            </Card>
          ) : jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-8 h-8 text-neutral-400" />}
                title="No job cards found"
                description={
                  search || statusFilter
                    ? "Try adjusting your search or filter criteria"
                    : "Create your first job card to get started"
                }
                action={
                  hasPermission("canCreateJobCards") &&
                  !search &&
                  !statusFilter && (
                    <Link href="/jobs/new">
                      <Button leftIcon={<Plus className="w-4 h-4" />}>
                        Create Job Card
                      </Button>
                    </Link>
                  )
                }
              />
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <JobCardItem key={job.id} job={job} />
                ))}
              </div>

              {/* Pagination */}
              {(hasPrevPage || hasNextPage) && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-neutral-500">
                    Showing {(page - 1) * JOB_LIST_PAGE_SIZE + 1} to{" "}
                    {Math.min(page * JOB_LIST_PAGE_SIZE, totalCount)} of{" "}
                    {totalCount} results
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!hasPrevPage}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!hasNextPage}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
