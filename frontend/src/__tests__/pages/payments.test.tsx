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
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@/lib/api/services", () => ({
  purchasesApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
    recordPayment: vi.fn().mockResolvedValue({}),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import PaymentsPage from "@/app/payments/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Payments (Accounts Payable) page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<PaymentsPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<PaymentsPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Accounts Payable heading", () => {
    renderWithQuery(<PaymentsPage />);
    expect(screen.getByRole("heading", { name: "Accounts Payable" })).toBeInTheDocument();
  });

  it("shows Pending and History tabs", () => {
    renderWithQuery(<PaymentsPage />);
    // Actual tab button labels in the payments page
    expect(screen.getByText("Pending Payables")).toBeInTheDocument();
    expect(screen.getByText("All History")).toBeInTheDocument();
  });
});
