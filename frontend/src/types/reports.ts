/** Domain type definitions. */
import type { UserRole, JobStatus, InvoiceStatus, UserPermissions } from "./core";
import type { PickupRequestStatus } from "./jobs";

export interface RevenueReportData {
  period: string;
  total_revenue: number;
  total_invoices: number;
  /** Some API versions nest summary fields under `totals` */
  totals?: {
    total_revenue: number;
    total_invoices: number;
  };
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

export const ROLE_PERMISSIONS: Record<UserRole, UserPermissions> = {
  SUPER_ADMIN: {
    canViewDashboard: true,
    canViewJobCards: true,
    canCreateJobCards: true,
    canEditJobCards: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewBilling: false,
    canCreateInvoices: false,
    canViewReports: true,
    canManageBranches: true,
    canManageUsers: true,
    canViewPickups: true,
  },
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
    canViewPickups: true,
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
    canViewPickups: true,
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
    canViewPickups: true,
  },
  TECHNICIAN: {
    canViewDashboard: true,
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
    canViewPickups: true,
  },
  ACCOUNTANT: {
    canViewDashboard: true,
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
    canViewPickups: false,
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
    label: "Inward Received",
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
  OUTSOURCED: {
    label: "Outsourced for Repair",
    color: "#ea580c",
    bgColor: "#fff7ed",
    textColor: "#c2410c",
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

export const PICKUP_STATUS_CONFIG: Record<
  PickupRequestStatus,
  {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
  }
> = {
  REQUESTED: {
    label: "Requested",
    color: "#6366f1",
    bgColor: "#eef2ff",
    textColor: "#4338ca",
  },
  ASSIGNED: {
    label: "Assigned",
    color: "#f59e0b",
    bgColor: "#fffbeb",
    textColor: "#b45309",
  },
  EN_ROUTE: {
    label: "En Route",
    color: "#06b6d4",
    bgColor: "#ecfeff",
    textColor: "#0e7490",
  },
  PICKED_UP: {
    label: "Picked Up",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    textColor: "#6d28d9",
  },
  DELIVERED_TO_CENTER: {
    label: "At Center",
    color: "#10b981",
    bgColor: "#ecfdf5",
    textColor: "#047857",
  },
  COMPLETED: {
    label: "Completed",
    color: "#22c55e",
    bgColor: "#f0fdf4",
    textColor: "#15803d",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#64748b",
    bgColor: "#f1f5f9",
    textColor: "#334155",
  },
};

// =====================================================
// Expense Types
// =====================================================
