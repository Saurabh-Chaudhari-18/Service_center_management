import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { JobCard, UserRole } from "@/types";

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

// Module-level vi.fn() with default impl — survives vi.restoreAllMocks() between tests
// because vi.fn(impl) restores to `impl`, not to undefined.
const mockJobsList = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ count: 0, results: [] as JobCard[], next: null, previous: null }),
);
const mockJobsGetStats = vi.fn((..._args: unknown[]) => Promise.resolve({ by_status: {} }));

vi.mock("@/lib/api", () => ({
  jobsApi: {
    // Indirection so vi.restoreAllMocks() on mockJobsList does not break the factory
    list: (...args: unknown[]) => mockJobsList(...args),
    getStats: (...args: unknown[]) => mockJobsGetStats(...args),
    get: vi.fn(() => Promise.resolve({})),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import JobsPage from "@/app/jobs/page";
import { useAuth } from "@/context/AuthContext";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeJobCard(overrides: Partial<JobCard> = {}): JobCard {
  return {
    id: "job-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    job_number: "JOB-2024-001",
    customer: {
      id: "cust-1",
      branch: "branch-1",
      first_name: "Alice",
      last_name: "Kumar",
      email: "alice@test.com",
      mobile: "9876543210",
      alternate_mobile: "",
      address_line1: "123 Main St",
      address_line2: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      state_code: "27",
      gstin: "",
      company_name: "",
      sms_enabled: false,
      whatsapp_enabled: false,
      notes: "",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    customer_id: "cust-1",
    device_type: "LAPTOP",
    brand: "Dell",
    model: "XPS 15",
    serial_number: "SN123456",
    customer_complaint: "Screen not working properly",
    physical_condition: "Good",
    status: "RECEIVED",
    assigned_technician: null,
    assigned_technician_name: undefined,
    received_by: "user-1",
    received_by_name: "Owner Test",
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
    created_at: "2024-06-15T00:00:00Z",
    updated_at: "2024-06-15T00:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderJobs(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <JobsPage />
    </QueryClientProvider>,
  );
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  mockJobsList.mockImplementation(() => Promise.resolve({ count: 0, results: [], next: null, previous: null }));
  mockJobsGetStats.mockImplementation(() => Promise.resolve({ by_status: {} }));
});

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

// ── Regression tests ──────────────────────────────────────────────────────────

describe("Jobs page — regression tests", () => {
  it("shows 'No job cards found' when list is empty", async () => {
    renderJobs();
    await waitFor(() => {
      expect(screen.getByText("No job cards found")).toBeInTheDocument();
    });
  });

  it("shows 'Create your first job card to get started' in empty state without filter", async () => {
    renderJobs();
    await waitFor(() => {
      expect(
        screen.getByText("Create your first job card to get started"),
      ).toBeInTheDocument();
    });
  });

  it("shows status filter tabs (All, Received, Diagnosis, etc.)", async () => {
    renderJobs();
    await waitFor(() => {
      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });
    // Tabs are plain <button> elements
    expect(screen.getByRole("button", { name: /^all\s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^received\s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^diagnosis\s/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delivered\s/i })).toBeInTheDocument();
  });

  it("shows search input with correct placeholder", async () => {
    renderJobs();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by job number/i),
      ).toBeInTheDocument();
    });
  });

  it("renders job number when jobs are loaded", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ job_number: "JOB-2024-001" })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("JOB-2024-001").length).toBeGreaterThan(0);
    });
  });

  it("renders customer full name when jobs are loaded", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard()],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("Alice Kumar").length).toBeGreaterThan(0);
    });
  });

  it("renders brand and model concatenated", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ brand: "Dell", model: "XPS 15" })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("Dell XPS 15").length).toBeGreaterThan(0);
    });
  });

  it("renders customer complaint text", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ customer_complaint: "Screen not working properly" })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("Screen not working properly").length).toBeGreaterThan(0);
    });
  });

  it("shows URGENT badge for an urgent job", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ is_urgent: true })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getByText("URGENT")).toBeInTheDocument();
    });
  });

  it("shows Warranty badge for a warranty repair job", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ is_warranty_repair: true })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getByText("Warranty")).toBeInTheDocument();
    });
  });

  it("shows assigned technician name when job is assigned", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ assigned_technician_name: "Bob Tech" })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("Bob Tech").length).toBeGreaterThan(0);
    });
  });

  it("renders multiple jobs in the list", async () => {
    mockJobsList.mockResolvedValue({
      count: 2,
      results: [
        makeJobCard({ id: "job-1", job_number: "JOB-2024-001" }),
        makeJobCard({ id: "job-2", job_number: "JOB-2024-002" }),
      ],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("JOB-2024-001").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("JOB-2024-002").length).toBeGreaterThan(0);
  });

  it("shows 'Create Job Card' button inside empty state for OWNER without filter", async () => {
    renderJobs("OWNER");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create job card/i }),
      ).toBeInTheDocument();
    });
  });

  it("hides 'Create Job Card' button in empty state for TECHNICIAN (no permission)", async () => {
    renderJobs("TECHNICIAN");
    await waitFor(() => {
      expect(screen.getByText("No job cards found")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /create job card/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show URGENT badge for non-urgent job", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ is_urgent: false })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("JOB-2024-001").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("URGENT")).not.toBeInTheDocument();
  });

  it("does not show Warranty badge for non-warranty job", async () => {
    mockJobsList.mockResolvedValue({
      count: 1,
      results: [makeJobCard({ is_warranty_repair: false })],
      next: null,
      previous: null,
    });
    renderJobs();
    await waitFor(() => {
      expect(screen.getAllByText("JOB-2024-001").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Warranty")).not.toBeInTheDocument();
  });
});
