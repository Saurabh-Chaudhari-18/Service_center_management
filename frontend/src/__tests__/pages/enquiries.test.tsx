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
  enquiriesApi: {
    list: vi.fn().mockResolvedValue({ results: [] }),
    getStats: vi.fn().mockResolvedValue({ total: 0, open: 0, converted: 0 }),
    create: vi.fn().mockResolvedValue({ id: "enq-1" }),
    convertToJob: vi.fn().mockResolvedValue({ message: "Converted" }),
    markLost: vi.fn().mockResolvedValue({}),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import EnquiriesPage from "@/app/enquiries/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Enquiries page smoke tests", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => renderWithQuery(<EnquiriesPage />)).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderWithQuery(<EnquiriesPage />);
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Enquiries heading", () => {
    renderWithQuery(<EnquiriesPage />);
    expect(screen.getByRole("heading", { name: "Enquiries" })).toBeInTheDocument();
  });

  it("shows New Enquiry button", () => {
    renderWithQuery(<EnquiriesPage />);
    expect(screen.getByText(/new enquiry/i)).toBeInTheDocument();
  });
});
