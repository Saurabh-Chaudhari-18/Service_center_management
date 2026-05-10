"use client";

import { format } from "date-fns";
import type { JobStatus, JobStatusHistoryItem } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";
import { Badge } from "@/components/ui";

interface JobStatusTimelineProps {
  history: JobStatusHistoryItem[];
}

export function JobStatusTimeline({ history }: JobStatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-neutral-500 text-center py-4">
        No status history available
      </p>
    );
  }

  return (
    <div className="timeline">
      {history.map((item) => {
        const toConfig = JOB_STATUS_CONFIG[item.to_status as JobStatus];

        return (
          <div key={item.id} className="timeline-item">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-neutral-900">
                    {toConfig?.label}
                  </span>
                  {item.is_override && (
                    <Badge variant="warning" size="sm">
                      Override
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  by {item.changed_by_name || "System"}
                </p>
                {item.notes && (
                  <p className="text-sm text-neutral-600 mt-2 italic">
                    &quot;{item.notes}&quot;
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {format(new Date(item.created_at), "MMM dd, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
