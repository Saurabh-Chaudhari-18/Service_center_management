/** Domain API service module. */
import { apiGet, apiPost, apiPatch } from "./client";
import type { Customer, JobCard, PaginatedResponse } from "@/types";

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

  getServiceHistory: async (id: string, page = 1): Promise<PaginatedResponse<JobCard>> => {
    const response = await apiGet<JobCard[] | PaginatedResponse<JobCard>>(
      `/customers/${id}/service-history/`,
      { page },
    );
    return Array.isArray(response) ? { count: response.length, next: null, previous: null, results: response } : response;
  },

  requestDeletion: async (id: string): Promise<{ message: string }> => {
    return apiPost(`/customers/${id}/request-deletion/`, {});
  },
};

// =====================================================
// Job Cards API
// =====================================================
