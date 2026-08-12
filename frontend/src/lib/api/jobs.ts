/** Domain API service module. */
import { apiGet, apiPost, apiPatch, apiUpload, apiDelete } from "./client";
import type { JobCard, CreateJobCardData, PaginatedResponse, OutsourceVendor, OutsourcedRepair } from "@/types";

export const jobsApi = {
  schedule: async (branch?: string): Promise<{ jobs: JobCard[]; technician_load: Array<{ id: string; name: string; job_count: number }>; unassigned_count: number }> =>
    apiGet("/jobs/schedule/", { branch }),

  list: async (params?: {
    branch?: string;
    status?: string;
    customer?: string;
    technician?: string;
    search?: string;
    page?: number;
    page_size?: number;
    is_urgent?: boolean;
    is_overdue?: boolean;
    ordering?: string;
    is_pending?: boolean;
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
      is_override: false,
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

  deliver: async (jobId: string, data: { otp?: string; signature?: File; notes?: string }): Promise<JobCard> => {
    if (data.signature) {
      return apiUpload<JobCard>(`/jobs/${jobId}/deliver/`, data.signature, "signature", {
        otp: data.otp || "",
        notes: data.notes || "",
      });
    }
    return apiPost<JobCard>(`/jobs/${jobId}/deliver/`, { otp: data.otp, notes: data.notes });
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
    return Array.isArray(res) ? res : res.results || [];
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
