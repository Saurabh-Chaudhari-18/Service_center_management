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
  ledgerApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
    getOutstanding: vi.fn().mockResolvedValue({ results: [] }),
    getStatement: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  customersApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import LedgerPage from "@/app/ledger/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Ledger (Customer Khata) page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<LedgerPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<LedgerPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Ledger (Khata) heading", () => {
    renderWithQuery(<LedgerPage />);
    expect(screen.getByRole("heading", { name: /ledger \(khata\)/i })).toBeInTheDocument();
  });

  it("shows Add Entry button", () => {
    renderWithQuery(<LedgerPage />);
    expect(screen.getByText(/add entry/i)).toBeInTheDocument();
  });
});
