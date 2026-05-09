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

vi.mock("@/components/billing/InvoiceTemplate", () => ({
  InvoiceTemplate: () => null,
}));

vi.mock("@/lib/api", () => ({
  billingApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    getStats: vi.fn().mockResolvedValue(null),
    createPayment: vi.fn().mockResolvedValue({}),
    updateStatus: vi.fn().mockResolvedValue({}),
    download: vi.fn().mockResolvedValue(new Blob()),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import BillingPage from "@/app/billing/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBilling(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <BillingPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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
      expect(screen.getByRole("heading", { name: "Billing & Invoices" })).toBeInTheDocument();
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
