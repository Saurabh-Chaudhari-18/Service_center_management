import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthValue, renderWithQuery } from "../test-utils";

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

vi.mock("@/lib/api/services", () => ({
  expensesApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
    getStats: vi.fn().mockResolvedValue({ total: 0, by_category: {} }),
    create: vi.fn().mockResolvedValue({ id: "exp-1" }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import ExpensesPage from "@/app/expenses/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Expenses page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<ExpensesPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<ExpensesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Expenses heading", () => {
    renderWithQuery(<ExpensesPage />);
    expect(screen.getByRole("heading", { name: "Expenses" })).toBeInTheDocument();
  });

  it("shows Add Expense button", () => {
    renderWithQuery(<ExpensesPage />);
    expect(screen.getByText(/add expense/i)).toBeInTheDocument();
  });
});
