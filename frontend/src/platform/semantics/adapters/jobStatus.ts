import type { JobStatus } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";
import type { SemanticTone, StatusPresentation } from "../types";

/** Explicit tone per job status (no color inference). */
const JOB_STATUS_TONE: Record<JobStatus, SemanticTone> = {
  RECEIVED: "primary",
  DIAGNOSIS: "warning",
  ESTIMATE_SHARED: "accent",
  APPROVED: "success",
  REJECTED: "danger",
  WAITING_FOR_PARTS: "warning",
  REPAIR_IN_PROGRESS: "cyan",
  READY_FOR_DELIVERY: "success",
  DELIVERED: "primary",
  CANCELLED: "neutral",
};

export function getJobStatusPresentation(status: JobStatus): StatusPresentation {
  const c = JOB_STATUS_CONFIG[status];
  return {
    label: c.label,
    tone: JOB_STATUS_TONE[status],
    chipColors: {
      background: c.bgColor,
      foreground: c.textColor,
    },
  };
}
