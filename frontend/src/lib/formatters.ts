/**
 * Formats a 10-digit Indian mobile number as +91 XXXXX XXXXX
 * Returns the original value if it doesn't match the expected format.
 */
/** Strip internal seed markers from dropdown option labels shown in the UI. */
export function cleanDropdownLabel(label: string): string {
  return label.replace(/^\[SEED\]\s*/i, "").trim();
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  // 11-digit numbers with leading 0 (e.g. 04521235646)
  if (digits.length === 11 && digits.startsWith("0")) {
    return formatPhone(digits.slice(1));
  }
  // 12-digit numbers without country code — treat as 91 + 10 digits
  if (digits.length === 12) {
    return formatPhone(digits.slice(-10));
  }
  return phone;
}

/**
 * Formats a date string as DD/MM/YYYY (Indian standard).
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formats a date string as "10 May 2026" for human-readable contexts.
 */
export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Date + time for audit-style rows (e.g. timeline).
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const date = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${time}`;
}
