import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/AuthContext")>();
  return {
    ...actual,
    useAuth: vi.fn(() => mockAuthValue("OWNER")),
  };
});

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", isDark: false, toggleTheme: vi.fn() }),
}));

// GSTDateFilter renders a date range picker — stub it out
vi.mock("@/app/gst/GSTDateFilter", () => ({
  GSTDateFilter: () => <div data-testid="gst-date-filter" />,
}));

// All GST sub-pages import gstApi from @/lib/api/services
vi.mock("@/lib/api/services", () => ({
  gstApi: {
    getGSTR1Data: vi.fn(() => Promise.resolve(null)),
    downloadGSTR1JSON: vi.fn(() => Promise.resolve()),
    getGSTR3BSummary: vi.fn(() => Promise.resolve(null)),
    markFiled: vi.fn(() => Promise.resolve()),
    getHSNCodes: vi.fn(() => Promise.resolve([])),
    createHSNCode: vi.fn(() => Promise.resolve({})),
    updateHSNCode: vi.fn(() => Promise.resolve({})),
    deleteHSNCode: vi.fn(() => Promise.resolve()),
    getITCRegister: vi.fn(() => Promise.resolve(null)),
    getOutputRegister: vi.fn(() => Promise.resolve(null)),
    getGSTPayments: vi.fn(() => Promise.resolve([])),
    createGSTPayment: vi.fn(() => Promise.resolve({})),
    deleteGSTPayment: vi.fn(() => Promise.resolve()),
    getDashboard: vi.fn(() => Promise.resolve(null)),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import GSTR1Page from "@/app/gst/gstr1/page";
import GSTR3BPage from "@/app/gst/gstr3b/page";
import HSNPage from "@/app/gst/hsn/page";
import ITCRegisterPage from "@/app/gst/itc/page";
import OutputRegisterPage from "@/app/gst/output/page";
import GSTPaymentsPage from "@/app/gst/payments/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function wrap(ui: React.ReactElement) {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>,
  );
}

// ── GSTR-1 ────────────────────────────────────────────────────────────────────

describe("GSTR-1 page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<GSTR1Page />)).not.toThrow();
  });

  it("shows GSTR-1 heading", () => {
    wrap(<GSTR1Page />);
    expect(screen.getByRole("heading", { name: /GSTR-1/i })).toBeInTheDocument();
  });

  it("shows the date filter", () => {
    wrap(<GSTR1Page />);
    expect(screen.getByTestId("gst-date-filter")).toBeInTheDocument();
  });

  it("shows Download JSON button", () => {
    wrap(<GSTR1Page />);
    expect(screen.getByRole("button", { name: /download json/i })).toBeInTheDocument();
  });
});

// ── GSTR-3B ───────────────────────────────────────────────────────────────────

describe("GSTR-3B page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<GSTR3BPage />)).not.toThrow();
  });

  it("shows GSTR-3B Summary heading", () => {
    wrap(<GSTR3BPage />);
    expect(screen.getByRole("heading", { name: /GSTR-3B Summary/i })).toBeInTheDocument();
  });

  it("shows the date filter", () => {
    wrap(<GSTR3BPage />);
    expect(screen.getByTestId("gst-date-filter")).toBeInTheDocument();
  });
});

// ── HSN / SAC Code Master ─────────────────────────────────────────────────────

describe("HSN page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<HSNPage />)).not.toThrow();
  });

  it("shows HSN / SAC Code Master heading", () => {
    wrap(<HSNPage />);
    expect(
      screen.getByRole("heading", { name: /HSN \/ SAC Code Master/i }),
    ).toBeInTheDocument();
  });

  it("shows Add Code button", () => {
    wrap(<HSNPage />);
    expect(screen.getByRole("button", { name: /add code/i })).toBeInTheDocument();
  });
});

// ── ITC Register ──────────────────────────────────────────────────────────────

describe("ITC Register page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<ITCRegisterPage />)).not.toThrow();
  });

  it("shows ITC Register heading", () => {
    wrap(<ITCRegisterPage />);
    expect(screen.getByRole("heading", { name: /ITC Register/i })).toBeInTheDocument();
  });

  it("shows the date filter", () => {
    wrap(<ITCRegisterPage />);
    expect(screen.getByTestId("gst-date-filter")).toBeInTheDocument();
  });
});

// ── Output Tax Register ───────────────────────────────────────────────────────

describe("Output Tax Register page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<OutputRegisterPage />)).not.toThrow();
  });

  it("shows Output Tax Register heading", () => {
    wrap(<OutputRegisterPage />);
    expect(
      screen.getByRole("heading", { name: /Output Tax Register/i }),
    ).toBeInTheDocument();
  });

  it("shows the date filter", () => {
    wrap(<OutputRegisterPage />);
    expect(screen.getByTestId("gst-date-filter")).toBeInTheDocument();
  });
});

// ── GST Payments ──────────────────────────────────────────────────────────────

describe("GST Payments page smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => wrap(<GSTPaymentsPage />)).not.toThrow();
  });

  it("shows GST Payments heading", () => {
    wrap(<GSTPaymentsPage />);
    expect(
      screen.getByRole("heading", { name: /GST Payments/i }),
    ).toBeInTheDocument();
  });

  it("shows Add Payment button", () => {
    wrap(<GSTPaymentsPage />);
    expect(screen.getByRole("button", { name: /add payment/i })).toBeInTheDocument();
  });
});
