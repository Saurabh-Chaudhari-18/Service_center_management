import React from "react";
import { screen, waitFor } from "@testing-library/react";
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
    getOutstanding: vi.fn().mockResolvedValue({ results: [] }),
    getStatement: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  customersApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import ReceiptsPage from "@/app/receipts/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Receipts (Accounts Receivable) page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<ReceiptsPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<ReceiptsPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Receipts heading", () => {
    renderWithQuery(<ReceiptsPage />);
    expect(screen.getByRole("heading", { name: /receipts/i })).toBeInTheDocument();
  });

  it("shows Receive Payment button", () => {
    renderWithQuery(<ReceiptsPage />);
    expect(screen.getByText(/receive payment/i)).toBeInTheDocument();
  });

  it("shows Total Receivables section", async () => {
    renderWithQuery(<ReceiptsPage />);
    await waitFor(() => {
      expect(screen.getByText(/total receivables/i)).toBeInTheDocument();
    });
  });
});
