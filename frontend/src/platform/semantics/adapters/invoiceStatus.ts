import type { InvoiceStatus } from "@/types";
import { INVOICE_STATUS_CONFIG } from "@/types";
import type { SemanticTone, StatusPresentation } from "../types";

const INVOICE_STATUS_TONE: Record<InvoiceStatus, SemanticTone> = {
  DRAFT: "neutral",
  PENDING: "warning",
  PARTIAL: "accent",
  PAID: "success",
  CANCELLED: "danger",
};

export function getInvoiceStatusPresentation(
  status: InvoiceStatus,
): StatusPresentation {
  const c = INVOICE_STATUS_CONFIG[status];
  return {
    label: c.label,
    tone: INVOICE_STATUS_TONE[status],
    chipColors: {
      background: c.bgColor,
      foreground: c.color,
    },
  };
}
