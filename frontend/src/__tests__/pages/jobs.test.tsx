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
  jobsApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    getStats: vi.fn().mockResolvedValue({ by_status: {} }),
    get: vi.fn().mockResolvedValue({}),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import JobsPage from "@/app/jobs/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderJobs(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <JobsPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Jobs page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderJobs("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderJobs("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Job Cards heading", async () => {
    renderJobs("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Job Cards" })).toBeInTheDocument();
    });
  });

  it("shows New Job Card button for OWNER (has canCreateJobCards)", async () => {
    renderJobs("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new job card/i })).toBeInTheDocument();
    });
  });

  it("hides New Job Card button for TECHNICIAN (no canCreateJobCards)", async () => {
    renderJobs("TECHNICIAN");
    await waitFor(() => {
      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /new job card/i })).not.toBeInTheDocument();
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderJobs("MANAGER")).not.toThrow();
  });

  it("renders without crashing for RECEPTIONIST", () => {
    expect(() => renderJobs("RECEPTIONIST")).not.toThrow();
  });

  it("renders without crashing for ACCOUNTANT", () => {
    expect(() => renderJobs("ACCOUNTANT")).not.toThrow();
  });
});
