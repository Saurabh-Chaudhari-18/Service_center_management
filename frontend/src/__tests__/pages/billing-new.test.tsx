import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/billing/new",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
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

vi.mock("@/lib/api", () => ({
  jobsApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    get: vi.fn(() => Promise.resolve({})),
  },
  billingApi: {
    createInvoice: vi.fn(() => Promise.resolve({ id: "inv-new" })),
    listInvoices: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    getInvoice: vi.fn(() => Promise.resolve({})),
  },
  inventoryApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    listCategories: vi.fn(() => Promise.resolve([])),
    getCategories: vi.fn(() => Promise.resolve([])),
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

import NewInvoicePage from "@/app/billing/new/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("New Invoice page (billing/new) smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() =>
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <NewInvoicePage />
        </QueryClientProvider>,
      ),
    ).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <NewInvoicePage />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows 'Create Invoice' heading", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <NewInvoicePage />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Create Invoice" })).toBeInTheDocument();
    });
  });

  it("shows 'New Invoice' subtitle when no job is linked", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <NewInvoicePage />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("New Invoice")).toBeInTheDocument();
    });
  });

  it("shows Add Item button for line items", async () => {
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <NewInvoicePage />
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
    });
  });
});
