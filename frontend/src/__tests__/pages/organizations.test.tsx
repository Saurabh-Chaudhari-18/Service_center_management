import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { UserRole } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => mockAuthValue("SUPER_ADMIN")),
    ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", isDark: false, toggleTheme: vi.fn() }),
}));

vi.mock("@/components/layout/Layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
  Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

vi.mock("@/lib/api", () => ({
  organizationsApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    create: vi.fn().mockResolvedValue({ id: "org-new" }),
    update: vi.fn().mockResolvedValue({}),
    getBranding: vi.fn(() => Promise.reject(new Error())),
  },
  branchesApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  },
  usersApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import OrganizationsPage from "@/app/organizations/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderOrganizations(role: UserRole = "SUPER_ADMIN") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <OrganizationsPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Organizations page smoke tests", () => {
  it("renders without crashing for SUPER_ADMIN", () => {
    expect(() => renderOrganizations("SUPER_ADMIN")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderOrganizations("SUPER_ADMIN");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Organizations heading", async () => {
    renderOrganizations("SUPER_ADMIN");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Organizations" })).toBeInTheDocument();
    });
  });

  it("shows Add Organization button", async () => {
    renderOrganizations("SUPER_ADMIN");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add organization/i })).toBeInTheDocument();
    });
  });
});
