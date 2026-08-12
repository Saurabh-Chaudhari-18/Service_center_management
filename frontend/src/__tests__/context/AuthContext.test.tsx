/**
 * Tests for AuthContext: hasPermission, isRole, and ProtectedRoute.
 *
 * Uses the REAL AuthProvider with mocked API calls so the actual business
 * logic (ROLE_PERMISSIONS fallback, DB-driven override) is exercised.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider, useAuth, ProtectedRoute } from "@/context/AuthContext";
import { ROLE_PERMISSIONS } from "@/types";
import type { UserPermissions, UserRole } from "@/types";
import { mockBranch, mockUser, createTestQueryClient } from "../test-utils";
import { authApi } from "@/lib/api/services";
import { tokenManager } from "@/lib/api/client";

// ── Mock the API layer so AuthProvider never hits the network ─────────────────

vi.mock("@/lib/api/client", () => ({
  tokenManager: {
    getAccessToken: vi.fn(() => "fake-access-token"),
    getRefreshToken: vi.fn(() => null),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    setCurrentBranchId: vi.fn(),
    getCurrentBranchId: vi.fn(() => null),
  },
  apiClient: {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
  API_BASE_URL: "http://localhost:8001/api",
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  apiUpload: vi.fn(),
  apiDownload: vi.fn(),
}));

vi.mock("@/lib/api/services", () => ({
  authApi: {
    getMe: vi.fn(),
    getMyBranches: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    setCurrentBranch: vi.fn(),
    refreshToken: vi.fn(),
  },
  organizationsApi: {
    getBranding: vi.fn(() => Promise.reject(new Error("Not found"))),
    getOrganization: vi.fn(),
    updateOrganization: vi.fn(),
  },
  jobsApi: { list: vi.fn(), get: vi.fn() },
  inventoryApi: { list: vi.fn() },
  billingApi: { list: vi.fn() },
  customersApi: { list: vi.fn() },
  pickupsApi: { list: vi.fn() },
  reportsApi: { getRevenue: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = createTestQueryClient();
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function HasPermissionProbe({ permission }: { permission: keyof UserPermissions }) {
  const { hasPermission } = useAuth();
  return <span data-testid="result">{String(hasPermission(permission))}</span>;
}

function IsRoleProbe({ roles }: { roles: UserRole[] }) {
  const { isRole } = useAuth();
  return <span data-testid="result">{String(isRole(...roles))}</span>;
}

// ── hasPermission ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(tokenManager.getAccessToken).mockReturnValue("fake-access-token");
  vi.mocked(authApi.refreshToken).mockResolvedValue({ authenticated: true });
});

describe("hasPermission", () => {
  beforeEach(() => {
    vi.mocked(authApi.getMyBranches).mockResolvedValue([mockBranch]);
  });

  it("returns false when user is null (no token)", async () => {
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error("no session"));

    render(<HasPermissionProbe permission="canViewBilling" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("false"),
    );
  });

  it("uses ROLE_PERMISSIONS fallback when user.permissions is undefined", async () => {
    // OWNER has canViewBilling: true
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("OWNER", undefined));

    render(<HasPermissionProbe permission="canViewBilling" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("true"),
    );
  });

  it("ACCOUNTANT gets canViewBilling from ROLE_PERMISSIONS", async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("ACCOUNTANT", undefined));

    render(<HasPermissionProbe permission="canViewBilling" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent(
        String(ROLE_PERMISSIONS.ACCOUNTANT.canViewBilling),
      ),
    );
  });

  it("TECHNICIAN cannot manage inventory (ROLE_PERMISSIONS fallback)", async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("TECHNICIAN", undefined));

    render(<HasPermissionProbe permission="canManageInventory" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("false"),
    );
  });

  it("DB-driven permissions override ROLE_PERMISSIONS", async () => {
    // Give TECHNICIAN explicit canManageInventory: true
    const overridden = mockUser("TECHNICIAN", {
      canViewDashboard: true,
      canViewJobCards: true,
      canCreateJobCards: false,
      canEditJobCards: true,
      canViewInventory: true,
      canManageInventory: true, // overridden!
      canViewBilling: false,
      canCreateInvoices: false,
      canViewReports: false,
      canManageBranches: false,
      canManageUsers: false,
      canViewPickups: true,
    });
    vi.mocked(authApi.getMe).mockResolvedValue(overridden);

    render(<HasPermissionProbe permission="canManageInventory" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("true"),
    );
  });

  it("DB-driven false overrides ROLE_PERMISSIONS true", async () => {
    const overridden = mockUser("OWNER", {
      canViewDashboard: true,
      canViewJobCards: true,
      canCreateJobCards: true,
      canEditJobCards: true,
      canViewInventory: true,
      canManageInventory: true,
      canViewBilling: false, // DB says false even though OWNER default is true
      canCreateInvoices: false,
      canViewReports: true,
      canManageBranches: true,
      canManageUsers: true,
      canViewPickups: true,
    });
    vi.mocked(authApi.getMe).mockResolvedValue(overridden);

    render(<HasPermissionProbe permission="canViewBilling" />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("false"),
    );
  });
});

// ── isRole ────────────────────────────────────────────────────────────────────

describe("isRole", () => {
  beforeEach(() => {
    vi.mocked(authApi.getMyBranches).mockResolvedValue([mockBranch]);
  });

  it("returns true when user role matches single role", async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("MANAGER"));

    render(<IsRoleProbe roles={["MANAGER"]} />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("true"),
    );
  });

  it("returns false when user role does not match", async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("TECHNICIAN"));

    render(<IsRoleProbe roles={["OWNER", "MANAGER"]} />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("false"),
    );
  });

  it("returns true when user role matches one of multiple roles", async () => {
    vi.mocked(authApi.getMe).mockResolvedValue(mockUser("OWNER"));

    render(<IsRoleProbe roles={["OWNER", "SUPER_ADMIN"]} />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("true"),
    );
  });

  it("returns false when user is null (no token)", async () => {
    vi.mocked(authApi.refreshToken).mockRejectedValue(new Error("no session"));

    render(<IsRoleProbe roles={["OWNER"]} />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(screen.getByTestId("result")).toHaveTextContent("false"),
    );
  });
});

// ── ROLE_PERMISSIONS static map snapshot ─────────────────────────────────────
// Catches accidental changes to the permission matrix.

describe("ROLE_PERMISSIONS static map", () => {
  it.each([
    ["SUPER_ADMIN", "canViewBilling", false],
    ["OWNER", "canViewBilling", true],
    ["MANAGER", "canViewBilling", false],
    ["ACCOUNTANT", "canViewBilling", true],
    ["TECHNICIAN", "canViewBilling", false],
    ["RECEPTIONIST", "canViewBilling", false],
    ["OWNER", "canManageUsers", true],
    ["MANAGER", "canManageUsers", false],
    ["ACCOUNTANT", "canViewReports", true],
    ["TECHNICIAN", "canCreateJobCards", false],
    ["RECEPTIONIST", "canCreateJobCards", true],
    ["SUPER_ADMIN", "canManageBranches", true],
    ["OWNER", "canManageBranches", true],
    ["MANAGER", "canManageBranches", false],
  ] as [UserRole, keyof UserPermissions, boolean][])(
    "%s → %s = %s",
    (role, permission, expected) => {
      expect(ROLE_PERMISSIONS[role][permission]).toBe(expected);
    },
  );
});

// ── ProtectedRoute ────────────────────────────────────────────────────────────

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(authApi.getMyBranches).mockResolvedValue([mockBranch]);
  });

  function renderProtected(
    routeProps: { requiredRoles?: UserRole[]; requiredPermission?: keyof UserPermissions; fallback?: React.ReactNode },
    userSetup: () => void,
  ) {
    userSetup();
    const qc = createTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ProtectedRoute {...routeProps}>
            <div data-testid="children">Protected Content</div>
          </ProtectedRoute>
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  it("shows spinner while loading", () => {
    vi.mocked(tokenManager.getAccessToken).mockReturnValue("some-token");
    vi.mocked(authApi.getMe).mockReturnValue(new Promise(() => {}));
    vi.mocked(authApi.getMyBranches).mockReturnValue(new Promise(() => {}));

    const qc = createTestQueryClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ProtectedRoute>
            <div data-testid="children">Children</div>
          </ProtectedRoute>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
    expect(container.querySelector(".spinner")).not.toBeNull();
  });

  it("shows children for authenticated user with correct role", async () => {
    renderProtected({ requiredRoles: ["OWNER", "MANAGER"] }, () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser("OWNER"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("children")).toBeInTheDocument(),
    );
  });

  it("shows Access Denied for wrong role", async () => {
    renderProtected({ requiredRoles: ["OWNER", "MANAGER"] }, () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser("TECHNICIAN"));
    });

    await waitFor(() =>
      expect(screen.getByText("Access Denied")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("shows Access Denied for missing permission", async () => {
    renderProtected({ requiredPermission: "canManageInventory" }, () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser("TECHNICIAN"));
    });

    await waitFor(() =>
      expect(screen.getByText("Access Denied")).toBeInTheDocument(),
    );
  });

  it("shows children when permission is granted", async () => {
    renderProtected({ requiredPermission: "canViewBilling" }, () => {
      vi.mocked(authApi.getMe).mockResolvedValue(mockUser("OWNER"));
    });

    await waitFor(() =>
      expect(screen.getByTestId("children")).toBeInTheDocument(),
    );
  });

  it("renders custom fallback instead of Access Denied", async () => {
    renderProtected(
      {
        requiredRoles: ["OWNER"],
        fallback: <div data-testid="custom-fallback">Go away</div>,
      },
      () => {
        vi.mocked(authApi.getMe).mockResolvedValue(mockUser("RECEPTIONIST"));
      },
    );

    await waitFor(() =>
      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });
});
