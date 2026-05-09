import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { PickupRequest, PickupRequestStatus } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// next/dynamic is used by LiveTrackingMap (in @/components/ui) — stub it out
vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/pickups/pickup-1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "pickup-1" }),
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

const mockGetPickup = vi.fn(() =>
  Promise.resolve<PickupRequest>({
    id: "pickup-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    pickup_number: "PU-TEST-001",
    customer: {
      id: "cust-1",
      first_name: "Carol",
      last_name: "White",
      mobile: "9111111111",
      email: "carol@test.com",
      address: "789 Test Ave",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      gstin: "",
      pending_jobs_count: 0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    customer_id: "cust-1",
    job: null,
    status: "REQUESTED" as PickupRequestStatus,
    device_type: "LAPTOP",
    brand: "Lenovo",
    model_name: "ThinkPad X1",
    customer_complaint: "Keyboard not working",
    pickup_address: "789 Test Ave, Pune",
    pickup_date: "2024-06-20",
    pickup_time_slot: "9:00 AM - 11:00 AM",
    contact_number: "9111111111",
    notes: "",
    is_urgent: false,
    created_at: "2024-06-19T00:00:00Z",
    updated_at: "2024-06-19T00:00:00Z",
  }),
);

vi.mock("@/lib/api", () => ({
  pickupsApi: {
    get: (...args: unknown[]) => mockGetPickup(...args),
    assignTechnician: vi.fn(() => Promise.resolve({})),
    updateStatus: vi.fn(() => Promise.resolve({})),
    convertToJob: vi.fn(() => Promise.resolve({ job_id: "job-new" })),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  usersApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import PickupDetailPage from "@/app/pickups/[id]/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PickupDetailPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Pickup detail page (pickups/[id]) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Pickup detail page (pickups/[id]) — regression tests", () => {
  it("shows pickup number as heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "PU-TEST-001" }),
      ).toBeInTheDocument();
    });
  });

  it("shows customer name in the page after data loads", async () => {
    renderPage();
    await waitFor(() => {
      // Customer name appears in multiple places (header subtitle + detail sections)
      const matches = screen.getAllByText(/Carol White/);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it("shows Assign Technician button when pickup is not terminal", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /assign technician/i }),
      ).toBeInTheDocument();
    });
  });

  it("calls pickupsApi.get with id from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPickup).toHaveBeenCalledWith("pickup-1");
    });
  });
});
