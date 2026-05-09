import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

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

// Mock the CustomerCreateForm to avoid any API calls inside the form
vi.mock("@/app/customers/CustomerCreateForm", () => ({
  CustomerCreateForm: () => <div data-testid="customer-create-form" />,
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import NewCustomerPage from "@/app/customers/new/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NewCustomerPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("New Customer page (customers/new) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("New Customer page (customers/new) — regression tests", () => {
  it("shows 'Add Customer' heading", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Add Customer" })).toBeInTheDocument();
  });

  it("shows 'Create a new customer record' subtitle", () => {
    renderPage();
    expect(screen.getByText("Create a new customer record")).toBeInTheDocument();
  });

  it("shows the CustomerCreateForm", () => {
    renderPage();
    expect(screen.getByTestId("customer-create-form")).toBeInTheDocument();
  });

  it("shows 'Back to customers' button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /back to customers/i }),
    ).toBeInTheDocument();
  });
});
