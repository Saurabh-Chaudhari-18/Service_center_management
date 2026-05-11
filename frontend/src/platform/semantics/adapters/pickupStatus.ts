import type { PickupRequestStatus } from "@/types";
import { PICKUP_STATUS_CONFIG } from "@/types";
import type { SemanticTone, StatusPresentation } from "../types";

const PICKUP_STATUS_TONE: Record<PickupRequestStatus, SemanticTone> = {
  REQUESTED: "primary",
  ASSIGNED: "warning",
  EN_ROUTE: "cyan",
  PICKED_UP: "accent",
  DELIVERED_TO_CENTER: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
};

export function getPickupStatusPresentation(
  status: PickupRequestStatus,
): StatusPresentation {
  const c = PICKUP_STATUS_CONFIG[status];
  return {
    label: c.label,
    tone: PICKUP_STATUS_TONE[status],
    chipColors: {
      background: c.bgColor,
      foreground: c.textColor,
    },
  };
}
