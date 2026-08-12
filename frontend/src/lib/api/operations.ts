/** Domain API service module. */
import { apiGet, apiPost, apiPatch, apiDownload, apiDelete } from "./client";
import type {
  CustomerLedgerEntry,
  Enquiry,
  Expense,
  PaginatedResponse,
  PickupRequest,
  PurchaseOrder,
  Supplier,
} from "@/types";

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
  }): Promise<PaginatedResponse<Expense>> => {
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
  }): Promise<PaginatedResponse<Enquiry>> => {
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
  }): Promise<PaginatedResponse<Supplier>> => {
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

  listPurchaseOrders: async (): Promise<PaginatedResponse<PurchaseOrder>> =>
    apiGet("/suppliers/purchase-orders/"),

  getPurchaseOrder: async (id: string): Promise<PurchaseOrder> =>
    apiGet(`/suppliers/purchase-orders/${id}/`),

  createPurchaseOrder: async (data: Record<string, unknown>): Promise<PurchaseOrder> =>
    apiPost("/suppliers/purchase-orders/", data),

  sendPurchaseOrder: async (id: string): Promise<PurchaseOrder> =>
    apiPost(`/suppliers/purchase-orders/${id}/send/`, {}),

  confirmPurchaseOrder: async (id: string): Promise<PurchaseOrder> =>
    apiPost(`/suppliers/purchase-orders/${id}/confirm/`, {}),

  cancelPurchaseOrder: async (id: string): Promise<PurchaseOrder> =>
    apiPost(`/suppliers/purchase-orders/${id}/cancel/`, {}),

  receivePurchaseOrder: async (
    id: string,
    items: Array<{ id: string; quantity: number }>,
  ): Promise<PurchaseOrder> => apiPost(`/suppliers/purchase-orders/${id}/receive/`, { items }),
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
  }): Promise<PaginatedResponse<CustomerLedgerEntry>> => {
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
