import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { Invoice, InvoiceStatus, UserRole } from "@/types";

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

vi.mock("@/components/billing/InvoiceTemplate", () => ({
  InvoiceTemplate: () => null,
}));

// Module-level vi.fn() with default impl — survives vi.restoreAllMocks() between tests.
// NOTE: The billing page calls billingApi.listInvoices (not billingApi.list).
const mockListInvoices = vi.fn(() =>
  Promise.resolve({ count: 0, results: [], next: null, previous: null }),
);
const mockGetStats = vi.fn(() => Promise.resolve(null));

vi.mock("@/lib/api", () => ({
  billingApi: {
    listInvoices: (...args: unknown[]) => mockListInvoices(...args),
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getInvoice: vi.fn(() => Promise.resolve({})),
    getPayments: vi.fn(() => Promise.resolve([])),
    logDownload: vi.fn(() => Promise.resolve()),
    createPayment: vi.fn(() => Promise.resolve({})),
    updateStatus: vi.fn(() => Promise.resolve({})),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import BillingPage from "@/app/billing/page";
import { useAuth } from "@/context/AuthContext";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    invoice_number: "INV-2024-001",
    job: "job-1",
    job_number: "JOB-2024-001",
    customer_name: "John Smith",
    customer_mobile: "9876543210",
    customer_email: "john@test.com",
    customer_address: "123 Main St",
    customer_gstin: "",
    customer_state_code: "27",
    invoice_date: "2024-06-15",
    due_date: null,
    is_interstate: false,
    subtotal: 5000,
    cgst_total: 450,
    sgst_total: 450,
    igst_total: 0,
    discount_amount: 0,
    total_tax: 900,
    total_amount: 5900,
    status: "PENDING" as InvoiceStatus,
    paid_amount: 0,
    balance_due: 5900,
    is_finalized: false,
    finalized_at: null,
    notes: "",
    terms_and_conditions: "",
    created_by: "user-owner",
    created_at: "2024-06-15T00:00:00Z",
    updated_at: "2024-06-15T00:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBilling(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BillingPage />
    </QueryClientProvider>,
  );
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("Billing page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderBilling("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderBilling("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Billing & Invoices heading", async () => {
    renderBilling("OWNER");
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Billing & Invoices" }),
      ).toBeInTheDocument();
    });
  });

  it("shows New Invoice button", async () => {
    renderBilling("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /new invoice/i })).toBeInTheDocument();
    });
  });

  it("renders without crashing for ACCOUNTANT", () => {
    expect(() => renderBilling("ACCOUNTANT")).not.toThrow();
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderBilling("MANAGER")).not.toThrow();
  });
});

// ── Regression tests ──────────────────────────────────────────────────────────

describe("Billing page — regression tests", () => {
  it("shows 'No invoices found' empty state when list is empty", async () => {
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("No invoices found")).toBeInTheDocument();
    });
  });

  it("shows 'Create your first invoice' description in empty state without filters", async () => {
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("Create your first invoice")).toBeInTheDocument();
    });
  });

  it("shows search input with correct placeholder", async () => {
    renderBilling();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by invoice number or customer/i),
      ).toBeInTheDocument();
    });
  });

  it("shows status filter dropdown with 'All Statuses' default option", async () => {
    renderBilling();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "All Statuses" })).toBeInTheDocument();
    });
  });

  it("status filter dropdown includes Pending and Paid options", async () => {
    renderBilling();
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Pending" })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "Paid" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Draft" })).toBeInTheDocument();
  });

  it("renders invoice number in table when invoices are loaded", async () => {
    mockListInvoices.mockResolvedValue({
      count: 1,
      results: [makeInvoice({ invoice_number: "INV-2024-001" })],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
    });
  });

  it("renders customer name in table when invoices are loaded", async () => {
    mockListInvoices.mockResolvedValue({
      count: 1,
      results: [makeInvoice({ customer_name: "John Smith" })],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("John Smith")).toBeInTheDocument();
    });
  });

  it("renders customer mobile in table when invoices are loaded", async () => {
    mockListInvoices.mockResolvedValue({
      count: 1,
      results: [makeInvoice({ customer_mobile: "9876543210" })],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("9876543210")).toBeInTheDocument();
    });
  });

  it("shows sortable column header buttons in table", async () => {
    mockListInvoices.mockResolvedValue({
      count: 1,
      results: [makeInvoice()],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
    });
    // Each column header is a <button> inside <th>
    expect(screen.getByRole("button", { name: /invoice #/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^customer$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^amount$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^status$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /balance/i })).toBeInTheDocument();
  });

  it("renders total amount prefixed with ₹ symbol", async () => {
    mockListInvoices.mockResolvedValue({
      count: 1,
      // Use an amount < 1000 so locale-specific comma separators don't affect the match
      results: [makeInvoice({ total_amount: 500, balance_due: 500 })],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      // "₹500" appears in both Amount and Balance cells
      const cells = screen.getAllByText("₹500");
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  it("renders multiple invoices in the table", async () => {
    mockListInvoices.mockResolvedValue({
      count: 2,
      results: [
        makeInvoice({ id: "inv-1", invoice_number: "INV-2024-001" }),
        makeInvoice({ id: "inv-2", invoice_number: "INV-2024-002" }),
      ],
      next: null,
      previous: null,
    });
    renderBilling();
    await waitFor(() => {
      expect(screen.getByText("INV-2024-001")).toBeInTheDocument();
    });
    expect(screen.getByText("INV-2024-002")).toBeInTheDocument();
  });

  it("shows 'Create Invoice' button inside empty state", async () => {
    renderBilling();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /create invoice/i }),
      ).toBeInTheDocument();
    });
  });
});
