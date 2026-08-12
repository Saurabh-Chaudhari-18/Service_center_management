"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { Badge, Card, EmptyState, JobStatusBadge, LoadingState } from "@/components/ui";
import { PageShell } from "@/components/shell";
import { jobsApi } from "@/lib/api";
import type { JobCard } from "@/types";
import { CalendarClock, ChevronRight, UserRoundCheck, UserRoundX } from "lucide-react";

const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function SchedulePage() {
  const { currentBranch } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["work-schedule", currentBranch?.id],
    queryFn: () => jobsApi.schedule(currentBranch?.id),
    enabled: Boolean(currentBranch),
  });
  const today = localDay(new Date());
  const jobs = data?.jobs || [];
  const overdue = jobs.filter(job => job.estimated_completion_date! < today);
  const dueToday = jobs.filter(job => job.estimated_completion_date === today);
  const upcoming = jobs.filter(job => job.estimated_completion_date! > today);

  return <ProtectedRoute requiredPermission="canViewJobCards"><AppLayout>
    <Header title="Work Schedule" subtitle="Every promised date and the current technician workload" />
    <PageShell width="fluid" className="space-y-5">
      {isLoading ? <LoadingState message="Loading schedule…" /> : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <LoadCard title="Unassigned" count={data?.unassigned_count || 0} icon={<UserRoundX className="h-5 w-5" />} warning />
          {(data?.technician_load || []).map(technician => <LoadCard key={technician.id} title={technician.name} count={technician.job_count} icon={<UserRoundCheck className="h-5 w-5" />} />)}
        </div>
        {jobs.length === 0 ? <EmptyState title="No scheduled work" description="Set a promised completion date during diagnosis to place a job on this schedule." /> : <>
          <ScheduleGroup title="Overdue" jobs={overdue} variant="danger" />
          <ScheduleGroup title="Due today" jobs={dueToday} variant="warning" />
          <ScheduleGroup title="Upcoming" jobs={upcoming} variant="info" />
        </>}
      </>}
    </PageShell>
  </AppLayout></ProtectedRoute>;
}

function LoadCard({ title, count, icon, warning = false }: { title: string; count: number; icon: React.ReactNode; warning?: boolean }) { return <Card padding="md"><div className="flex items-center gap-3"><span className={warning && count ? "text-red-600" : "text-primary-600"}>{icon}</span><div><p className="text-sm text-neutral-500">{title}</p><p className="text-xl font-semibold">{count} active job{count === 1 ? "" : "s"}</p></div></div></Card>; }
function ScheduleGroup({ title, jobs, variant }: { title: string; jobs: JobCard[]; variant: "danger" | "warning" | "info" }) {
  return <Card padding="none"><div className="flex items-center justify-between border-b border-neutral-100 p-4 dark:border-slate-700"><h2 className="font-semibold"><CalendarClock className="mr-2 inline h-4 w-4" />{title}</h2><Badge variant={variant}>{jobs.length}</Badge></div>{jobs.length ? <div className="divide-y divide-neutral-100 dark:divide-slate-700">{jobs.map(job => <Link href={`/jobs/${job.id}`} key={job.id} className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-slate-800/50"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold">{job.job_number}</span><JobStatusBadge status={job.status} /></div><p className="mt-1 truncate text-sm text-neutral-500">{job.customer_name} · {job.brand} {job.model}</p><p className="mt-1 text-xs text-neutral-400">{job.assigned_technician_name || "Unassigned"}</p></div><div className="flex shrink-0 items-center gap-3"><span className={`text-sm font-semibold ${variant === "danger" ? "text-red-600" : variant === "warning" ? "text-amber-600" : "text-blue-600"}`}>{new Date(`${job.estimated_completion_date}T00:00:00`).toLocaleDateString()}</span><ChevronRight className="h-4 w-4 text-neutral-400" /></div></Link>)}</div> : <p className="p-4 text-sm text-neutral-500">No jobs in this group.</p>}</Card>;
}
