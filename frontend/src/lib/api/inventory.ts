/** Domain API service module. */
import { apiGet, apiPost, apiPatch, apiUpload } from "./client";
import type { InventoryItem, StockAdjustment, StockTransfer, PaginatedResponse, Purchase } from "@/types";

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
    const res = await apiGet<
      StockAdjustment[] | { results: StockAdjustment[] }
    >(
      `/inventory/items/${id}/adjustments/`,
    );
    return Array.isArray(res) ? res : res.results || [];
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

  listTransfers: async (): Promise<PaginatedResponse<StockTransfer>> => {
    return apiGet("/inventory/transfers/");
  },

  createTransfer: async (data: {
    from_branch: string;
    to_branch: string;
    notes?: string;
    items: Array<{ inventory_item: string; quantity: number }>;
  }): Promise<StockTransfer> => apiPost("/inventory/transfers/", data),

  dispatchTransfer: async (id: string): Promise<StockTransfer> =>
    apiPost(`/inventory/transfers/${id}/dispatch/`),

  completeTransfer: async (id: string): Promise<{ message: string }> =>
    apiPost(`/inventory/transfers/${id}/complete/`),

  cancelTransfer: async (id: string): Promise<StockTransfer> =>
    apiPost(`/inventory/transfers/${id}/cancel/`),

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
