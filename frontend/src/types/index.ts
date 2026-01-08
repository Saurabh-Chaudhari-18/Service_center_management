// =====================================================
// Core Type Definitions for Service Center Management
// =====================================================

// User Roles (from backend Role model)
export type UserRole =
  | "OWNER"
  | "MANAGER"
  | "RECEPTIONIST"
  | "TECHNICIAN"
  | "ACCOUNTANT";

// Job Status (from backend JobStatus model)
export type JobStatus =
  | "RECEIVED"
  | "DIAGNOSIS"
  | "ESTIMATE_SHARED"
  | "APPROVED"
  | "REJECTED"
  | "WAITING_FOR_PARTS"
  | "REPAIR_IN_PROGRESS"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

// Invoice Status
export type InvoiceStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "CANCELLED";

// Payment Methods
export type PaymentMethod =
  | "CASH"
  | "UPI"
  | "CARD"
  | "NEFT"
  | "CHEQUE"
  | "WALLET"
  | "OTHER";

// Device Types
export type DeviceType =
  | "LAPTOP"
  | "DESKTOP"
  | "ALL_IN_ONE"
  | "MONITOR"
  | "PRINTER"
  | "UPS"
  | "OTHER";

// Accessory Types
export type AccessoryType =
  | "CHARGER"
  | "BATTERY"
  | "BAG"
  | "MOUSE"
  | "KEYBOARD"
  | "POWER_CABLE"
  | "USB_CABLE"
  | "HDMI_CABLE"
  | "RAM"
  | "HDD"
  | "SSD"
  | "OTHER";

// =====================================================
// Base Interfaces
// =====================================================

export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// Organization & Branch
// =====================================================

export interface Organization extends BaseEntity {
  name: string;
  legal_name: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  pan_number: string;
  logo: string | null;
  is_active: boolean;
}

export interface Branch extends BaseEntity {
  organization: string;
  organization_name?: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  state_code: string;
  invoice_prefix: string;
  invoice_current_number: number;
  jobcard_prefix: string;
  jobcard_current_number: number;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  default_gst_rate: number;
  is_active: boolean;
}

// =====================================================
// User
// =====================================================

export interface User extends BaseEntity {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  organization: string;
  organization_name?: string;
  role: UserRole;
  branches: string[];
  branch_names?: string[];
  is_active: boolean;
  is_staff: boolean;
  last_login: string | null;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthUser extends User {
  accessible_branches: Branch[];
  current_branch?: Branch;
}

// =====================================================
// Customer
// =====================================================

export interface Customer extends BaseEntity {
  branch: string;
  branch_name?: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  alternate_mobile: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  pincode: string;
  state_code: string;
  gstin: string;
  company_name: string;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  notes: string;
  is_active: boolean;
  full_name?: string;
  pending_jobs_count?: number;
  total_spent?: number;
}

// =====================================================
// Job Card
// =====================================================

export interface JobAccessory {
  id: string;
  accessory_type: AccessoryType;
  description: string;
  condition: string;
  is_present: boolean;
}

export interface JobPhoto {
  id: string;
  photo: string;
  photo_type: "INTAKE" | "DAMAGE" | "REPAIR" | "COMPLETED";
  description: string;
  uploaded_by: string;
  created_at: string;
}

export interface JobNote {
  id: string;
  note: string;
  created_by: string;
  created_by_name?: string;
  is_internal: boolean;
  created_at: string;
}

export interface JobStatusHistoryItem {
  id: string;
  from_status: JobStatus;
  to_status: JobStatus;
  changed_by: string;
  changed_by_name?: string;
  notes: string;
  is_override: boolean;
  created_at: string;
}

export interface PartRequest {
  id: string;
  job: string;
  requested_by: string;
  requested_by_name?: string;
  inventory_item: string | null;
  part_name: string;
  quantity: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "USED";
  approved_by: string | null;
  rejection_reason: string;
  notes: string;
  created_at: string;
}

export interface JobCard extends BaseEntity {
  branch: string;
  branch_name?: string;
  job_number: string;
  customer?: Customer;
  customer_id?: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  serial_number: string;
  customer_complaint: string;
  physical_condition: string;
  status: JobStatus;
  assigned_technician: string | null;
  assigned_technician_name?: string;
  received_by: string;
  received_by_name?: string;
  diagnosis_notes: string;
  estimated_cost: number | null;
  estimated_completion_date: string | null;
  customer_approval_date: string | null;
  customer_rejection_reason: string;
  completion_notes: string;
  actual_completion_date: string | null;
  delivery_date: string | null;
  delivered_by: string | null;
  is_urgent: boolean;
  is_warranty_repair: boolean;
  warranty_details: string;
  accessories?: JobAccessory[];
  photos?: JobPhoto[];
  notes_list?: JobNote[];
  status_history?: JobStatusHistoryItem[];
  part_requests?: PartRequest[];
  invoices?: Invoice[];
}

export interface CreateJobCardData {
  branch: string;
  customer_id: string;
  device_type: DeviceType;
  brand: string;
  model: string;
  serial_number?: string;
  customer_complaint: string;
  physical_condition: string;
  device_password?: string;
  is_urgent?: boolean;
  accessories?: Array<{
    accessory_type: AccessoryType;
    is_present: boolean;
    condition?: string;
    description?: string;
  }>;
}

// =====================================================
// Inventory
// =====================================================

export interface InventoryItem extends BaseEntity {
  branch: string;
  branch_name?: string;
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
  previous_quantity: number;
  new_quantity: number;
  adjustment_type: "ADD" | "DEDUCT" | "MANUAL";
  reason: string;
  adjusted_by: string;
  adjusted_by_name?: string;
  job: string | null;
}

// =====================================================
// Billing & Invoice
// =====================================================

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
  invoice_number: string;
  job: string;
  job_number?: string;
  customer_name: string;
  customer_mobile: string;
  customer_email: string;
  customer_address: string;
  customer_gstin: string;
  customer_state_code: string;
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

export interface RevenueReportData {
  period: string;
  total_revenue: number;
  total_invoices: number;
  total_services: number;
  total_parts: number;
  cgst_collected: number;
  sgst_collected: number;
  igst_collected: number;
  daily_breakdown?: Array<{
    date: string;
    revenue: number;
    invoices: number;
  }>;
}

export interface PendingJobsReportData {
  status: JobStatus;
  status_label: string;
  count: number;
  jobs: Array<{
    job_number: string;
    customer_name: string;
    device: string;
    days_pending: number;
  }>;
}

export interface TechnicianProductivityData {
  technician_id: string;
  technician_name: string;
  assigned_jobs: number;
  completed_jobs: number;
  pending_jobs: number;
  avg_completion_days: number;
}

export interface InventoryConsumptionData {
  item_id: string;
  item_name: string;
  sku: string;
  quantity_used: number;
  total_value: number;
  jobs_count: number;
}

// =====================================================
// API Response Types
// =====================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface APIError {
  detail?: string;
  message?: string;
  [key: string]: unknown;
}

// =====================================================
// Role Permissions Map
// =====================================================

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    canViewDashboard: boolean;
    canViewJobCards: boolean;
    canCreateJobCards: boolean;
    canEditJobCards: boolean;
    canViewInventory: boolean;
    canManageInventory: boolean;
    canViewBilling: boolean;
    canCreateInvoices: boolean;
    canViewReports: boolean;
    canManageBranches: boolean;
    canManageUsers: boolean;
  }
> = {
  OWNER: {
    canViewDashboard: true,
    canViewJobCards: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewBilling: true,
    canCreateInvoices: true,
    canViewReports: true,
    canManageBranches: true,
    canManageUsers: true,
  },
  MANAGER: {
    canViewDashboard: true,
    canViewJobCards: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewBilling: false,
    canCreateInvoices: false,
    canViewReports: true,
    canManageBranches: false,
    canManageUsers: false,
  },
  RECEPTIONIST: {
    canViewDashboard: true,
    canViewJobCards: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canViewInventory: false,
    canManageInventory: false,
    canViewBilling: false,
    canCreateInvoices: false,
    canViewReports: false,
    canManageBranches: false,
    canManageUsers: false,
  },
  TECHNICIAN: {
    canViewDashboard: false,
    canViewJobCards: true,
    canCreateJobCards: false,
    canEditJobCards: true,
    canViewInventory: false,
    canManageInventory: false,
    canViewBilling: false,
    canCreateInvoices: false,
    canViewReports: false,
    canManageBranches: false,
    canManageUsers: false,
  },
  ACCOUNTANT: {
    canViewDashboard: false,
    canViewJobCards: false,
    canCreateJobCards: false,
    canEditJobCards: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewBilling: true,
    canCreateInvoices: true,
    canViewReports: true,
    canManageBranches: false,
    canManageUsers: false,
  },
};

// =====================================================
// Status Labels and Colors
// =====================================================

export const JOB_STATUS_CONFIG: Record<
  JobStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
  }
> = {
  RECEIVED: {
    label: "Received",
    color: "#6366f1",
    bgColor: "#eef2ff",
    textColor: "#4338ca",
  },
  DIAGNOSIS: {
    label: "Under Diagnosis",
    color: "#f59e0b",
    bgColor: "#fffbeb",
    textColor: "#b45309",
  },
  ESTIMATE_SHARED: {
    label: "Estimate Shared",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    textColor: "#6d28d9",
  },
  APPROVED: {
    label: "Customer Approved",
    color: "#10b981",
    bgColor: "#ecfdf5",
    textColor: "#047857",
  },
  REJECTED: {
    label: "Customer Rejected",
    color: "#ef4444",
    bgColor: "#fef2f2",
    textColor: "#b91c1c",
  },
  WAITING_FOR_PARTS: {
    label: "Waiting for Parts",
    color: "#f97316",
    bgColor: "#fff7ed",
    textColor: "#c2410c",
  },
  REPAIR_IN_PROGRESS: {
    label: "Repair in Progress",
    color: "#06b6d4",
    bgColor: "#ecfeff",
    textColor: "#0e7490",
  },
  READY_FOR_DELIVERY: {
    label: "Ready for Delivery",
    color: "#22c55e",
    bgColor: "#f0fdf4",
    textColor: "#15803d",
  },
  DELIVERED: {
    label: "Delivered",
    color: "#6366f1",
    bgColor: "#e0e7ff",
    textColor: "#3730a3",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#64748b",
    bgColor: "#f1f5f9",
    textColor: "#334155",
  },
};

export const INVOICE_STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  DRAFT: { label: "Draft", color: "#64748b", bgColor: "#f1f5f9" },
  PENDING: { label: "Pending", color: "#f59e0b", bgColor: "#fffbeb" },
  PARTIAL: { label: "Partially Paid", color: "#8b5cf6", bgColor: "#f5f3ff" },
  PAID: { label: "Paid", color: "#10b981", bgColor: "#ecfdf5" },
  CANCELLED: { label: "Cancelled", color: "#ef4444", bgColor: "#fef2f2" },
};
