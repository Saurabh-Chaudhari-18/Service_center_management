import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { Invoice, InvoiceStatus } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Override next/navigation to provide a specific invoice ID via useParams
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/billing/inv-1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "inv-1" }),
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
  Header: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}{actions}</div>
  ),
}));

vi.mock("@/components/billing/InvoiceTemplate", () => ({
  InvoiceTemplate: () => null,
}));

const mockGetInvoice = vi.fn(() =>
  Promise.resolve<Invoice>({
    id: "inv-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    invoice_number: "INV-TEST-001",
    job: "job-1",
    job_number: "JOB-001",
    customer_name: "John Smith",
    customer_mobile: "9876543210",
    customer_email: "john@test.com",
    customer_address: "123 Main St",
    customer_gstin: "",
    customer_state_code: "27",
    invoice_date: "2024-06-15",
    due_date: null,
    is_interstate: false,
    subtotal: 500,
    cgst_total: 45,
    sgst_total: 45,
    igst_total: 0,
    discount_amount: 0,
    total_tax: 90,
    total_amount: 590,
    status: "PENDING" as InvoiceStatus,
    paid_amount: 0,
    balance_due: 590,
    is_finalized: false,
    finalized_at: null,
    notes: "",
    terms_and_conditions: "",
    created_by: "user-owner",
    created_at: "2024-06-15T00:00:00Z",
    updated_at: "2024-06-15T00:00:00Z",
  }),
);

vi.mock("@/lib/api", () => ({
  billingApi: {
    getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
    getPayments: vi.fn(() => Promise.resolve([])),
    getEditHistory: vi.fn(() => Promise.resolve([])),
    recordPayment: vi.fn(() => Promise.resolve({})),
    logDownload: vi.fn(() => Promise.resolve()),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import InvoiceDetailsPage from "@/app/billing/[id]/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <InvoiceDetailsPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Invoice detail page (billing/[id]) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Invoice detail page (billing/[id]) — regression tests", () => {
  it("shows 'Invoice INV-TEST-001' as heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Invoice INV-TEST-001" }),
      ).toBeInTheDocument();
    });
  });

  it("shows invoice number heading and date subtitle together after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Invoice INV-TEST-001" }),
      ).toBeInTheDocument();
      // Header subtitle shows formatted invoice date
      expect(screen.getByText(/June 15, 2024/i)).toBeInTheDocument();
    });
  });

  it("shows 'Edit Invoice' action button", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /edit invoice/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Record Payment' button when balance is due", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /record payment/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows 'No payments recorded yet' when payment history is empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No payments recorded yet")).toBeInTheDocument();
    });
  });

  it("calls getInvoice with the ID from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetInvoice).toHaveBeenCalledWith("inv-1");
    });
  });
});
