/**
 * Tests for Sidebar navigation visibility by role.
 *
 * Each nav item has a permission OR role constraint. These tests verify
 * the filter is applied correctly — this is the critical guard against
 * Task 8 refactoring accidentally removing permission checks.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthValue } from "../test-utils";
import type { UserRole } from "@/types";

// ── Module mocks ──────────────────────────────────────────────────────────────
// vi.mock calls are hoisted by vite before imports, so the imports below
// receive the mocked versions automatically.

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      currentBranch: null,
      accessibleBranches: [],
      organizationBranding: null,
      login: vi.fn(),
      logout: vi.fn(),
      switchBranch: vi.fn(),
      refreshUser: vi.fn(),
      hasPermission: () => false,
      isRole: () => false,
    })),
  };
});

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", isDark: false, toggleTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("@/components/layout/TechnicianLocationTracker", () => ({
  TechnicianLocationTracker: () => null,
}));

// ── Import AFTER mocks (receives mocked versions) ─────────────────────────────

import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layout/Layout";

// ── Helper ────────────────────────────────────────────────────────────────────

function renderSidebarAs(role: UserRole) {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  render(<Sidebar />);
}

// ── OWNER ─────────────────────────────────────────────────────────────────────

describe("Sidebar – OWNER", () => {
  beforeEach(() => renderSidebarAs("OWNER"));

  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows Job Cards", () => expect(screen.getByText("Job Cards")).toBeInTheDocument());
  it("shows Inventory", () => expect(screen.getByText("Inventory")).toBeInTheDocument());
  it("shows Accounts & Finance", () => expect(screen.getByText("Accounts & Finance")).toBeInTheDocument());
  it("shows Reports", () => expect(screen.getByText("Reports")).toBeInTheDocument());
  it("shows Branches", () => expect(screen.getByText("Branches")).toBeInTheDocument());
  it("shows Staff", () => expect(screen.getByText("Staff")).toBeInTheDocument());
  it("shows Customers", () => expect(screen.getByText("Customers")).toBeInTheDocument());
  it("shows Suppliers", () => expect(screen.getByText("Suppliers")).toBeInTheDocument());
  it("shows Pickup & Drop", () => expect(screen.getByText("Pickup & Drop")).toBeInTheDocument());
  it("does NOT show My Jobs (technician-only)", () => expect(screen.queryByText("My Jobs")).not.toBeInTheDocument());
  it("does NOT show Organizations (super-admin only)", () => expect(screen.queryByText("Organizations")).not.toBeInTheDocument());
});

// ── MANAGER ───────────────────────────────────────────────────────────────────

describe("Sidebar – MANAGER", () => {
  beforeEach(() => renderSidebarAs("MANAGER"));

  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows Job Cards", () => expect(screen.getByText("Job Cards")).toBeInTheDocument());
  it("shows Inventory", () => expect(screen.getByText("Inventory")).toBeInTheDocument());
  it("shows Accounts & Finance", () => expect(screen.getByText("Accounts & Finance")).toBeInTheDocument());
  it("shows Reports", () => expect(screen.getByText("Reports")).toBeInTheDocument());
  it("shows Customers", () => expect(screen.getByText("Customers")).toBeInTheDocument());
  it("does NOT show Branches (no canManageBranches)", () => expect(screen.queryByText("Branches")).not.toBeInTheDocument());
  it("does NOT show Staff (no canManageUsers)", () => expect(screen.queryByText("Staff")).not.toBeInTheDocument());
  it("does NOT show My Jobs", () => expect(screen.queryByText("My Jobs")).not.toBeInTheDocument());
});

// ── TECHNICIAN ────────────────────────────────────────────────────────────────

describe("Sidebar – TECHNICIAN", () => {
  beforeEach(() => renderSidebarAs("TECHNICIAN"));

  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows My Jobs (technician-only item)", () => expect(screen.getByText("My Jobs")).toBeInTheDocument());
  it("shows Job Cards (canViewJobCards)", () => expect(screen.getByText("Job Cards")).toBeInTheDocument());
  it("does NOT show Inventory (no canViewInventory)", () => expect(screen.queryByText("Inventory")).not.toBeInTheDocument());
  it("does NOT show Accounts & Finance", () => expect(screen.queryByText("Accounts & Finance")).not.toBeInTheDocument());
  it("does NOT show Customers", () => expect(screen.queryByText("Customers")).not.toBeInTheDocument());
  it("does NOT show Reports", () => expect(screen.queryByText("Reports")).not.toBeInTheDocument());
  it("does NOT show Branches", () => expect(screen.queryByText("Branches")).not.toBeInTheDocument());
  it("does NOT show Staff", () => expect(screen.queryByText("Staff")).not.toBeInTheDocument());
  it("shows Pickup & Drop (canViewPickups)", () => expect(screen.getByText("Pickup & Drop")).toBeInTheDocument());
});

// ── RECEPTIONIST ──────────────────────────────────────────────────────────────

describe("Sidebar – RECEPTIONIST", () => {
  beforeEach(() => renderSidebarAs("RECEPTIONIST"));

  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows Job Cards", () => expect(screen.getByText("Job Cards")).toBeInTheDocument());
  it("shows Customers", () => expect(screen.getByText("Customers")).toBeInTheDocument());
  it("shows Enquiries", () => expect(screen.getByText("Enquiries")).toBeInTheDocument());
  it("shows Pickup & Drop", () => expect(screen.getByText("Pickup & Drop")).toBeInTheDocument());
  it("does NOT show Inventory (no canViewInventory)", () => expect(screen.queryByText("Inventory")).not.toBeInTheDocument());
  it("does NOT show Accounts & Finance", () => expect(screen.queryByText("Accounts & Finance")).not.toBeInTheDocument());
  it("does NOT show Reports", () => expect(screen.queryByText("Reports")).not.toBeInTheDocument());
  it("does NOT show My Jobs", () => expect(screen.queryByText("My Jobs")).not.toBeInTheDocument());
});

// ── ACCOUNTANT ────────────────────────────────────────────────────────────────

describe("Sidebar – ACCOUNTANT", () => {
  beforeEach(() => renderSidebarAs("ACCOUNTANT"));

  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows Accounts & Finance", () => expect(screen.getByText("Accounts & Finance")).toBeInTheDocument());
  it("shows Reports", () => expect(screen.getByText("Reports")).toBeInTheDocument());
  it("does NOT show Job Cards (no canViewJobCards)", () => expect(screen.queryByText("Job Cards")).not.toBeInTheDocument());
  it("does NOT show Inventory", () => expect(screen.queryByText("Inventory")).not.toBeInTheDocument());
  it("does NOT show Customers", () => expect(screen.queryByText("Customers")).not.toBeInTheDocument());
  it("does NOT show My Jobs", () => expect(screen.queryByText("My Jobs")).not.toBeInTheDocument());
  it("does NOT show Pickup & Drop (no canViewPickups)", () => expect(screen.queryByText("Pickup & Drop")).not.toBeInTheDocument());
});

// ── SUPER_ADMIN ───────────────────────────────────────────────────────────────

describe("Sidebar – SUPER_ADMIN", () => {
  beforeEach(() => renderSidebarAs("SUPER_ADMIN"));

  it("shows Organizations", () => expect(screen.getByText("Organizations")).toBeInTheDocument());
  it("shows Dashboard", () => expect(screen.getByText("Dashboard")).toBeInTheDocument());
  it("shows Branches (canManageBranches)", () => expect(screen.getByText("Branches")).toBeInTheDocument());
  it("shows Staff (canManageUsers)", () => expect(screen.getByText("Staff")).toBeInTheDocument());
  it("does NOT show Accounts & Finance (no canViewBilling)", () => expect(screen.queryByText("Accounts & Finance")).not.toBeInTheDocument());
});
