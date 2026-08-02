import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

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

// GSTDateFilter is a sibling file — mock it so no real date-range code runs.
vi.mock("@/app/gst/GSTDateFilter", () => ({
  GSTDateFilter: () => (
    <div data-testid="gst-date-filter" />
  ),
}));

// Module-level vi.fn() with a DEFAULT implementation so the function survives
// vi.restoreAllMocks() between tests (restoreAllMocks resets to the original
// implementation — for vi.fn(defaultImpl) that means defaultImpl remains).
const mockGetDashboard = vi.fn((..._args: unknown[]) =>
  Promise.resolve({
    net_payable: { total: 0 },
    output_gst: { total: 0, cgst: 0, sgst: 0, igst: 0 },
    input_tax_credit: { total: 0 },
    taxable_sales: 0,
    invoice_count: 0,
  }),
);

vi.mock("@/lib/api/services", () => ({
  gstApi: {
    getDashboard: (...args: unknown[]) => mockGetDashboard(...args),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import GSTDashboardPage from "@/app/gst/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderGST() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <GSTDashboardPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GST Dashboard page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderGST()).not.toThrow();
  });

  it("shows GST Dashboard heading", () => {
    renderGST();
    expect(screen.getByRole("heading", { name: "GST Dashboard" })).toBeInTheDocument();
  });

  it("shows date filter component", () => {
    renderGST();
    expect(screen.getByTestId("gst-date-filter")).toBeInTheDocument();
  });

  it("shows Net GST Payable section after data loads", async () => {
    renderGST();
    await waitFor(() => {
      expect(screen.getByText(/net gst payable/i)).toBeInTheDocument();
    });
  });
});
