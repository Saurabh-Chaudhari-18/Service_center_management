"use client";

import { formatDateTime } from "@/lib/formatters";
import type { JobStatus, JobStatusHistoryItem } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";
import { Badge } from "@/components/ui";
import { ActivityTimeline } from "@/components/shell";

interface JobStatusTimelineProps {
  history: JobStatusHistoryItem[];
}

export function JobStatusTimeline({ history }: JobStatusTimelineProps) {
  const items = (history ?? []).map((item) => {
    const toConfig = JOB_STATUS_CONFIG[item.to_status as JobStatus];
    return {
      id: String(item.id),
      content: (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {toConfig?.label}
              </span>
              {item.is_override && (
                <Badge variant="warning" size="sm">
                  Override
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-500 dark:text-slate-400">
              by {item.changed_by_name || "System"}
            </p>
            {item.notes && (
              <p className="mt-2 text-sm italic text-neutral-600 dark:text-slate-300">
                &quot;{item.notes}&quot;
              </p>
            )}
            <p className="mt-1 text-xs text-neutral-400 dark:text-slate-500">
              {formatDateTime(item.created_at)}
            </p>
          </div>
        </div>
      ),
    };
  });

  return (
    <ActivityTimeline
      items={items}
      emptySlot={
        <p className="py-4 text-center text-sm text-neutral-500 dark:text-slate-400">
          No status history available
        </p>
      }
    />
  );
}
