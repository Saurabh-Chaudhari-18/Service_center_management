import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { Invoice, InvoiceStatus } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/billing/inv-1/edit",
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
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/components/billing/InvoiceTemplate", () => ({
  InvoiceTemplate: () => null,
}));

// The Select component in @/components/ui uses a ref callback that calls setState on mount,
// causing "Maximum update depth exceeded" with react-hook-form's reset(). Replace with a
// native select to prevent the infinite loop from blocking the form from rendering.
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  const MockSelect = React.forwardRef(
    (
      {
        options,
        placeholder,
        value,
        onChange,
        ...props
      }: {
        label?: string;
        options?: { value: string; label: string }[];
        placeholder?: string;
        value?: string;
        onChange?: React.ChangeEventHandler<HTMLSelectElement>;
        [k: string]: unknown;
      },
      ref: React.Ref<HTMLSelectElement>,
    ) => (
      <select ref={ref} value={value ?? ""} onChange={onChange} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    ),
  );
  MockSelect.displayName = "Select";
  return {
    ...actual,
    Select: MockSelect,
  };
});

const mockGetInvoice = vi.fn((..._args: unknown[]) =>
  Promise.resolve<Invoice>({
    id: "inv-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    invoice_number: "INV-EDIT-001",
    job: "job-1",
    job_number: "JOB-001",
    customer_name: "Alice Test",
    customer_mobile: "9876543210",
    customer_email: "alice@test.com",
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
    line_items: [
      {
        id: "li-1",
        item_type: "SERVICE",
        description: "Screen Replacement",
        hsn_sac_code: "998714",
        quantity: 1,
        unit: "pcs",
        unit_price: 500,
        amount: 500,
        gst_rate: 18,
        cgst_rate: 9,
        cgst_amount: 45,
        sgst_rate: 9,
        sgst_amount: 45,
        igst_rate: 0,
        igst_amount: 0,
        discount_percent: 0,
        inventory_item: null,
      },
    ],
  }),
);

vi.mock("@/lib/api", () => ({
  billingApi: {
    getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
    updateInvoice: vi.fn(() => Promise.resolve({})),
    logDownload: vi.fn(() => Promise.resolve()),
  },
  branchesApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  inventoryApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    listCategories: vi.fn(() => Promise.resolve([])),
    getCategories: vi.fn(() => Promise.resolve([])),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import EditInvoicePage from "@/app/billing/[id]/edit/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <EditInvoicePage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Edit Invoice page (billing/[id]/edit) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Edit Invoice page (billing/[id]/edit) — regression tests", () => {
  it("shows 'Edit Invoice INV-EDIT-001' heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /edit invoice inv-edit-001/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows Preview & Save button after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /preview & save/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows line item description from loaded invoice", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Screen Replacement")).toBeInTheDocument();
    });
  });

  it("calls getInvoice with ID from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetInvoice).toHaveBeenCalledWith("inv-1");
    });
  });
});
