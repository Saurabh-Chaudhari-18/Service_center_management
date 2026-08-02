/**
 * API Service Functions organized by module
 * All endpoints from the DRF backend
 */

import {
  apiGet,
  apiPost,
  apiPatch,
  apiUpload,
  apiDownload,
  apiDelete,
} from "./client";
import type {
  AuthTokens,
  AuthUser,
  User,
  Branch,
  Organization,
  OrganizationBranding,
  Customer,
  JobCard,
  CreateJobCardData,
  InventoryItem,
  StockAdjustment,
  Invoice,
  InvoiceLineItem,
  Payment,
  NotificationLog,
  InternalAlert,
  PaginatedResponse,
  RevenueReportData,
  TechnicianProductivityData,
  PickupRequest,
  Purchase,
  OutsourceVendor,
  OutsourcedRepair,
} from "@/types";

// =====================================================
// Authentication API
// =====================================================

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    return apiPost<AuthTokens>(
      "/auth/token/",
      { email, password },
      { timeout: 120000, withCredentials: true },
    );
  },

  refreshToken: async (): Promise<{ access: string }> => {
    return apiPost("/auth/token/refresh/", {}, { withCredentials: true });
  },

  logout: async (): Promise<void> => {
    return apiPost("/auth/logout/", {}, { withCredentials: true });
  },

  verifyToken: async (token: string): Promise<{ valid: boolean }> => {
    return apiPost("/auth/token/verify/", { token });
  },

  getMe: async (): Promise<AuthUser> => {
    return apiGet<AuthUser>("/core/users/me/");
  },

  getMyBranches: async (): Promise<Branch[]> => {
    return apiGet<Branch[]>("/core/users/my-branches/");
  },

  setCurrentBranch: async (branchId: string): Promise<void> => {
    return apiPost("/core/users/set-current-branch/", { branch_id: branchId });
  },

  changePassword: async (
    oldPassword: string,
    newPassword: string,
  ): Promise<void> => {
    return apiPost("/core/users/change-password/", {
      current_password: oldPassword,
      new_password: newPassword,
      new_password_confirm: newPassword,
    });
  },

  updateMe: async (data: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  }): Promise<AuthUser> => {
    return apiPatch<AuthUser>("/core/users/update-me/", data);
  },
};

// =====================================================
// Organizations API
// =====================================================

export const organizationsApi = {
  list: async (): Promise<PaginatedResponse<Organization>> => {
    return apiGet<PaginatedResponse<Organization>>("/core/organizations/");
  },

  get: async (id: string): Promise<Organization> => {
    return apiGet<Organization>(`/core/organizations/${id}/`);
  },

  create: async (data: Partial<Organization>): Promise<Organization> => {
    return apiPost<Organization>("/core/organizations/", data);
  },

  update: async (
    id: string,
    data: Partial<Organization>,
  ): Promise<Organization> => {
    return apiPatch<Organization>(`/core/organizations/${id}/`, data);
  },

  getBranding: async (): Promise<OrganizationBranding> => {
    return apiGet<OrganizationBranding>("/core/organizations/branding/");
  },
};

// =====================================================
// Branches API
// =====================================================

export const branchesApi = {
  list: async (): Promise<PaginatedResponse<Branch>> => {
    return apiGet<PaginatedResponse<Branch>>("/core/branches/");
  },

  get: async (id: string): Promise<Branch> => {
    return apiGet<Branch>(`/core/branches/${id}/`);
  },

  create: async (data: Partial<Branch>): Promise<Branch> => {
    return apiPost<Branch>("/core/branches/", data);
  },

  update: async (id: string, data: Partial<Branch>): Promise<Branch> => {
    return apiPatch<Branch>(`/core/branches/${id}/`, data);
  },

  assignUser: async (branchId: string, userId: string): Promise<void> => {
    return apiPost(`/core/branches/${branchId}/assign-user/`, {
      user_id: userId,
    });
  },
};

// =====================================================
// Users API
// =====================================================

export const usersApi = {
  list: async (params?: {
    role?: string;
    branch?: string;
  }): Promise<PaginatedResponse<User>> => {
    return apiGet<PaginatedResponse<User>>("/core/users/", params);
  },

  get: async (id: string): Promise<User> => {
    return apiGet<User>(`/core/users/${id}/`);
  },

  create: async (data: Partial<User> & { password: string }): Promise<User> => {
    return apiPost<User>("/core/users/", data);
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    return apiPatch<User>(`/core/users/${id}/`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiDelete(`/core/users/${id}/`);
  },

  assignBranches: async (
    id: string,
    branchIds: string[],
  ): Promise<{ message: string }> => {
    return apiPost(`/core/users/${id}/assign-branches/`, {
      branch_ids: branchIds,
    });
  },

  getRoles: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/core/roles/");
  },

  updateLocation: async (
    latitude: number,
    longitude: number,
  ): Promise<{ message: string }> => {
    return apiPost("/core/users/update-location/", { latitude, longitude });
  },
};

// =====================================================
// Customers API
// =====================================================

export const customersApi = {
  list: async (params?: {
    branch?: string;
    search?: string;
    page?: number;
    page_size?: number;
    is_active?: boolean;
  }): Promise<PaginatedResponse<Customer>> => {
    return apiGet<PaginatedResponse<Customer>>("/customers/", params);
  },

  get: async (id: string): Promise<Customer> => {
    return apiGet<Customer>(`/customers/${id}/`);
  },

  create: async (data: Partial<Customer>): Promise<Customer> => {
    return apiPost<Customer>("/customers/", data);
  },

  update: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    return apiPatch<Customer>(`/customers/${id}/`, data);
  },

  searchByMobile: async (mobile: string): Promise<Customer[]> => {
    return apiGet<Customer[]>("/customers/search-by-mobile/", {
      mobile,
    });
  },

  getServiceHistory: async (id: string): Promise<JobCard[]> => {
    return apiGet<JobCard[]>(`/customers/${id}/service-history/`);
  },

  requestDeletion: async (id: string): Promise<{ message: string }> => {
    return apiPost(`/customers/${id}/request-deletion/`, {});
  },
};

// =====================================================
// Job Cards API
// =====================================================

export const jobsApi = {
  list: async (params?: {
    branch?: string;
    status?: string;
    customer?: string;
    technician?: string;
    search?: string;
    page?: number;
    page_size?: number;
    is_urgent?: boolean;
  }): Promise<PaginatedResponse<JobCard>> => {
    return apiGet<PaginatedResponse<JobCard>>("/jobs/", params);
  },

  get: async (id: string): Promise<JobCard> => {
    return apiGet<JobCard>(`/jobs/${id}/`);
  },

  create: async (data: CreateJobCardData): Promise<JobCard> => {
    return apiPost<JobCard>("/jobs/", data);
  },

  update: async (id: string, data: Partial<JobCard>): Promise<JobCard> => {
    return apiPatch<JobCard>(`/jobs/${id}/`, data);
  },

  nextNumber: async (branchId: string): Promise<{ next_number: string }> => {
    return apiGet<{ next_number: string }>(`/jobs/next-number/`, {
      branch: branchId,
    });
  },

  // Job Lifecycle Actions
  assignTechnician: async (
    jobId: string,
    technicianId: string,
    notes?: string,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/assign-technician/`, {
      technician_id: technicianId,
      notes,
    });
  },

  addDiagnosis: async (
    jobId: string,
    diagnosisNotes: string,
    estimatedCost?: number,
    estimatedCompletionDate?: string,
    parts?: Array<{
      name: string;
      price: number;
      warranty_months?: number;
      quantity?: number;
    }>,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/add-diagnosis/`, {
      diagnosis_notes: diagnosisNotes,
      estimated_cost: estimatedCost,
      estimated_completion_date: estimatedCompletionDate,
      parts,
    });
  },

  shareEstimate: async (jobId: string): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/share-estimate/`);
  },

  recordCustomerResponse: async (
    jobId: string,
    approved: boolean,
    rejectionReason?: string,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/record-customer-response/`, {
      approved,
      rejection_reason: rejectionReason,
    });
  },

  updateStatus: async (
    jobId: string,
    newStatus: string,
    notes?: string,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/update-status/`, {
      new_status: newStatus,
      notes,
      is_override: true,
    });
  },

  markReady: async (
    jobId: string,
    completionNotes?: string,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/mark-ready/`, {
      completion_notes: completionNotes,
    });
  },

  deliver: async (
    jobId: string,
    otp: string,
    notes?: string,
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/${jobId}/deliver/`, { otp, notes });
  },

  resendDeliveryOtp: async (jobId: string): Promise<{ message: string; otp?: string }> => {
    return apiPost<{ message: string; otp?: string }>(`/jobs/${jobId}/resend-delivery-otp/`);
  },

  accessDevicePassword: async (
    jobId: string,
    reason: string,
  ): Promise<{ password: string }> => {
    return apiPost(`/jobs/${jobId}/access-device-password/`, { reason });
  },

  requestPart: async (
    jobId: string,
    partName: string,
    quantity: number,
    notes?: string,
  ): Promise<void> => {
    return apiPost(`/jobs/${jobId}/request-part/`, {
      part_name: partName,
      quantity,
      notes,
    });
  },

  addNote: async (
    jobId: string,
    note: string,
    isInternal: boolean = true,
  ): Promise<void> => {
    return apiPost(`/jobs/${jobId}/add-note/`, {
      note,
      is_internal: isInternal,
    });
  },

  getTimeline: async (
    jobId: string,
  ): Promise<
    Array<{
      timestamp: string;
      event_type: string;
      description: string;
      user_name: string;
    }>
  > => {
    return apiGet(`/jobs/${jobId}/timeline/`);
  },

  uploadPhoto: async (
    jobId: string,
    file: File,
    photoType: string,
    description?: string,
  ) => {
    return apiUpload(`/jobs/${jobId}/add-photo/`, file, "photo", {
      photo_type: photoType,
      description: description || "",
    });
  },

  // Lists
  getPending: async (): Promise<PaginatedResponse<JobCard>> => {
    return apiGet<PaginatedResponse<JobCard>>("/jobs/pending/");
  },

  getMyJobs: async (): Promise<PaginatedResponse<JobCard>> => {
    return apiGet<PaginatedResponse<JobCard>>("/jobs/my-jobs/");
  },

  /**
   * Get per-status job counts for the current branch.
   * Uses a DB aggregation endpoint so we don't have to download all jobs
   * just to count them for the status filter tabs.
   */
  getStats: async (params?: {
    branch?: string;
  }): Promise<{
    total: number;
    by_status: Record<string, number>;
    urgent?: number;
  }> => {
    return apiGet("/jobs/stats/", params);
  },

  // Enums
  getStatuses: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/jobs/enums/statuses/");
  },

  getDeviceTypes: async (): Promise<
    Array<{ value: string; label: string }>
  > => {
    return apiGet("/jobs/enums/device-types/");
  },

  // Outsource Actions
  outsource: async (
    jobId: string,
    data: {
      vendor: string;
      reason: string;
      sent_date: string;
      estimated_cost?: number | null;
      expected_return_date?: string | null;
      notes?: string;
    },
  ): Promise<OutsourcedRepair> => {
    return apiPost<OutsourcedRepair>(`/jobs/${jobId}/outsource/`, data);
  },

  markOutsourceReturned: async (
    jobId: string,
    outsourceId: string,
    data: {
      return_date: string;
      actual_cost?: number | null;
      repair_outcome: string;
      vendor_notes?: string;
      vendor_invoice_number?: string;
      new_job_status: string;
    },
  ): Promise<OutsourcedRepair> => {
    return apiPost<OutsourcedRepair>(
      `/jobs/${jobId}/outsource/${outsourceId}/return/`,
      data,
    );
  },
};

// =====================================================
// Outsource Vendors API
// =====================================================

export const outsourceVendorsApi = {
  list: async (params?: { search?: string }): Promise<PaginatedResponse<OutsourceVendor>> => {
    return apiGet<PaginatedResponse<OutsourceVendor>>("/jobs/outsource-vendors/", params);
  },

  create: async (data: Omit<OutsourceVendor, "id" | "created_at" | "updated_at">): Promise<OutsourceVendor> => {
    return apiPost<OutsourceVendor>("/jobs/outsource-vendors/", data);
  },
};

// =====================================================
// Outsourced Repairs List API
// =====================================================

export const outsourcedRepairsApi = {
  list: async (params?: {
    search?: string;
    status?: string;
    repair_outcome?: string;
    vendor?: string;
    ordering?: string;
    page?: number;
    page_size?: number;
    is_warranty_repair?: boolean;
  }): Promise<PaginatedResponse<OutsourcedRepair>> => {
    return apiGet<PaginatedResponse<OutsourcedRepair>>("/jobs/outsourced-repairs/", params);
  },

  get: async (id: string): Promise<OutsourcedRepair> => {
    return apiGet<OutsourcedRepair>(`/jobs/outsourced-repairs/${id}/`);
  },

  createWarrantyOutsource: async (data: {
    branch?: string;
    inventory_item?: string;
    item_name?: string;
    serial_number?: string;
    customer_name?: string;
    customer_phone?: string;
    is_warranty_repair?: boolean;
    vendor: string;
    reason: string;
    sent_date: string;
    estimated_cost?: number | null;
    expected_return_date?: string | null;
    notes?: string;
  }): Promise<OutsourcedRepair> => {
    return apiPost<OutsourcedRepair>("/jobs/outsourced-repairs/", data);
  },

  markReturned: async (
    outsourceId: string,
    data: {
      return_date: string;
      actual_cost?: number | null;
      repair_outcome: string;
      vendor_notes?: string;
      vendor_invoice_number?: string;
      new_job_status?: string;
    },
  ): Promise<OutsourcedRepair> => {
    return apiPost<OutsourcedRepair>(
      `/jobs/outsourced-repairs/${outsourceId}/return/`,
      data,
    );
  },
};

// =====================================================
// Dropdown Options API
// =====================================================

export interface DropdownOptionItem {
  id: string;
  category: string;
  category_display: string;
  device_type: string | null;
  device_type_display: string | null;
  label: string;
  display_order: number;
  is_active: boolean;
  has_text_input: boolean;
}

export const dropdownOptionsApi = {
  list: async (params?: {
    category?: string;
    device_type?: string;
    is_active?: boolean;
  }): Promise<DropdownOptionItem[]> => {
    const res = await apiGet<
      DropdownOptionItem[] | { results: DropdownOptionItem[] }
    >("/jobs/dropdown-options/", params);
    return Array.isArray(res) ? res : (res as any)?.results || [];
  },

  create: async (
    data: Partial<DropdownOptionItem>,
  ): Promise<DropdownOptionItem> => {
    return apiPost<DropdownOptionItem>("/jobs/dropdown-options/", data);
  },

  update: async (
    id: string,
    data: Partial<DropdownOptionItem>,
  ): Promise<DropdownOptionItem> => {
    return apiPatch<DropdownOptionItem>(`/jobs/dropdown-options/${id}/`, data);
  },

  delete: async (id: string): Promise<void> => {
    return apiDelete(`/jobs/dropdown-options/${id}/`);
  },
};

// =====================================================
// Inventory API
// =====================================================

export const inventoryApi = {
  list: async (params?: {
    branch?: string;
    search?: string;
    low_stock?: boolean;
    category?: string;
    page?: number;
    /** Page size (backend may map to `limit` / `page_size`) */
    limit?: number;
  }): Promise<PaginatedResponse<InventoryItem>> => {
    return apiGet<PaginatedResponse<InventoryItem>>(
      "/inventory/items/",
      params,
    );
  },

  get: async (id: string): Promise<InventoryItem> => {
    return apiGet<InventoryItem>(`/inventory/items/${id}/`);
  },

  create: async (data: Partial<InventoryItem>): Promise<InventoryItem> => {
    return apiPost<InventoryItem>("/inventory/items/", data);
  },

  update: async (
    id: string,
    data: Partial<InventoryItem>,
  ): Promise<InventoryItem> => {
    return apiPatch<InventoryItem>(`/inventory/items/${id}/`, data);
  },

  addStock: async (
    id: string,
    quantity: number,
    reason: string,
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/add-stock/`, {
      quantity,
      reason,
    });
  },

  deductStock: async (
    id: string,
    quantity: number,
    reason: string,
    jobId?: string,
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/deduct-stock/`, {
      quantity,
      reason,
      job_id: jobId,
    });
  },

  adjustStock: async (
    id: string,
    newQuantity: number,
    reason: string,
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/adjust-stock/`, {
      new_quantity: newQuantity,
      reason,
    });
  },

  getAdjustments: async (id: string): Promise<StockAdjustment[]> => {
    const res = await apiGet<StockAdjustment[]>(
      `/inventory/items/${id}/adjustments/`,
    );
    return Array.isArray(res) ? res : (res as any)?.results || [];
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/inventory/items/low-stock/");
  },

  getOutOfStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/inventory/items/out-of-stock/");
  },

  getStats: async (): Promise<{
    total_items: number;
    total_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  }> => {
    return apiGet("/inventory/items/stats/");
  },

  getCategoryStats: async (
    branchId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      item_count: number;
      total_quantity: number;
    }>
  > => {
    return apiGet("/inventory/items/category-stats/", { branch: branchId });
  },

  listCategories: async (
    branchId: string,
  ): Promise<Array<{ id: string; name: string; description: string }>> => {
    const res = await apiGet("/inventory/categories/", { branch: branchId });
    return Array.isArray(res)
      ? res
      : (
          res as {
            results: Array<{ id: string; name: string; description: string }>;
          }
        )?.results || [];
  },
};

// =====================================================
// Purchases API
// =====================================================

export const purchasesApi = {
  list: async (params?: {
    branch?: string;
    search?: string;
    page?: number;
    page_size?: number;
    /** When "true", only purchases with vendor balance outstanding */
    has_outstanding?: string;
  }): Promise<PaginatedResponse<Purchase>> => {
    return apiGet<PaginatedResponse<Purchase>>("/inventory/purchases/", params);
  },

  outstandingTotal: async (params?: {
    branch?: string;
  }): Promise<{ total_outstanding: string }> => {
    return apiGet<{ total_outstanding: string }>(
      "/inventory/purchases/outstanding-total/",
      params,
    );
  },

  get: async (id: string): Promise<Purchase> => {
    return apiGet<Purchase>(`/inventory/purchases/${id}/`);
  },

  create: async (data: Partial<Purchase>): Promise<Purchase> => {
    return apiPost<Purchase>("/inventory/purchases/", data);
  },

  update: async (id: string, data: Partial<Purchase>): Promise<Purchase> => {
    return apiPatch<Purchase>(`/inventory/purchases/${id}/`, data);
  },

  importExcel: async (file: File, vendorName: string, invoiceNumber: string, purchaseDate: string, paidAmount?: string, paymentMethod?: string) => {
    return apiUpload<{ message: string; purchase_id: string; total_amount: number }>("/inventory/purchases/import-excel/", file, "file", {
      vendor_name: vendorName,
      invoice_number: invoiceNumber || "",
      purchase_date: purchaseDate,
      paid_amount: paidAmount || "0",
      payment_method: paymentMethod || "CASH"
    });
  },

  recordPayment: async (id: string, amount: number, payment_method: string, notes: string = "") => {
    return apiPost<{ message: string; paid_amount: string; balance_due: string; status: string }>(
      `/inventory/purchases/${id}/record-payment/`,
      { amount, payment_method, notes }
    );
  },
};

// =====================================================
// Billing API
// =====================================================

export const billingApi = {
  listInvoices: async (params?: {
    branch?: string;
    search?: string;
    status?: string;
    customer_name?: string;
    invoice_date_after?: string;
    invoice_date_before?: string;
    from_date?: string;
    to_date?: string;
    page?: number;
  }): Promise<PaginatedResponse<Invoice>> => {
    return apiGet<PaginatedResponse<Invoice>>("/billing/invoices/", params);
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    return apiGet<Invoice>(`/billing/invoices/${id}/`);
  },

  createInvoice: async (data: {
    branch: string | null;
    job_id?: string | null;
    customer_id?: string | null;
    due_date?: string;
    notes?: string;
    line_items: Array<{
      item_type: string;
      description: string;
      hsn_sac_code?: string;
      quantity: number;
      unit_price: number;
      gst_rate: number;
      inventory_item?: string | null;
    }>;
  }): Promise<Invoice> => {
    return apiPost<Invoice>("/billing/invoices/", data);
  },

  updateInvoice: async (
    id: string,
    data: {
      branch?: string | null;
      due_date?: string | null;
      notes?: string;
      line_items?: Array<{
        id?: string;
        item_type: string;
        description: string;
        hsn_sac_code?: string;
        quantity: number;
        unit_price: number;
        gst_rate: number;
        inventory_item?: string | null;
      }>;
    },
  ): Promise<Invoice> => {
    return apiPatch<Invoice>(`/billing/invoices/${id}/`, data);
  },

  addLineItem: async (
    invoiceId: string,
    lineItem: Partial<InvoiceLineItem>,
  ): Promise<Invoice> => {
    return apiPost<Invoice>(
      `/billing/invoices/${invoiceId}/add-line-item/`,
      lineItem,
    );
  },

  finalizeInvoice: async (invoiceId: string): Promise<Invoice> => {
    return apiPost<Invoice>(`/billing/invoices/${invoiceId}/finalize/`);
  },

  recordPayment: async (
    invoiceId: string,
    amount: number,
    paymentMethod: string,
    reference?: string,
    notes?: string,
  ): Promise<Payment> => {
    return apiPost<Payment>(`/billing/invoices/${invoiceId}/record-payment/`, {
      amount,
      payment_method: paymentMethod,
      reference,
      notes,
    });
  },

  getPayments: async (invoiceId: string): Promise<Payment[]> => {
    return apiGet<Payment[]>(`/billing/invoices/${invoiceId}/payments/`);
  },

  getEditHistory: async (invoiceId: string): Promise<any[]> => {
    return apiGet<any[]>(`/billing/invoices/${invoiceId}/edit-history/`);
  },

  logDownload: async (invoiceId: string): Promise<void> => {
    return apiPost<void>(`/billing/invoices/${invoiceId}/log-download/`);
  },

  downloadPdf: async (
    invoiceId: string,
    invoiceNumber: string,
  ): Promise<void> => {
    return apiDownload(
      `/billing/invoices/${invoiceId}/download-pdf/`,
      `${invoiceNumber}.pdf`,
    );
  },

  cancelInvoice: async (
    invoiceId: string,
    reason: string,
  ): Promise<Invoice> => {
    return apiPost<Invoice>(`/billing/invoices/${invoiceId}/cancel/`, {
      reason,
    });
  },

  getStats: async (params?: {
    from_date?: string;
    to_date?: string;
    branch?: string;
  }): Promise<{
    total_invoiced: number;
    total_paid: number;
    total_pending: number;
    invoice_count: number;
  }> => {
    return apiGet("/billing/invoices/stats/", params);
  },

  getPending: async (): Promise<Invoice[]> => {
    return apiGet<Invoice[]>("/billing/invoices/pending/");
  },

  getPaymentMethods: async (): Promise<
    Array<{ value: string; label: string }>
  > => {
    return apiGet("/billing/payment-methods/");
  },
};

// =====================================================
// Notifications API
// =====================================================

export const notificationsApi = {
  listTemplates: async (): Promise<
    Array<{
      id: string;
      notification_type: string;
      channel: string;
      template_text: string;
      is_active: boolean;
    }>
  > => {
    const res = await apiGet<any>("/notifications/templates/");
    return Array.isArray(res) ? res : res?.results || [];
  },

  createDefaultTemplates: async (branchId: string): Promise<void> => {
    return apiPost("/notifications/templates/create-defaults/", {
      branch_id: branchId,
    });
  },

  updateTemplate: async (
    id: string,
    data: { is_active: boolean; template_text?: string },
  ): Promise<void> => {
    return apiPatch(`/notifications/templates/${id}/`, data);
  },

  listLogs: async (params?: {
    status?: string;
    channel?: string;
    page?: number;
  }): Promise<PaginatedResponse<NotificationLog>> => {
    return apiGet<PaginatedResponse<NotificationLog>>(
      "/notifications/logs/",
      params,
    );
  },

  listAlerts: async (): Promise<PaginatedResponse<InternalAlert>> => {
    return apiGet<PaginatedResponse<InternalAlert>>("/notifications/alerts/");
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    return apiGet("/notifications/alerts/unread-count/");
  },

  markAllRead: async (): Promise<void> => {
    return apiPost("/notifications/alerts/mark-all-read/");
  },

  retryLog: async (logId: string): Promise<void> => {
    return apiPost(`/notifications/logs/${logId}/retry/`, {});
  },

  sendCustomNotification: async (data: {
    channel: "SMS" | "WHATSAPP";
    recipient_mobile: string;
    recipient_name: string;
    message: string;
  }): Promise<void> => {
    return apiPost("/notifications/send/", data);
  },
};

// =====================================================
// Reports API
// =====================================================

export const reportsApi = {
  getRevenue: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<RevenueReportData> => {
    return apiGet<RevenueReportData>("/reports/revenue/", params);
  },

  getPendingJobs: async (params?: {
    branch?: string;
  }): Promise<{
    total_pending: number;
    urgent_count: number;
    overdue_count: number;
    by_status: Array<{ status: string; count: number }>;
    by_branch: Array<{
      branch: string;
      branch__name: string;
      count: number;
      urgent_count: number;
    }>;
    by_age: Record<string, number>;
  }> => {
    return apiGet("/reports/pending-jobs/", params);
  },

  getTechnicianProductivity: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    from_date: string;
    to_date: string;
    technicians: TechnicianProductivityData[];
  }> => {
    return apiGet("/reports/technician-productivity/", params);
  },

  getInventoryConsumption: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    from_date: string;
    to_date: string;
    top_items: Array<{
      inventory_item: string;
      inventory_item__name: string;
      inventory_item__sku: string;
      total_quantity: number;
      total_value: number;
      usage_count: number;
    }>;
    by_category: Array<{
      inventory_item__category: string;
      inventory_item__category__name: string;
      total_quantity: number;
      total_value: number;
    }>;
    daily_usage: Array<{
      date: string;
      quantity: number;
      value: number;
    }>;
    totals: {
      total_quantity: number;
      total_value: number;
      total_transactions: number;
    };
  }> => {
    return apiGet("/reports/inventory-consumption/", params);
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/reports/low-stock/");
  },

  getCustomerAnalysis: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    from_date: string;
    to_date: string;
    total_customers: number;
    new_customers: number;
    top_customers: Array<{
      job__customer: string;
      job__customer__first_name: string;
      job__customer__last_name: string;
      job__customer__mobile: string;
      total_revenue: number;
      invoice_count: number;
    }>;
  }> => {
    return apiGet("/reports/customer-analysis/", params);
  },

  getGstSummary: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    from_date: string;
    to_date: string;
    summary: {
      total_taxable: number;
      total_cgst: number;
      total_sgst: number;
      total_igst: number;
      total_tax: number;
      total_value: number;
      invoice_count: number;
    };
    by_rate: Array<{
      gst_rate: number;
      taxable_amount: number;
      cgst_amount: number;
      sgst_amount: number;
      igst_amount: number;
    }>;
    by_supply_type: Array<{
      is_interstate: boolean;
      count: number;
      total: number;
    }>;
  }> => {
    return apiGet("/reports/gst-summary/", params);
  },

  exportExcel: async (
    reportType: string,
    params: { from_date: string; to_date: string; branch?: string },
  ): Promise<void> => {
    const filename = `${reportType}_report_${params.from_date}_${params.to_date}.xlsx`;
    return apiDownload(
      `/reports/export-excel/?report=${reportType}&from_date=${
        params.from_date
      }&to_date=${params.to_date}${
        params.branch ? `&branch=${params.branch}` : ""
      }`,
      filename,
    );
  },

  getNetProfit: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    from_date: string;
    to_date: string;
    revenue: number;
    expenses: number;
    net_profit: number;
    profit_margin: number;
  }> => {
    return apiGet("/reports/net-profit/", params);
  },

  gstr1Export: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<void> => {
    const filename = `GSTR1_${params.from_date}_${params.to_date}.xlsx`;
    return apiDownload(
      `/reports/gstr1-export/?from_date=${params.from_date}&to_date=${params.to_date}${
        params.branch ? `&branch=${params.branch}` : ""
      }`,
      filename,
    );
  },
};

// =====================================================
// Audit API
// =====================================================

export const auditApi = {
  listLogs: async (params?: {
    model?: string;
    action?: string;
    user?: string;
    page?: number;
  }): Promise<
    PaginatedResponse<{
      id: string;
      user: string;
      user_name: string;
      action: string;
      model_name: string;
      object_id: string;
      details: Record<string, unknown>;
      created_at: string;
    }>
  > => {
    return apiGet("/audit/logs/", params);
  },

  getForObject: async (model: string, id: string) => {
    return apiGet("/audit/logs/for-object/", { model, id });
  },

  listPasswordAccess: async () => {
    return apiGet("/audit/password-access/");
  },

  getPasswordAccessForJob: async (jobId: string) => {
    return apiGet("/audit/password-access/for-job/", { job_id: jobId });
  },

  listLogins: async () => {
    return apiGet("/audit/logins/");
  },

  listExports: async () => {
    return apiGet("/audit/exports/");
  },
};

// =====================================================
// Pickup & Drop API
// =====================================================

export const pickupsApi = {
  list: async (
    params?: Record<string, unknown>,
  ): Promise<PaginatedResponse<PickupRequest>> => {
    return apiGet("/jobs/pickups/", params);
  },

  get: async (id: string): Promise<PickupRequest> => {
    return apiGet(`/jobs/pickups/${id}/`);
  },

  create: async (data: {
    branch: string;
    customer_id: string;
    device_type: string;
    brand?: string;
    model_name?: string;
    customer_complaint: string;
    pickup_address: string;
    pickup_date: string;
    pickup_time_slot?: string;
    contact_number: string;
    notes?: string;
    is_urgent?: boolean;
  }): Promise<PickupRequest> => {
    return apiPost("/jobs/pickups/", data);
  },

  getStats: async (): Promise<{
    total: number;
    requested: number;
    assigned: number;
    en_route: number;
    picked_up: number;
    delivered_to_center: number;
    completed: number;
    cancelled: number;
    pending: number;
  }> => {
    return apiGet("/jobs/pickups/stats/");
  },

  assignTechnician: async (
    id: string,
    technicianId: string,
  ): Promise<PickupRequest> => {
    return apiPost(`/jobs/pickups/${id}/assign-technician/`, {
      technician_id: technicianId,
    });
  },

  updateStatus: async (
    id: string,
    newStatus: string,
    notes?: string,
  ): Promise<PickupRequest> => {
    return apiPost(`/jobs/pickups/${id}/update-status/`, {
      new_status: newStatus,
      notes: notes || "",
    });
  },

  convertToJob: async (
    id: string,
  ): Promise<{
    message: string;
    job_id: string;
    job_number: string;
    pickup_number: string;
  }> => {
    return apiPost(`/jobs/pickups/${id}/convert-to-job/`, {});
  },

  track: async (
    id: string,
  ): Promise<{
    latitude: number | null;
    longitude: number | null;
    last_updated: string | null;
  }> => {
    return apiGet(`/jobs/pickups/${id}/track/`);
  },
};

// =====================================================
// Expenses API
// =====================================================

export const expensesApi = {
  list: async (params?: {
    branch?: string;
    category?: string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
  }): Promise<PaginatedResponse<any>> => {
    return apiGet("/expenses/", params);
  },

  get: async (id: string) => {
    return apiGet(`/expenses/${id}/`);
  },

  create: async (data: Record<string, unknown>) => {
    return apiPost("/expenses/", data);
  },

  update: async (id: string, data: Record<string, unknown>) => {
    return apiPatch(`/expenses/${id}/`, data);
  },

  delete: async (id: string) => {
    return apiDelete(`/expenses/${id}/`);
  },

  getStats: async (params?: {
    date_from?: string;
    date_to?: string;
    branch?: string;
  }) => {
    return apiGet("/expenses/stats/", params);
  },

  getCategories: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/expenses/categories/");
  },
};

// =====================================================
// Enquiries API
// =====================================================

export const enquiriesApi = {
  list: async (params?: {
    branch?: string;
    status?: string;
    source?: string;
    search?: string;
    today_followups?: string;
    overdue?: string;
    page?: number;
  }): Promise<PaginatedResponse<any>> => {
    return apiGet("/enquiries/", params);
  },

  get: async (id: string) => {
    return apiGet(`/enquiries/${id}/`);
  },

  create: async (data: Record<string, unknown>) => {
    return apiPost("/enquiries/", data);
  },

  update: async (id: string, data: Record<string, unknown>) => {
    return apiPatch(`/enquiries/${id}/`, data);
  },

  addNote: async (id: string, note: string) => {
    return apiPost(`/enquiries/${id}/add-note/`, { note });
  },

  convertToJob: async (id: string): Promise<{
    message: string;
    job_id: string;
    job_number: string;
    customer_id: string;
  }> => {
    return apiPost(`/enquiries/${id}/convert-to-job/`, {});
  },

  markLost: async (id: string, loss_reason: string) => {
    return apiPost(`/enquiries/${id}/mark-lost/`, { loss_reason });
  },

  getStats: async (params?: {
    date_from?: string;
    date_to?: string;
    branch?: string;
  }) => {
    return apiGet("/enquiries/stats/", params);
  },

  getSources: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/enquiries/sources/");
  },

  getStatuses: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/enquiries/statuses/");
  },
};

// =====================================================
// Suppliers API
// =====================================================

export const suppliersApi = {
  list: async (params?: {
    branch?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<any>> => {
    return apiGet("/suppliers/", params);
  },

  get: async (id: string) => {
    return apiGet(`/suppliers/${id}/`);
  },

  create: async (data: Record<string, unknown>) => {
    return apiPost("/suppliers/", data);
  },

  update: async (id: string, data: Record<string, unknown>) => {
    return apiPatch(`/suppliers/${id}/`, data);
  },

  delete: async (id: string) => {
    return apiDelete(`/suppliers/${id}/`);
  },
};

// =====================================================
// Customer Ledger API
// =====================================================

export const ledgerApi = {
  list: async (params?: {
    customer?: string;
    branch?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<any>> => {
    return apiGet("/customers/ledger/", params);
  },

  create: async (data: Record<string, unknown>) => {
    return apiPost("/customers/ledger/", data);
  },

  getStatement: async (customerId: string) => {
    return apiGet("/customers/ledger/customer-statement/", { customer: customerId });
  },

  getOutstanding: async () => {
    return apiGet("/customers/ledger/outstanding/");
  },
};

// =====================================================
// GST Module API
// =====================================================

export const gstApi = {
  getDashboard: (params: { from_date?: string; to_date?: string; branch?: string }) =>
    apiGet("/gst/dashboard/", params),

  getITCRegister: (params: { from_date?: string; to_date?: string; source?: string; branch?: string }) =>
    apiGet("/gst/itc-register/", params),

  getOutputRegister: (params: { from_date?: string; to_date?: string; branch?: string }) =>
    apiGet("/gst/output-register/", params),

  getGSTR1Data: (params: { from_date?: string; to_date?: string; branch?: string }) =>
    apiGet("/gst/gstr1-data/", params),

  downloadGSTR1JSON: async (params: { from_date: string; to_date: string; branch?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const url = `/gst/gstr1-json/?${query}`;
    return apiDownload(url, `GSTR1_${params.from_date}_${params.to_date}.json`);
  },

  getGSTR3BSummary: (params: { from_date?: string; to_date?: string; branch?: string }) =>
    apiGet("/gst/gstr3b-summary/", params),

  getPayments: (params?: { branch?: string }) =>
    apiGet("/gst/payments/", params),

  addPayment: (data: Record<string, unknown>) =>
    apiPost("/gst/payments/", data),

  getHSNCodes: (params?: { q?: string }) =>
    apiGet("/gst/hsn-codes/", params),

  addHSNCode: (data: Record<string, unknown>) =>
    apiPost("/gst/hsn-codes/", data),

  updateHSNCode: (id: string, data: Record<string, unknown>) =>
    apiPatch(`/gst/${id}/hsn/`, data),

  markFiled: (data: { period_month: string; return_type: "gstr1" | "gstr3b" }) =>
    apiPost("/gst/mark-filed/", data),
};

