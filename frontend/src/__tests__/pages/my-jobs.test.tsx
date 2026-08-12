import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => mockAuthValue("TECHNICIAN")),
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
  Header: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}));

vi.mock("@/lib/api", () => ({
  jobsApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    getMyJobs: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    updateStatus: vi.fn().mockResolvedValue({}),
    markReady: vi.fn().mockResolvedValue({}),
    addNote: vi.fn().mockResolvedValue({}),
  },
  usersApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    updateLocation: vi.fn().mockResolvedValue({}),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import MyJobsPage from "@/app/my-jobs/page";
import { useAuth } from "@/context/AuthContext";
import { jobsApi } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderMyJobs() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("TECHNICIAN") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MyJobsPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("My Jobs page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderMyJobs()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderMyJobs();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows My Jobs heading", async () => {
    renderMyJobs();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "My Jobs" })).toBeInTheDocument();
    });
  });

  it("shows In Progress stat card", async () => {
    renderMyJobs();
    await waitFor(() => {
      expect(screen.getByText("In Progress")).toBeInTheDocument();
    });
  });

  it("shows Ready stat card", async () => {
    renderMyJobs();
    await waitFor(() => {
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });
  });
  it("shows customer snapshot fields returned by the technician job list", async () => {
    vi.mocked(jobsApi.getMyJobs).mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [{
        id: "job-1",
        job_number: "JOB-001",
        customer_name: "Asha Patil",
        customer_mobile: "9876543210",
        brand: "Dell",
        model: "Latitude",
        device_type: "LAPTOP",
        customer_complaint: "No power",
        status: "REPAIR_IN_PROGRESS",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_urgent: false,
      }],
    } as Awaited<ReturnType<typeof jobsApi.getMyJobs>>);

    renderMyJobs();

    expect((await screen.findAllByText("Asha Patil")).length).toBeGreaterThan(0);
  });
});
