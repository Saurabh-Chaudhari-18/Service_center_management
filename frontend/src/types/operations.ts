/** Domain type definitions. */
import type { BaseEntity } from "./core";
export type ExpenseCategory =
  | "RENT"
  | "ELECTRICITY"
  | "INTERNET"
  | "SALARY"
  | "TEA_SNACKS"
  | "TRANSPORT"
  | "STATIONERY"
  | "TOOLS"
  | "MAINTENANCE"
  | "MARKETING"
  | "INSURANCE"
  | "TAX"
  | "MISCELLANEOUS";

export interface Expense extends BaseEntity {
  branch: string;
  category: ExpenseCategory;
  category_display?: string;
  title: string;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  payment_method_display?: string;
  reference: string;
  receipt: string | null;
  is_recurring: boolean;
  vendor_name: string;
  is_itc_eligible?: boolean;
  vendor_gstin?: string;
  vendor_invoice_number?: string;
  gst_rate?: number;
  taxable_amount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  created_by: string;
  created_by_name?: string;
}

// =====================================================
// Enquiry / Lead Types
// =====================================================

export type EnquiryStatus =
  | "NEW"
  | "CONTACTED"
  | "FOLLOW_UP"
  | "INTERESTED"
  | "QUOTED"
  | "CONVERTED"
  | "LOST"
  | "CLOSED";

export type LeadSource =
  | "WALK_IN"
  | "PHONE_CALL"
  | "WHATSAPP"
  | "WEBSITE"
  | "GOOGLE"
  | "SOCIAL_MEDIA"
  | "REFERRAL"
  | "JUSTDIAL"
  | "SULEKHA"
  | "OTHER";

export interface Enquiry extends BaseEntity {
  branch: string;
  customer: string | null;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  device_type: string;
  brand: string;
  model_name: string;
  problem_description: string;
  quoted_price: number | null;
  source: LeadSource;
  source_display?: string;
  status: EnquiryStatus;
  status_display?: string;
  follow_up_date: string | null;
  follow_up_notes: string;
  converted_job: string | null;
  converted_job_number?: string;
  loss_reason: string;
  assigned_to: string | null;
  assigned_to_name?: string;
  created_by: string;
  created_by_name?: string;
  notes: string;
  interaction_notes?: Array<{
    id: string;
    note: string;
    created_by_name: string;
    created_at: string;
  }>;
}

// =====================================================
// Supplier Types
// =====================================================

export interface Supplier extends BaseEntity {
  branch: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  alternate_phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  pan_number: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  upi_id: string;
  payment_terms: string;
  payment_terms_display?: string;
  categories: string;
  rating: number;
  notes: string;
  is_active: boolean;
}

export interface PurchaseOrderItem {
  id: string;
  inventory_item?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  received_quantity: number;
}

export interface PurchaseOrder extends BaseEntity {
  branch?: string;
  supplier?: string;
  supplier_name: string;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string | null;
  status: string;
  status_display: string;
  total_amount: number;
  paid_amount: number;
  tax_amount?: number;
  notes?: string;
  items?: PurchaseOrderItem[];
}

// =====================================================
// Customer Ledger Types
// =====================================================

export interface CustomerLedgerEntry extends BaseEntity {
  branch: string;
  customer: string;
  customer_name?: string;
  customer_mobile?: string;
  entry_type: "CREDIT" | "DEBIT";
  entry_type_display?: string;
  amount: number;
  description: string;
  reference_type: string;
  reference_type_display?: string;
  reference_id: string;
  entry_date: string;
  running_balance: number;
  notes: string;
  created_by: string;
  created_by_name?: string;
}

// =====================================================
// Enquiry Status Config
// =====================================================

export const ENQUIRY_STATUS_CONFIG: Record<
  EnquiryStatus,
  { label: string; color: string; bgColor: string; textColor: string }
> = {
  NEW: { label: "New", color: "#6366f1", bgColor: "#eef2ff", textColor: "#4338ca" },
  CONTACTED: { label: "Contacted", color: "#f59e0b", bgColor: "#fffbeb", textColor: "#b45309" },
  FOLLOW_UP: { label: "Follow-up", color: "#8b5cf6", bgColor: "#f5f3ff", textColor: "#6d28d9" },
  INTERESTED: { label: "Interested", color: "#06b6d4", bgColor: "#ecfeff", textColor: "#0e7490" },
  QUOTED: { label: "Quoted", color: "#f97316", bgColor: "#fff7ed", textColor: "#c2410c" },
  CONVERTED: { label: "Converted", color: "#22c55e", bgColor: "#f0fdf4", textColor: "#15803d" },
  LOST: { label: "Lost", color: "#ef4444", bgColor: "#fef2f2", textColor: "#b91c1c" },
  CLOSED: { label: "Closed", color: "#64748b", bgColor: "#f1f5f9", textColor: "#334155" },
};

// =====================================================
// Purchase Payment Status Badge Config
// Badge variant strings for use with <Badge> component
// =====================================================

export type PurchasePaymentStatus = "PAID" | "PARTIAL" | "PENDING" | "CANCELLED" | "UNPAID";

export const PURCHASE_PAYMENT_STATUS_CONFIG: Record<
  PurchasePaymentStatus,
  { label: string; badgeClass: string }
> = {
  PAID:      { label: "Paid",      badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
  PARTIAL:   { label: "Partial",   badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  PENDING:   { label: "Pending",   badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
  CANCELLED: { label: "Cancelled", badgeClass: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300" },
  UNPAID:    { label: "Unpaid",    badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300" },
};
