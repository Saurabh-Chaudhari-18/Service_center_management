"use client";

import { History } from "lucide-react";
import { Card } from "@/components/ui";
import { JobStatusTimeline } from "@/components/jobs/JobStatusTimeline";
import type { JobCard } from "@/types";

interface JobStatusHistoryCardProps {
  statusHistory: JobCard["status_history"];
}

export function JobStatusHistoryCard({
  statusHistory,
}: JobStatusHistoryCardProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-primary-500" />
        Status History
      </h3>
      <JobStatusTimeline history={statusHistory || []} />
    </Card>
  );
}
