import type { EnquiryStatus } from "@/types";
import { ENQUIRY_STATUS_CONFIG } from "@/types";
import type { SemanticTone, StatusPresentation } from "../types";

/** Explicit tone per enquiry status (no color inference). */
const ENQUIRY_STATUS_TONE: Record<EnquiryStatus, SemanticTone> = {
  NEW: "primary",
  CONTACTED: "info",
  FOLLOW_UP: "warning",
  INTERESTED: "accent",
  QUOTED: "cyan",
  CONVERTED: "success",
  LOST: "danger",
  CLOSED: "neutral",
};

export function getEnquiryStatusPresentation(status: EnquiryStatus): StatusPresentation {
  const c = ENQUIRY_STATUS_CONFIG[status] ?? ENQUIRY_STATUS_CONFIG.NEW;
  return {
    label: c.label,
    tone: ENQUIRY_STATUS_TONE[status] ?? "neutral",
    chipColors: {
      background: c.bgColor,
      foreground: c.textColor,
    },
  };
}
