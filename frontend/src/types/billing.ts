/** Domain type definitions. */
import type { InvoiceStatus, PaymentMethod, BaseEntity, Branch } from "./core";

export interface InvoiceLineItem {
  id: string;
  item_type: "SERVICE" | "PART" | "LABOUR" | "OTHER";
  description: string;
  hsn_sac_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  amount: number;
  gst_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  discount_percent: number;
  inventory_item: string | null;
}

export interface Payment extends BaseEntity {
  invoice: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference: string;
  notes: string;
  received_by: string;
  received_by_name?: string;
  is_verified: boolean;
}

export interface Invoice extends BaseEntity {
  branch: string;
  branch_name?: string;
  branch_details?: Branch;
  invoice_number: string;
  job: string | null;
  job_number?: string;
  customer?: string | null;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  customer_address: string;
  customer_gstin: string;
  customer_state_code: string;
  place_of_supply?: string;
  invoice_date: string;
  due_date: string | null;
  is_interstate: boolean;
  subtotal: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  discount_amount: number;
  total_tax: number;
  total_amount: number;
  status: InvoiceStatus;
  paid_amount: number;
  balance_due: number;
  is_finalized: boolean;
  finalized_at: string | null;
  notes: string;
  terms_and_conditions: string;
  created_by: string;
  line_items?: InvoiceLineItem[];
  payments?: Payment[];
}

export interface CreditNote extends BaseEntity {
  branch: string;
  credit_note_number: string;
  invoice: string;
  invoice_number: string;
  amount: number;
  total_amount: number;
  reason: string;
  created_by_name: string;
  customer_delivery?: {
    status: "NOT_AVAILABLE" | "QUEUED" | "SENT" | "FAILED";
    channels: string[];
  };
}

// =====================================================
// Notifications
// =====================================================

export interface NotificationLog extends BaseEntity {
  job: string | null;
  job_number?: string;
  customer_name: string;
  recipient_mobile: string;
  channel: "SMS" | "WHATSAPP" | "EMAIL";
  message: string;
  status: "PENDING" | "SENT" | "FAILED";
  error_message: string;
  sent_at: string | null;
}

export interface InternalAlert extends BaseEntity {
  user: string;
  alert_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type: string;
  related_object_id: string;
}

// =====================================================
// Reports
// =====================================================
