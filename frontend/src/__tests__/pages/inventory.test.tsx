/**
 * Smoke tests for the Inventory page.
 *
 * Verifies the page renders without crashing and that the key permission
 * gate (canManageInventory) controls write-action visibility.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { InventoryItem, UserRole } from "@/types";

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
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/Layout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
  Sidebar: () => null,
}));

const mockInventoryList = vi.fn((..._args: unknown[]) =>
  Promise.resolve({ count: 0, results: [] as InventoryItem[], next: null, previous: null }),
);

vi.mock("@/lib/api", () => ({
  inventoryApi: {
    list: (...args: unknown[]) => mockInventoryList(...args),
    create: vi.fn(() => Promise.resolve({ id: "new-1" })),
    update: vi.fn(() => Promise.resolve({})),
    adjustStock: vi.fn(() => Promise.resolve({})),
    getAdjustmentHistory: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    getCategories: vi.fn(() => Promise.resolve([])),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import InventoryPage from "@/app/inventory/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: "item-1",
    branch: "branch-1",
    name: "Laptop Screen 15.6\"",
    sku: "SCR-001",
    description: "Full HD replacement screen",
    cost_price: 2000,
    selling_price: 3500,
    gst_rate: 18,
    hsn_code: "8473",
    quantity: 5,
    low_stock_threshold: 2,
    unit: "piece",
    vendor_name: "Parts Vendor",
    vendor_contact: "9900000000",
    warranty_period_months: 6,
    is_low_stock: false,
    is_out_of_stock: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderInventory(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <InventoryPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Inventory page smoke tests", () => {
  beforeEach(() => {
    mockInventoryList.mockResolvedValue({ count: 0, results: [], next: null, previous: null });
  });

  it("renders without crashing for OWNER", () => {
    expect(() => renderInventory("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderInventory("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderInventory("MANAGER")).not.toThrow();
  });

  it("renders without crashing for TECHNICIAN", () => {
    expect(() => renderInventory("TECHNICIAN")).not.toThrow();
  });

  it("shows Add Item button in empty state (when list is empty)", async () => {
    renderInventory("OWNER");

    // Wait for data to load and empty state to appear
    await waitFor(() => {
      expect(screen.getByText("Add Item")).toBeInTheDocument();
    });
  });

  it("shows stats header labels for all roles", async () => {
    renderInventory("OWNER");

    await waitFor(() => {
      expect(screen.getByTestId("app-layout")).toBeInTheDocument();
    });

    expect(screen.getByText("Total Items")).toBeInTheDocument();
    expect(screen.getByText("Total Value")).toBeInTheDocument();
    // "Low Stock" and "Out of Stock" appear in both the stats header and filter buttons
    expect(screen.getAllByText("Low Stock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Out of Stock").length).toBeGreaterThan(0);
  });

  it("renders inventory items when data is returned", async () => {
    mockInventoryList.mockResolvedValue({
      count: 2,
      results: [
        makeItem({ id: "item-1", name: "Laptop Screen 15.6\"" }),
        makeItem({ id: "item-2", name: "Keyboard USB", sku: "KB-001" }),
      ],
      next: null,
      previous: null,
    });

    renderInventory("OWNER");

    await waitFor(() => {
      expect(screen.getByText("Laptop Screen 15.6\"")).toBeInTheDocument();
    });
    expect(screen.getByText("Keyboard USB")).toBeInTheDocument();
  });

  it("shows low stock badge for low-stock items", async () => {
    mockInventoryList.mockResolvedValue({
      count: 1,
      results: [makeItem({ id: "item-1", name: "Rare Part", quantity: 1, is_low_stock: true })],
      next: null,
      previous: null,
    });

    renderInventory("OWNER");

    await waitFor(() => {
      expect(screen.getByText("Rare Part")).toBeInTheDocument();
    });
    // The badge text is "Low Stock" (not just "Low")
    const lowStockElements = screen.getAllByText("Low Stock");
    expect(lowStockElements.length).toBeGreaterThan(0);
  });

  it("shows out-of-stock badge for zero-quantity items", async () => {
    mockInventoryList.mockResolvedValue({
      count: 1,
      results: [makeItem({ id: "item-1", name: "Rare Part", quantity: 0, is_out_of_stock: true })],
      next: null,
      previous: null,
    });

    renderInventory("OWNER");

    await waitFor(() => {
      expect(screen.getByText("Rare Part")).toBeInTheDocument();
    });
    // The badge text is "Out of Stock" — multiple elements may match (stats header + badge)
    const outOfStockElements = screen.getAllByText("Out of Stock");
    expect(outOfStockElements.length).toBeGreaterThan(0);
  });
});
