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

vi.mock("@/app/customers/CustomerCreateForm", () => ({
  CustomerCreateForm: () => <div data-testid="customer-create-form" />,
}));

vi.mock("@/lib/api", () => ({
  customersApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    create: vi.fn().mockResolvedValue({ id: "cust-1" }),
    getJobHistory: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import CustomersPage from "@/app/customers/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderCustomers(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <CustomersPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Customers page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderCustomers("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderCustomers("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Customers heading", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    });
  });

  it("shows Add Customer button", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add customer/i })).toBeInTheDocument();
    });
  });

  it("shows search input", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name or mobile/i),
      ).toBeInTheDocument();
    });
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderCustomers("MANAGER")).not.toThrow();
  });

  it("renders without crashing for RECEPTIONIST", () => {
    expect(() => renderCustomers("RECEPTIONIST")).not.toThrow();
  });
});
