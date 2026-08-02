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
  suppliersApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
    create: vi.fn().mockResolvedValue({ id: "sup-1" }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import SuppliersPage from "@/app/suppliers/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Suppliers page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<SuppliersPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<SuppliersPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Suppliers heading", () => {
    renderWithQuery(<SuppliersPage />);
    expect(screen.getByRole("heading", { name: "Suppliers" })).toBeInTheDocument();
  });

  it("shows Add Supplier button", () => {
    renderWithQuery(<SuppliersPage />);
    expect(screen.getByText(/add supplier/i)).toBeInTheDocument();
  });

  it("shows empty state message when no suppliers", async () => {
    renderWithQuery(<SuppliersPage />);
    await waitFor(() => {
      expect(screen.getByText(/no suppliers found/i)).toBeInTheDocument();
    });
  });
});
