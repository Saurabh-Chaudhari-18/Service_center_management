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
    useAuth: vi.fn(() => mockAuthValue("OWNER")),
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
  usersApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    create: vi.fn().mockResolvedValue({ id: "user-new" }),
    update: vi.fn().mockResolvedValue({}),
    deactivate: vi.fn().mockResolvedValue({}),
    activate: vi.fn().mockResolvedValue({}),
    resetPassword: vi.fn().mockResolvedValue({}),
  },
  branchesApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import UsersPage from "@/app/users/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderUsers(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <UsersPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Users (Staff Management) page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderUsers("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderUsers("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Staff Management heading", async () => {
    renderUsers("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Staff Management" })).toBeInTheDocument();
    });
  });

  it("shows Add Staff button", async () => {
    renderUsers("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add staff/i })).toBeInTheDocument();
    });
  });

  it("shows All Staff role filter", async () => {
    renderUsers("OWNER");
    await waitFor(() => {
      expect(screen.getByText("All Staff")).toBeInTheDocument();
    });
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderUsers("MANAGER")).not.toThrow();
  });
});
