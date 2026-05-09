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
  Header: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {actions}
    </div>
  ),
}));

vi.mock("@/lib/api", () => ({
  pickupsApi: {
    create: vi.fn(() => Promise.resolve({ id: "pickup-new" })),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  customersApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import NewPickupPage from "@/app/pickups/new/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NewPickupPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("New Pickup page (pickups/new) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("New Pickup page (pickups/new) — regression tests", () => {
  it("shows 'New Pickup Request' heading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "New Pickup Request" }),
    ).toBeInTheDocument();
  });

  it("shows 'Create a pickup request from a customer call' subtitle", () => {
    renderPage();
    expect(
      screen.getByText("Create a pickup request from a customer call"),
    ).toBeInTheDocument();
  });

  it("shows customer search input", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/search customer by name or mobile/i),
    ).toBeInTheDocument();
  });

  it("shows Create Pickup Request button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /create pickup request/i }),
    ).toBeInTheDocument();
  });
});
