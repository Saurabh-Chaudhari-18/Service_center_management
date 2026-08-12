/** Domain type definitions. */
import type { BaseEntity } from "./core";
export interface InventoryItem extends BaseEntity {
  branch: string;
  branch_name?: string;
  category?: string;
  category_name?: string;
  name: string;
  sku: string;
  description: string;
  cost_price: number;
  selling_price: number;
  gst_rate: number;
  hsn_code: string;
  quantity: number;
  low_stock_threshold: number;
  unit: string;
  vendor_name: string;
  vendor_contact: string;
  warranty_period_months: number;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
}

export interface StockAdjustment extends BaseEntity {
  inventory_item: string;
  /** Present when API sends an explicit delta; otherwise derive from quantities */
  quantity?: number;
  previous_quantity: number;
  new_quantity: number;
  adjustment_type: "ADD" | "DEDUCT" | "MANUAL";
  reason: string;
  adjusted_by: string;
  adjusted_by_name?: string;
  job: string | null;
}

export interface StockTransferItem {
  id: string;
  inventory_item: string;
  item_name: string;
  quantity: number;
}

export interface StockTransfer extends BaseEntity {
  from_branch: string;
  from_branch_name: string;
  to_branch: string;
  to_branch_name: string;
  status: "PENDING" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED";
  initiated_by_name: string;
  notes: string;
  items: StockTransferItem[];
}

export interface PurchaseItem extends BaseEntity {
  inventory_item: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/** Payment rows returned nested on a purchase (vendor bill / GRN). */
export interface PurchasePaymentEntry {
  id?: string;
  amount: number | string;
  payment_method?: string;
  reference?: string;
  created_at?: string;
}

export interface Purchase extends BaseEntity {
  branch: string;
  vendor_name: string;
  vendor_gstin?: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  taxable_amount?: number;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  total_gst?: number;
  notes: string;
  items: PurchaseItem[];
  // Financial fields
  paid_amount?: number;
  balance_due?: number;
  status?: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  payments?: PurchasePaymentEntry[];
}

// =====================================================
// Billing & Invoice
// =====================================================
