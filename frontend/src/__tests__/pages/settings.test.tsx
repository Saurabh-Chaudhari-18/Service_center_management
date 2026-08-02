import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { UserRole } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => mockAuthValue("OWNER")),
    ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
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

vi.mock("@/lib/api", () => ({
  authApi: {
    getMe: vi.fn().mockResolvedValue({}),
    getMyBranches: vi.fn().mockResolvedValue([]),
    changePassword: vi.fn().mockResolvedValue({}),
  },
  notificationsApi: {
    getPreferences: vi.fn().mockResolvedValue({}),
    updatePreferences: vi.fn().mockResolvedValue({}),
    getAlerts: vi.fn().mockResolvedValue({ results: [] }),
    markAllRead: vi.fn().mockResolvedValue({}),
  },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import SettingsPage from "@/app/settings/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderSettings(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(
    mockAuthValue(role) as ReturnType<typeof useAuth>,
  );
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Settings page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderSettings("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderSettings("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Settings heading", () => {
    renderSettings("OWNER");
    expect(
      screen.getByRole("heading", { name: "Settings" }),
    ).toBeInTheDocument();
  });

  it("shows Profile tab navigation", () => {
    renderSettings("OWNER");
    expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
  });

  it("shows Security tab", () => {
    renderSettings("OWNER");
    expect(screen.getByText(/security/i)).toBeInTheDocument();
  });

  it("shows user email in profile section as read-only text", () => {
    renderSettings("OWNER");
    expect(screen.getByText("owner@test.com")).toBeInTheDocument();
    expect(document.querySelector('input[value="owner@test.com"]')).toBeNull();
  });

  it("renders without crashing for TECHNICIAN", () => {
    expect(() => renderSettings("TECHNICIAN")).not.toThrow();
  });

  it("renders without crashing for ACCOUNTANT", () => {
    expect(() => renderSettings("ACCOUNTANT")).not.toThrow();
  });
});
