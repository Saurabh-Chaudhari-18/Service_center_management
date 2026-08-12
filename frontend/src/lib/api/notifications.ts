/** Domain API service module. */
import { apiGet, apiPost, apiPatch } from "./client";
import type { NotificationLog, InternalAlert, PaginatedResponse } from "@/types";

interface NotificationTemplateSummary {
  id: string;
  notification_type: string;
  channel: string;
  template_text: string;
  is_active: boolean;
}

export const notificationsApi = {
  listTemplates: async (): Promise<NotificationTemplateSummary[]> => {
    const res = await apiGet<
      NotificationTemplateSummary[] | { results: NotificationTemplateSummary[] }
    >("/notifications/templates/");
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
