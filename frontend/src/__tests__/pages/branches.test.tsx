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
  branchesApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    create: vi.fn().mockResolvedValue({ id: "branch-new" }),
    update: vi.fn().mockResolvedValue({}),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import BranchesPage from "@/app/branches/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBranches(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BranchesPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Branches page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderBranches("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderBranches("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Branch Management heading", async () => {
    renderBranches("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Branch Management" })).toBeInTheDocument();
    });
  });

  it("shows Add Branch button", async () => {
    renderBranches("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add branch/i })).toBeInTheDocument();
    });
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderBranches("MANAGER")).not.toThrow();
  });
});
