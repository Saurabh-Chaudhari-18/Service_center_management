/** Domain API service module. */
import { apiGet, apiDownload } from "./client";
import type { InventoryItem, PaginatedResponse, RevenueReportData, TechnicianProductivityData } from "@/types";

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

  listPasswordAccess: async (page?: number) => {
    return apiGet<PaginatedResponse<Record<string, unknown>>>(
      "/audit/password-access/",
      { page },
    );
  },

  getPasswordAccessForJob: async (jobId: string) => {
    return apiGet("/audit/password-access/for-job/", { job_id: jobId });
  },

  listLogins: async (page?: number) => {
    return apiGet<PaginatedResponse<Record<string, unknown>>>("/audit/logins/", {
      page,
    });
  },

  listExports: async (page?: number) => {
    return apiGet<PaginatedResponse<Record<string, unknown>>>("/audit/exports/", {
      page,
    });
  },
};

// =====================================================
// Pickup & Drop API
// =====================================================
