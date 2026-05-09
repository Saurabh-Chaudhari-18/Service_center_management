import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { JobCard, JobStatus } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/jobs/job-1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "job-1" }),
}));

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
  Header: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions}
    </div>
  ),
}));

const mockGetJob = vi.fn(() =>
  Promise.resolve<JobCard>({
    id: "job-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    job_number: "JOB-TEST-001",
    customer: {
      id: "cust-1",
      first_name: "Alice",
      last_name: "Smith",
      mobile: "9876543210",
      email: "alice@test.com",
      address: "123 Test St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      gstin: "",
      pending_jobs_count: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    customer_id: "cust-1",
    device_type: "LAPTOP",
    brand: "Dell",
    model: "XPS 15",
    serial_number: "SN123",
    customer_complaint: "Screen flickering",
    physical_condition: "Good",
    status: "REPAIR_IN_PROGRESS" as JobStatus,
    assigned_technician: null,
    assigned_technician_name: undefined,
    received_by: "user-owner",
    received_by_name: "Owner Test",
    diagnosis_notes: "",
    estimated_cost: null,
    estimated_completion_date: null,
    customer_approval_date: null,
    is_urgent: false,
    is_warranty_repair: false,
    warranty_details: "",
    diagnosis_parts: [],
    accessories: {},
    additional_comments: "",
    customer_rejection_reason: "",
    completion_notes: "",
    actual_completion_date: null,
    delivery_date: null,
    delivered_by: null,
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
  }),
);

vi.mock("@/lib/api", () => ({
  jobsApi: {
    get: (...args: unknown[]) => mockGetJob(...args),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    assignTechnician: vi.fn(() => Promise.resolve({})),
    updateStatus: vi.fn(() => Promise.resolve({})),
    addDiagnosis: vi.fn(() => Promise.resolve({})),
    uploadPhoto: vi.fn(() => Promise.resolve({})),
    getStatusHistory: vi.fn(() => Promise.resolve([])),
  },
  API_BASE_URL: "http://test-api.example.com",
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import JobDetailPage from "@/app/jobs/[id]/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <JobDetailPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Job detail page (jobs/[id]) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Job detail page (jobs/[id]) — regression tests", () => {
  it("shows job number as heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "JOB-TEST-001" }),
      ).toBeInTheDocument();
    });
  });

  it("shows brand and model in the page after data loads", async () => {
    renderPage();
    await waitFor(() => {
      // Brand and model appear in multiple places (header subtitle + device section)
      const matches = screen.getAllByText("Dell XPS 15");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("shows Edit Job button for OWNER after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /edit job/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls jobsApi.get with id from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetJob).toHaveBeenCalledWith("job-1");
    });
  });
});
