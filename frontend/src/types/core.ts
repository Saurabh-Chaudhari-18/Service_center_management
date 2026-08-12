/** Domain type definitions. */
// =====================================================
// Core Type Definitions for Service Center Management
// =====================================================

// User Roles (from backend Role model)
export type UserRole =
  | "SUPER_ADMIN"
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
  | "OUTSOURCED"
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
  tagline: string;
  primary_color: string;
  favicon: string | null;
  // Invoice configuration
  invoice_terms: string;
  invoice_notes: string;
  bank_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_branch: string;
  upi_id: string;
  authorized_signatory: string;
  // Job card configuration
  jobcard_terms: string;
  jobcard_warranty_text: string;
  is_active: boolean;
}

export interface OrganizationBranding {
  id?: string;
  name: string;
  legal_name?: string;
  tagline: string;
  logo: string | null;
  primary_color: string;
  favicon: string | null;
  email?: string;
  phone?: string;
  website?: string;
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
  gst_enabled: boolean;
  is_active: boolean;
  bank_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  upi_id?: string;
  authorized_signatory?: string;
  effective_bank_name?: string;
  effective_bank_account_number?: string;
  effective_bank_ifsc?: string;
  effective_bank_branch?: string;
  effective_upi_id?: string;
  effective_authorized_signatory?: string;
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
  onboarding_dismissed: boolean;
}

export interface AuthTokens {
  authenticated: boolean;
}

export interface UserPermissions {
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
  canViewPickups: boolean;
}

export interface AuthUser extends User {
  accessible_branches: Branch[];
  current_branch?: Branch;
  permissions?: UserPermissions;
}

// =====================================================
// Customer
// =====================================================
