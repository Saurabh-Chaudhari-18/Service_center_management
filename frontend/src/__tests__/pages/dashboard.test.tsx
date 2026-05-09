/**
 * Smoke tests for the Dashboard page.
 *
 * Verifies the page renders without crashing under different auth states.
 * All API calls are mocked to return empty state.
 * These tests catch import errors and broken hook calls introduced during
 * Task 8 refactoring.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { UserRole } from "@/types";

// ── Mocks (hoisted before imports) ───────────────────────────────────────────

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
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/Layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
  Sidebar: () => null,
}));

vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/lib/api", () => ({
  jobsApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [], next: null, previous: null })),
    getStats: vi.fn(() => Promise.resolve({ total: 0, pending: 0, completed: 0 })),
  },
  billingApi: {
    getStats: vi.fn(() =>
      Promise.resolve({
        invoice_count: 0,
        total_invoiced: "0.00",
        total_paid: "0.00",
        total_pending: "0.00",
      }),
    ),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [], next: null, previous: null })),
  },
  pickupsApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [], next: null, previous: null })),
  },
  reportsApi: {
    getRevenue: vi.fn(() =>
      Promise.resolve({
        period: "this_month",
        total_revenue: 0,
        total_invoices: 0,
        total_services: 0,
        total_parts: 0,
        cgst_collected: 0,
        sgst_collected: 0,
        igst_collected: 0,
        daily_breakdown: [],
      }),
    ),
  },
  inventoryApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [], next: null, previous: null })),
    getStats: vi.fn(() => Promise.resolve({ total: 0, low_stock: 0, out_of_stock: 0 })),
  },
  customersApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [], next: null, previous: null })),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: {
    getBranding: vi.fn(() => Promise.reject(new Error("Not found"))),
  },
}));

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => null,
  Cell: () => null,
  Legend: () => null,
  BarChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => null,
  AreaChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: () => null,
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import DashboardPage from "@/app/dashboard/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

function renderDashboard(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("Dashboard page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderDashboard("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderDashboard("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderDashboard("MANAGER")).not.toThrow();
  });

  it("renders without crashing for ACCOUNTANT", () => {
    expect(() => renderDashboard("ACCOUNTANT")).not.toThrow();
  });

  it("renders without crashing for TECHNICIAN", () => {
    expect(() => renderDashboard("TECHNICIAN")).not.toThrow();
  });

  it("renders without crashing for RECEPTIONIST", () => {
    expect(() => renderDashboard("RECEPTIONIST")).not.toThrow();
  });

  it("renders without crashing for SUPER_ADMIN", () => {
    expect(() => renderDashboard("SUPER_ADMIN")).not.toThrow();
  });

  it("layout is present during data loading", async () => {
    renderDashboard("OWNER");
    await waitFor(() => {
      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });
  });
});
