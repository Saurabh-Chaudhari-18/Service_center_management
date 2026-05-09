import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  jobsApi: {
    create: vi.fn(() => Promise.resolve({ id: "job-new" })),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    get: vi.fn(() => Promise.resolve({})),
  },
  customersApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    create: vi.fn(() => Promise.resolve({})),
  },
  branchesApi: {
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
  },
  dropdownOptionsApi: {
    list: vi.fn(() => Promise.resolve([])),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import NewJobPage from "@/app/jobs/new/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <NewJobPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("New Job page (jobs/new) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("New Job page (jobs/new) — regression tests", () => {
  it("shows 'Create Job Card' heading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Create Job Card" }),
    ).toBeInTheDocument();
  });

  it("shows 'Register a new device for service' subtitle", () => {
    renderPage();
    expect(screen.getByText("Register a new device for service")).toBeInTheDocument();
  });

  it("shows customer search input", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/search by name or mobile/i),
    ).toBeInTheDocument();
  });

  it("shows Register New Customer button", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: /register new customer/i }),
    ).toBeInTheDocument();
  });
});
