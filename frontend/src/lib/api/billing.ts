/** Domain API service module. */
import { apiGet, apiPost, apiPatch, apiDownload } from "./client";
import type { Invoice, CreditNote, InvoiceLineItem, Payment, PaginatedResponse } from "@/types";

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

  getEditHistory: async (
    invoiceId: string,
  ): Promise<Array<Record<string, unknown>>> => {
    return apiGet<Array<Record<string, unknown>>>(
      `/billing/invoices/${invoiceId}/edit-history/`,
    );
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

  listCreditNotes: async (): Promise<PaginatedResponse<CreditNote>> =>
    apiGet("/billing/credit-notes/"),

  createCreditNote: async (data: {
    invoice: string;
    amount: number;
    reason: string;
  }): Promise<CreditNote> => apiPost("/billing/credit-notes/", data),

  listCreditEligibleInvoices: async () =>
    apiGet<Array<{ id: string; invoice_number: string; customer_name: string; total_amount: number; balance_due: number }>>("/billing/credit-notes/eligible-invoices/"),

  downloadCreditNote: async (id: string, number: string): Promise<void> =>
    apiDownload(`/billing/credit-notes/${id}/download-pdf/`, `${number}.pdf`),

  sendCreditNoteToCustomer: async (id: string): Promise<{ message: string }> =>
    apiPost(`/billing/credit-notes/${id}/send-to-customer/`, {}),
};

// =====================================================
// Notifications API
// =====================================================
