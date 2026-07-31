/**
 * Shared test utilities.
 *
 * renderWithQuery  – wraps component in a fresh QueryClientProvider (React Query)
 * mockUser         – factory for AuthUser test fixtures
 * mockBranch       – factory for Branch test fixtures
 */

import React from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ROLE_PERMISSIONS } from "@/types";
import type { AuthUser, Branch, UserRole, UserPermissions } from "@/types";

// ── QueryClient factory (no retries so tests fail fast) ──────────────────────

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

// ── Render helpers ────────────────────────────────────────────────────────────

export function renderWithQuery(ui: React.ReactElement, options?: RenderOptions) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    options,
  );
}

// ── Mock data factories ───────────────────────────────────────────────────────

export const mockBranch: Branch = {
  id: "branch-1",
  organization: "org-1",
  organization_name: "Test Org",
  name: "Main Branch",
  code: "MAIN",
  email: "branch@test.com",
  phone: "9000000000",
  address_line1: "123 Main St",
  address_line2: "",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  gstin: "27AABCT1332L1ZV",
  state_code: "27",
  invoice_prefix: "INV",
  invoice_current_number: 1,
  jobcard_prefix: "JOB",
  jobcard_current_number: 1,
  sms_enabled: false,
  whatsapp_enabled: false,
  default_gst_rate: 18,
  gst_enabled: true,
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export function mockUser(role: UserRole, permissions?: Partial<UserPermissions>): AuthUser {
  const base: AuthUser = {
    id: `user-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@test.com`,
    first_name: role.charAt(0) + role.slice(1).toLowerCase(),
    last_name: "Test",
    phone: "9000000001",
    organization: "org-1",
    organization_name: "Test Org",
    role,
    branches: ["branch-1"],
    branch_names: ["Main Branch"],
    is_active: true,
    is_staff: role === "SUPER_ADMIN",
    last_login: null,
    date_joined: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    accessible_branches: [mockBranch],
    current_branch: mockBranch,
    permissions: permissions as UserPermissions | undefined,
  };
  return base;
}

// ── Auth context value factory ─────────────────────────────────────────────────
// Used when mocking useAuth in component tests.

export function mockAuthValue(role: UserRole, overrides?: { permissions?: Partial<UserPermissions> }) {
  const user = mockUser(role, overrides?.permissions);
  const rolePerms = ROLE_PERMISSIONS[role];

  return {
    user,
    isLoading: false,
    isAuthenticated: true,
    currentBranch: mockBranch,
    accessibleBranches: [mockBranch],
    organizationBranding: {
      name: "Test Org",
      tagline: "Test",
      logo: null,
      primary_color: "#6366f1",
      favicon: null,
    },
    login: () => Promise.resolve(),
    logout: () => {},
    switchBranch: () => Promise.resolve(),
    refreshUser: () => Promise.resolve(),
    hasPermission: (permission: keyof UserPermissions) => {
      if (user.permissions) return user.permissions[permission] ?? false;
      return rolePerms?.[permission] ?? false;
    },
    isRole: (...roles: UserRole[]) => roles.includes(role),
    gstEnabled: true,
  };
}
