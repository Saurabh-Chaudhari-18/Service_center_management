/**
 * API Service Functions organized by module
 * All endpoints from the DRF backend
 */

import { apiGet, apiPost, apiPatch, apiUpload, apiDownload } from "./client";
import type {
  AuthTokens,
  AuthUser,
  User,
  Branch,
  Organization,
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
  PendingJobsReportData,
  TechnicianProductivityData,
  InventoryConsumptionData,
} from "@/types";

// =====================================================
// Authentication API
// =====================================================

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    return apiPost<AuthTokens>("/auth/token/", { email, password });
  },

  refreshToken: async (refresh: string): Promise<{ access: string }> => {
    return apiPost("/auth/token/refresh/", { refresh });
  },

  verifyToken: async (token: string): Promise<{ valid: boolean }> => {
    return apiPost("/auth/token/verify/", { token });
  },

  getMe: async (): Promise<AuthUser> => {
    return apiGet<AuthUser>("/core/users/me/");
  },

  getMyBranches: async (): Promise<Branch[]> => {
    return apiGet<Branch[]>("/core/users/my_branches/");
  },

  setCurrentBranch: async (branchId: string): Promise<void> => {
    return apiPost("/core/users/set_current_branch/", { branch_id: branchId });
  },

  changePassword: async (
    oldPassword: string,
    newPassword: string
  ): Promise<void> => {
    return apiPost("/core/users/change_password/", {
      old_password: oldPassword,
      new_password: newPassword,
    });
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
    data: Partial<Organization>
  ): Promise<Organization> => {
    return apiPatch<Organization>(`/core/organizations/${id}/`, data);
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
    return apiPost(`/core/branches/${branchId}/assign_user/`, {
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

  getRoles: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/core/users/roles/");
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
  }): Promise<PaginatedResponse<Customer>> => {
    return apiGet<PaginatedResponse<Customer>>("/customers/customers/", params);
  },

  get: async (id: string): Promise<Customer> => {
    return apiGet<Customer>(`/customers/customers/${id}/`);
  },

  create: async (data: Partial<Customer>): Promise<Customer> => {
    return apiPost<Customer>("/customers/customers/", data);
  },

  update: async (id: string, data: Partial<Customer>): Promise<Customer> => {
    return apiPatch<Customer>(`/customers/customers/${id}/`, data);
  },

  searchByMobile: async (mobile: string): Promise<Customer[]> => {
    return apiGet<Customer[]>("/customers/customers/search_by_mobile/", {
      mobile,
    });
  },

  getServiceHistory: async (id: string): Promise<JobCard[]> => {
    return apiGet<JobCard[]>(`/customers/customers/${id}/service_history/`);
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
  }): Promise<PaginatedResponse<JobCard>> => {
    return apiGet<PaginatedResponse<JobCard>>("/jobs/jobs/", params);
  },

  get: async (id: string): Promise<JobCard> => {
    return apiGet<JobCard>(`/jobs/jobs/${id}/`);
  },

  create: async (data: CreateJobCardData): Promise<JobCard> => {
    return apiPost<JobCard>("/jobs/jobs/", data);
  },

  update: async (id: string, data: Partial<JobCard>): Promise<JobCard> => {
    return apiPatch<JobCard>(`/jobs/jobs/${id}/`, data);
  },

  nextNumber: async (branchId: string): Promise<{ next_number: string }> => {
    return apiGet<{ next_number: string }>(`/jobs/jobs/next_number/`, {
      branch: branchId,
    });
  },

  // Job Lifecycle Actions
  assignTechnician: async (
    jobId: string,
    technicianId: string,
    notes?: string
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/assign_technician/`, {
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
      warranty_days?: number;
      quantity?: number;
    }>
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/add_diagnosis/`, {
      diagnosis_notes: diagnosisNotes,
      estimated_cost: estimatedCost,
      estimated_completion_date: estimatedCompletionDate,
      parts,
    });
  },

  shareEstimate: async (jobId: string): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/share_estimate/`);
  },

  recordCustomerResponse: async (
    jobId: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/record_customer_response/`, {
      approved,
      rejection_reason: rejectionReason,
    });
  },

  updateStatus: async (
    jobId: string,
    newStatus: string,
    notes?: string
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/update_status/`, {
      new_status: newStatus,
      notes,
    });
  },

  markReady: async (
    jobId: string,
    completionNotes?: string
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/mark_ready/`, {
      completion_notes: completionNotes,
    });
  },

  deliver: async (
    jobId: string,
    otp: string,
    notes?: string
  ): Promise<JobCard> => {
    return apiPost<JobCard>(`/jobs/jobs/${jobId}/deliver/`, { otp, notes });
  },

  resendDeliveryOtp: async (jobId: string): Promise<void> => {
    return apiPost(`/jobs/jobs/${jobId}/resend_delivery_otp/`);
  },

  accessDevicePassword: async (
    jobId: string,
    reason: string
  ): Promise<{ password: string }> => {
    return apiPost(`/jobs/jobs/${jobId}/access_device_password/`, { reason });
  },

  requestPart: async (
    jobId: string,
    partName: string,
    quantity: number,
    notes?: string
  ): Promise<void> => {
    return apiPost(`/jobs/jobs/${jobId}/request_part/`, {
      part_name: partName,
      quantity,
      notes,
    });
  },

  addNote: async (
    jobId: string,
    note: string,
    isInternal: boolean = true
  ): Promise<void> => {
    return apiPost(`/jobs/jobs/${jobId}/add_note/`, {
      note,
      is_internal: isInternal,
    });
  },

  getTimeline: async (
    jobId: string
  ): Promise<
    Array<{
      timestamp: string;
      event_type: string;
      description: string;
      user_name: string;
    }>
  > => {
    return apiGet(`/jobs/jobs/${jobId}/timeline/`);
  },

  uploadPhoto: async (
    jobId: string,
    file: File,
    photoType: string,
    description?: string
  ) => {
    return apiUpload(`/jobs/jobs/${jobId}/upload_photo/`, file, "photo", {
      photo_type: photoType,
      description: description || "",
    });
  },

  // Lists
  getPending: async (): Promise<PaginatedResponse<JobCard>> => {
    return apiGet<PaginatedResponse<JobCard>>("/jobs/jobs/pending/");
  },

  getMyJobs: async (): Promise<JobCard[]> => {
    return apiGet<JobCard[]>("/jobs/jobs/my_jobs/");
  },

  // Enums
  getStatuses: async (): Promise<Array<{ value: string; label: string }>> => {
    return apiGet("/jobs/enums/statuses/");
  },

  getDeviceTypes: async (): Promise<
    Array<{ value: string; label: string }>
  > => {
    return apiGet("/jobs/enums/device_types/");
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
    page?: number;
  }): Promise<PaginatedResponse<InventoryItem>> => {
    return apiGet<PaginatedResponse<InventoryItem>>(
      "/inventory/items/",
      params
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
    data: Partial<InventoryItem>
  ): Promise<InventoryItem> => {
    return apiPatch<InventoryItem>(`/inventory/items/${id}/`, data);
  },

  addStock: async (
    id: string,
    quantity: number,
    reason: string
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/add_stock/`, {
      quantity,
      reason,
    });
  },

  deductStock: async (
    id: string,
    quantity: number,
    reason: string,
    jobId?: string
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/deduct_stock/`, {
      quantity,
      reason,
      job_id: jobId,
    });
  },

  adjustStock: async (
    id: string,
    newQuantity: number,
    reason: string
  ): Promise<InventoryItem> => {
    return apiPost<InventoryItem>(`/inventory/items/${id}/adjust_stock/`, {
      new_quantity: newQuantity,
      reason,
    });
  },

  getAdjustments: async (id: string): Promise<StockAdjustment[]> => {
    return apiGet<StockAdjustment[]>(`/inventory/items/${id}/adjustments/`);
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/inventory/items/low_stock/");
  },

  getOutOfStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/inventory/items/out_of_stock/");
  },

  getStats: async (): Promise<{
    total_items: number;
    total_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  }> => {
    return apiGet("/inventory/items/stats/");
  },
};

// =====================================================
// Billing API
// =====================================================

export const billingApi = {
  listInvoices: async (params?: {
    branch?: string;
    status?: string;
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
    branch: string;
    job_id: string;
    due_date?: string;
    notes?: string;
    line_items: Array<{
      item_type: string;
      description: string;
      hsn_sac_code?: string;
      quantity: number;
      unit_price: number;
      gst_rate: number;
    }>;
  }): Promise<Invoice> => {
    return apiPost<Invoice>("/billing/invoices/", data);
  },

  addLineItem: async (
    invoiceId: string,
    lineItem: Partial<InvoiceLineItem>
  ): Promise<Invoice> => {
    return apiPost<Invoice>(
      `/billing/invoices/${invoiceId}/add_line_item/`,
      lineItem
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
    notes?: string
  ): Promise<Payment> => {
    return apiPost<Payment>(`/billing/invoices/${invoiceId}/record_payment/`, {
      amount,
      payment_method: paymentMethod,
      reference,
      notes,
    });
  },

  getPayments: async (invoiceId: string): Promise<Payment[]> => {
    return apiGet<Payment[]>(`/billing/invoices/${invoiceId}/payments/`);
  },

  downloadPdf: async (
    invoiceId: string,
    invoiceNumber: string
  ): Promise<void> => {
    return apiDownload(
      `/billing/invoices/${invoiceId}/download_pdf/`,
      `${invoiceNumber}.pdf`
    );
  },

  cancelInvoice: async (
    invoiceId: string,
    reason: string
  ): Promise<Invoice> => {
    return apiPost<Invoice>(`/billing/invoices/${invoiceId}/cancel/`, {
      reason,
    });
  },

  getStats: async (params?: {
    from_date?: string;
    to_date?: string;
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
    return apiGet("/billing/payment-methods/list_methods/");
  },
};

// =====================================================
// Notifications API
// =====================================================

export const notificationsApi = {
  listTemplates: async (): Promise<
    Array<{
      id: string;
      event_type: string;
      channel: string;
      template: string;
      is_active: boolean;
    }>
  > => {
    return apiGet("/notifications/templates/");
  },

  createDefaultTemplates: async (branchId: string): Promise<void> => {
    return apiPost("/notifications/templates/create_defaults/", {
      branch_id: branchId,
    });
  },

  listLogs: async (params?: {
    status?: string;
    channel?: string;
    page?: number;
  }): Promise<PaginatedResponse<NotificationLog>> => {
    return apiGet<PaginatedResponse<NotificationLog>>(
      "/notifications/logs/",
      params
    );
  },

  listAlerts: async (): Promise<PaginatedResponse<InternalAlert>> => {
    return apiGet<PaginatedResponse<InternalAlert>>("/notifications/alerts/");
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    return apiGet("/notifications/alerts/unread_count/");
  },

  markAllRead: async (): Promise<void> => {
    return apiPost("/notifications/alerts/mark_all_read/");
  },

  sendCustomNotification: async (data: {
    channel: "SMS" | "WHATSAPP";
    recipient_mobile: string;
    recipient_name: string;
    message: string;
  }): Promise<void> => {
    return apiPost("/notifications/send/send/", data);
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
  }): Promise<PendingJobsReportData[]> => {
    return apiGet<PendingJobsReportData[]>("/reports/pending_jobs/", params);
  },

  getTechnicianProductivity: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<TechnicianProductivityData[]> => {
    return apiGet<TechnicianProductivityData[]>(
      "/reports/technician_productivity/",
      params
    );
  },

  getInventoryConsumption: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<InventoryConsumptionData[]> => {
    return apiGet<InventoryConsumptionData[]>(
      "/reports/inventory_consumption/",
      params
    );
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    return apiGet<InventoryItem[]>("/reports/low_stock/");
  },

  getCustomerAnalysis: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<
    Array<{
      customer_id: string;
      customer_name: string;
      total_jobs: number;
      total_spent: number;
      last_visit: string;
    }>
  > => {
    return apiGet("/reports/customer_analysis/", params);
  },

  getGstSummary: async (params: {
    from_date: string;
    to_date: string;
    branch?: string;
  }): Promise<{
    total_cgst: number;
    total_sgst: number;
    total_igst: number;
    total_tax: number;
    taxable_amount: number;
  }> => {
    return apiGet("/reports/gst_summary/", params);
  },

  exportExcel: async (
    reportType: string,
    params: { from_date: string; to_date: string; branch?: string }
  ): Promise<void> => {
    const filename = `${reportType}_report_${params.from_date}_${params.to_date}.xlsx`;
    return apiDownload(
      `/reports/export_excel/?report=${reportType}&from_date=${
        params.from_date
      }&to_date=${params.to_date}${
        params.branch ? `&branch=${params.branch}` : ""
      }`,
      filename
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
    return apiGet("/audit/logs/for_object/", { model, id });
  },

  listPasswordAccess: async () => {
    return apiGet("/audit/password-access/");
  },

  getPasswordAccessForJob: async (jobId: string) => {
    return apiGet("/audit/password-access/for_job/", { job_id: jobId });
  },

  listLogins: async () => {
    return apiGet("/audit/logins/");
  },

  listExports: async () => {
    return apiGet("/audit/exports/");
  },
};
