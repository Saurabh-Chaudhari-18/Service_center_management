import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// next/dynamic is used for lazy-loading ReportsContent (which uses recharts).
// In tests, return the loading placeholder so jsdom never touches chart SVG APIs.
vi.mock("next/dynamic", () => ({
  default: (_importFn: unknown, opts?: { loading?: () => React.ReactElement }) => {
    return opts?.loading ?? (() => null);
  },
}));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", isDark: false, toggleTheme: vi.fn() }),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import ReportsPage from "@/app/reports/page";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Reports page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => render(<ReportsPage />)).not.toThrow();
  });

  it("shows the dynamic loading fallback while content loads", () => {
    render(<ReportsPage />);
    // The loading spinner div is always shown when dynamic import is pending
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
