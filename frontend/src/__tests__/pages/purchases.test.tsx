import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthValue } from "../test-utils";

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
  purchasesApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [], next: null, previous: null }),
    recordPayment: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
  },
  inventoryApi: {
    list: vi.fn().mockResolvedValue({ count: 0, results: [] }),
  },
  suppliersApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import PurchasesPage from "@/app/purchases/page";
import NewPurchasePage from "@/app/purchases/new/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Purchases page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => render(<PurchasesPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    render(<PurchasesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Purchase History heading", () => {
    render(<PurchasesPage />);
    expect(screen.getByRole("heading", { name: "Purchase History" })).toBeInTheDocument();
  });

  it("shows Add New Purchase button", () => {
    render(<PurchasesPage />);
    expect(screen.getByText(/add new purchase/i)).toBeInTheDocument();
  });
});

describe("New Purchase page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => render(<NewPurchasePage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    render(<NewPurchasePage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Add New Purchase heading", () => {
    render(<NewPurchasePage />);
    expect(screen.getByRole("heading", { name: "Add New Purchase" })).toBeInTheDocument();
  });
});
