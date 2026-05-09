import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthValue } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => mockAuthValue("OWNER")),
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
    expect(() => render(<ExpensesPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    render(<ExpensesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Expenses heading", () => {
    render(<ExpensesPage />);
    expect(screen.getByRole("heading", { name: "Expenses" })).toBeInTheDocument();
  });

  it("shows Add Expense button", () => {
    render(<ExpensesPage />);
    expect(screen.getByText(/add expense/i)).toBeInTheDocument();
  });
});
