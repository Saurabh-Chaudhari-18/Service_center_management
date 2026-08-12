/** Domain API service module. */
import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { User, Branch, Organization, OrganizationBranding, PaginatedResponse } from "@/types";

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
