"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Button,
  Input,
  JobStatusBadge,
  LoadingState,
  EmptyState,
  Badge,
} from "@/components/ui";
import {
  PageShell,
  PaginationFooter,
  RegisterToolbar,
  WorkspaceSurface,
} from "@/components/shell";
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
  Zap,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import type { JobCard } from "@/types";
import { formatDate, formatPhone } from "@/lib/formatters";

const JOB_LIST_PAGE_SIZE = 10;
const MY_JOBS_TAB = "MY_JOBS";

// One-click status transitions that need no extra data entry
const QUICK_ACTIONS: Partial<Record<string, { toStatus: string; label: string; className: string }>> = {
  RECEIVED:           { toStatus: "DIAGNOSIS",          label: "Start Diagnosis",   className: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100" },
  APPROVED:           { toStatus: "REPAIR_IN_PROGRESS", label: "Start Repair",      className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
  WAITING_FOR_PARTS:  { toStatus: "REPAIR_IN_PROGRESS", label: "Parts In → Repair", className: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100" },
  REPAIR_IN_PROGRESS: { toStatus: "READY_FOR_DELIVERY", label: "Mark Ready ✓",      className: "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" },
};

// =====================================================
// Job Card Item Component
// =====================================================

interface JobCardItemProps {
  job: JobCard;
  isUpdating?: boolean;
  onQuickUpdate?: (jobId: string, toStatus: string) => void;
}

function JobCardItem({ job, isUpdating, onQuickUpdate }: JobCardItemProps) {
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(job.created_at).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div className="card p-5 hover:shadow-lg transition-all duration-200 cursor-pointer">
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
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-neutral-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDate(job.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{daysSinceCreated}d ago</span>
                </div>
                {job.assigned_technician_name && (
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{job.assigned_technician_name}</span>
                  </div>
                )}
              </div>
              {onQuickUpdate && (
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                  <QuickStatusButton
                    job={job}
                    isUpdating={isUpdating ?? false}
                    onUpdate={onQuickUpdate}
                  />
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
// Inline Quick-Status Button
// =====================================================

function QuickStatusButton({
  job,
  isUpdating,
  onUpdate,
}: {
  job: JobCard;
  isUpdating: boolean;
  onUpdate: (jobId: string, toStatus: string) => void;
}) {
  const action = QUICK_ACTIONS[job.status];
  if (!action) return null;

  return (
    <button
      type="button"
      disabled={isUpdating}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onUpdate(job.id, action.toStatus);
      }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border transition-all whitespace-nowrap ${action.className} ${isUpdating ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {isUpdating ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Zap className="w-3 h-3" />
      )}
      {action.label}
    </button>
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
  showMyJobs?: boolean;
}

function StatusTabs({
  selectedStatus,
  onStatusChange,
  jobCounts,
  totalJobs,
  urgentCount,
  showMyJobs,
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
      {showMyJobs && (
        <button
          key="my-jobs"
          type="button"
          onClick={() => onStatusChange(MY_JOBS_TAB)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
            selectedStatus === MY_JOBS_TAB
              ? "bg-primary-500 text-white shadow-md"
              : "status-tab-inactive"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          My Jobs
        </button>
      )}
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
            : "text-neutral-600 hover:text-red-500"
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
  const { currentBranch, hasPermission, user, isRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);

  const { mutate: quickUpdateStatus } = useMutation({
    mutationFn: ({ jobId, toStatus }: { jobId: string; toStatus: string }) =>
      jobsApi.updateStatus(jobId, toStatus),
    onMutate: async ({ jobId, toStatus }) => {
      setUpdatingJobId(jobId);
      // Cancel in-flight refetches so they don't overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: ["jobs"] });
      // Snapshot current data for rollback on error
      const activeKey = ["jobs", currentBranch?.id, statusFilter, search, page];
      const previousData = queryClient.getQueryData(activeKey);
      // Optimistically update the job's status in the list
      queryClient.setQueryData(activeKey, (old: unknown) => {
        const data = old as { results?: JobCard[]; count?: number } | undefined;
        if (!data) return old;
        return {
          ...data,
          results: data.results?.map((j: JobCard) =>
            j.id === jobId ? { ...j, status: toStatus } : j,
          ),
        };
      });
      return { activeKey, previousData };
    },
    onError: (err: Error, _, context) => {
      // Restore the snapshot on failure
      if (context) queryClient.setQueryData(context.activeKey, context.previousData);
      toast.error(err.message || "Failed to update status");
    },
    onSuccess: (_, { toStatus }) => {
      const label = toStatus.replace(/_/g, " ").toLowerCase();
      toast.success(`Job moved to ${label}`);
    },
    onSettled: () => {
      setUpdatingJobId(null);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs-stats"] });
    },
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs", currentBranch?.id, statusFilter, search, page],
    queryFn: () => {
      const params: Parameters<typeof jobsApi.list>[0] & { assigned_technician?: string } = {
        branch: currentBranch?.id,
        search: search || undefined,
        page,
        page_size: JOB_LIST_PAGE_SIZE,
      };
      if (statusFilter === MY_JOBS_TAB) {
        if (user?.id) params.assigned_technician = user.id;
      } else if (statusFilter === URGENT_TAB) {
        params.is_urgent = true;
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      return jobsApi.list(params as Parameters<typeof jobsApi.list>[0]);
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

        <PageShell width="fluid">
          <RegisterToolbar
            search={
              <Input
                placeholder="Search by job number, customer name, or device..."
                leftIcon={<Search className="h-5 w-5" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Search job cards"
                className="py-3 text-sm"
              />
            }
            secondaryActions={
              <Button variant="secondary" leftIcon={<Filter className="h-4 w-4" />}>
                More Filters
              </Button>
            }
          />

          <StatusTabs
            selectedStatus={statusFilter}
            onStatusChange={(status) => {
              setStatusFilter(status);
              setPage(1);
            }}
            jobCounts={jobCounts}
            totalJobs={totalJobsStat}
            urgentCount={urgentCount}
            showMyJobs={isRole("TECHNICIAN", "MANAGER", "OWNER")}
          />

          <WorkspaceSurface>
            {isLoading ? (
              <div className="p-8">
                <LoadingState />
              </div>
            ) : error ? (
              <div className="p-8">
                <EmptyState
                  icon={<AlertCircle className="h-8 w-8 text-red-400" />}
                  title="Error loading jobs"
                  description="Failed to fetch job cards. Please try again."
                  action={
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                  }
                />
              </div>
            ) : jobs.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<FileText className="h-8 w-8 text-neutral-400" />}
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
                        <Button leftIcon={<Plus className="h-4 w-4" />}>Create Job Card</Button>
                      </Link>
                    )
                  }
                />
              </div>
            ) : (
              <>
                {/* Desktop table — lg+ */}
                <div className="hidden lg:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                        <th scope="col" className="px-4 py-3">Job #</th>
                        <th scope="col" className="px-4 py-3">Status</th>
                        <th scope="col" className="px-4 py-3">Customer</th>
                        <th scope="col" className="px-4 py-3">Device</th>
                        <th scope="col" className="px-4 py-3">Complaint</th>
                        <th scope="col" className="px-4 py-3">Date</th>
                        <th scope="col" className="px-4 py-3">Technician</th>
                        {hasPermission("canEditJobCards") && (
                          <th scope="col" className="px-4 py-3">Quick Action</th>
                        )}
                        <th scope="col" className="w-8 px-2 py-3" aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody className="text-neutral-800 dark:text-slate-200">
                      {jobs.map((job) => (
                        <tr
                          key={job.id}
                          tabIndex={0}
                          className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                          onClick={() => router.push(`/jobs/${job.id}`)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(`/jobs/${job.id}`);
                            }
                          }}
                        >
                          <td className="px-4 py-2.5 align-middle">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-neutral-900 dark:text-white">
                                {job.job_number}
                              </span>
                              {job.is_urgent && (
                                <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-500/20 dark:text-red-400">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  Urgent
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-middle">
                            <JobStatusBadge status={job.status} />
                          </td>
                          <td className="max-w-[160px] px-4 py-2.5 align-middle">
                            <span className="block truncate font-medium text-neutral-900 dark:text-white">
                              {job.customer?.first_name} {job.customer?.last_name}
                            </span>
                            {job.customer?.mobile && (
                              <span className="block truncate text-xs text-neutral-500 dark:text-slate-400">
                                {formatPhone(job.customer.mobile)}
                              </span>
                            )}
                          </td>
                          <td className="max-w-[140px] px-4 py-2.5 align-middle">
                            <span className="block truncate text-neutral-700 dark:text-slate-300">
                              {job.brand} {job.model}
                            </span>
                          </td>
                          <td className="max-w-[200px] px-4 py-2.5 align-middle">
                            <span className="line-clamp-1 text-neutral-600 dark:text-slate-400">
                              {job.customer_complaint}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 align-middle tabular-nums text-neutral-500 dark:text-slate-500">
                            {formatDate(job.created_at)}
                          </td>
                          <td className="max-w-[120px] px-4 py-2.5 align-middle">
                            <span className="block truncate text-neutral-600 dark:text-slate-400">
                              {job.assigned_technician_name || <span className="text-neutral-300 dark:text-slate-600">—</span>}
                            </span>
                          </td>
                          {hasPermission("canEditJobCards") && (
                            <td className="px-4 py-2.5 align-middle" onClick={(e) => e.stopPropagation()}>
                              <QuickStatusButton
                                job={job}
                                isUpdating={updatingJobId === job.id}
                                onUpdate={(id, st) => quickUpdateStatus({ jobId: id, toStatus: st })}
                              />
                            </td>
                          )}
                          <td className="px-2 py-2.5 align-middle">
                            <ArrowRight className="h-4 w-4 text-neutral-300 dark:text-slate-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(hasPrevPage || hasNextPage) && (
                    <PaginationFooter
                      className="px-4"
                      page={page}
                      pageSize={JOB_LIST_PAGE_SIZE}
                      totalCount={totalCount}
                      onPrevious={() => setPage((p) => p - 1)}
                      onNext={() => setPage((p) => p + 1)}
                      disabledPrevious={!hasPrevPage}
                      disabledNext={!hasNextPage}
                    />
                  )}
                </div>

                {/* Mobile cards — below lg */}
                <div className="min-w-0 space-y-3 p-4 lg:hidden">
                  {jobs.map((job) => (
                    <JobCardItem
                      key={job.id}
                      job={job}
                      isUpdating={updatingJobId === job.id}
                      onQuickUpdate={hasPermission("canEditJobCards") ? (id, st) => quickUpdateStatus({ jobId: id, toStatus: st }) : undefined}
                    />
                  ))}
                  {(hasPrevPage || hasNextPage) && (
                    <PaginationFooter
                      page={page}
                      pageSize={JOB_LIST_PAGE_SIZE}
                      totalCount={totalCount}
                      onPrevious={() => setPage((p) => p - 1)}
                      onNext={() => setPage((p) => p + 1)}
                      disabledPrevious={!hasPrevPage}
                      disabledNext={!hasNextPage}
                    />
                  )}
                </div>
              </>
            )}
          </WorkspaceSurface>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
