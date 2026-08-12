/** Domain API service module. */
import { apiGet, apiPost, apiPatch } from "./client";
import type { AuthTokens, AuthUser, Branch } from "@/types";

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    return apiPost<AuthTokens>(
      "/auth/token/",
      { email, password },
      { timeout: 120000, withCredentials: true },
    );
  },

  refreshToken: async (): Promise<AuthTokens> => {
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

  getOnboarding: async (branch?: string): Promise<{ dismissed: boolean; steps: Array<{ label: string; done: boolean; href: string }> }> =>
    apiGet("/core/users/onboarding/", { branch }),

  dismissOnboarding: async (): Promise<void> =>
    apiPost("/core/users/onboarding/", { dismissed: true }),
};

// =====================================================
// Organizations API
// =====================================================
