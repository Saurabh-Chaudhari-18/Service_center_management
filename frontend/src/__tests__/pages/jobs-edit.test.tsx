import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { JobCard, JobStatus } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/jobs/job-1/edit",
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
    job_number: "JOB-EDIT-001",
    customer: {
      id: "cust-1",
      branch: "branch-1",
      first_name: "Bob",
      last_name: "Jones",
      mobile: "9000000001",
      alternate_mobile: "",
      email: "bob@test.com",
      address_line1: "456 Edit St",
      address_line2: "",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      state_code: "07",
      gstin: "",
      company_name: "",
      sms_enabled: false,
      whatsapp_enabled: false,
      notes: "",
      is_active: true,
      pending_jobs_count: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    customer_id: "cust-1",
    device_type: "LAPTOP",
    brand: "HP",
    model: "Pavilion 15",
    serial_number: "",
    customer_complaint: "Battery not charging properly",
    physical_condition: "Minor scratches",
    status: "RECEIVED" as JobStatus,
    assigned_technician: null,
    received_by: "user-owner",
    diagnosis_notes: "",
    estimated_cost: null,
    estimated_completion_date: null,
    customer_approval_date: null,
    customer_rejection_reason: "",
    completion_notes: "",
    actual_completion_date: null,
    delivery_date: null,
    delivered_by: null,
    is_urgent: false,
    is_warranty_repair: false,
    warranty_details: "",
    additional_comments: "",
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
  }),
);

vi.mock("@/lib/api", () => ({
  jobsApi: {
    get: (id: string) => mockGetJob(id),
    update: vi.fn(() => Promise.resolve({})),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  customersApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  branchesApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import EditJobPage from "@/app/jobs/[id]/edit/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <EditJobPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Edit Job page (jobs/[id]/edit) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Edit Job page (jobs/[id]/edit) — regression tests", () => {
  it("shows 'Edit Job: JOB-EDIT-001' heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Edit Job: JOB-EDIT-001/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows Save Changes button after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save changes/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows brand field pre-filled after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("HP")).toBeInTheDocument();
    });
  });

  it("calls jobsApi.get with id from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetJob).toHaveBeenCalledWith("job-1");
    });
  });
});
