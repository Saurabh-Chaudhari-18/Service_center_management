import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { Purchase } from "@/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/purchases/pur-1",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "pur-1" }),
}));

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
    actions,
  }: {
    title: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));

// purchases/[id]/page.tsx imports purchasesApi directly from @/lib/api/services
const mockGetPurchase = vi.fn(() =>
  Promise.resolve<Purchase>({
    id: "pur-1",
    branch: "branch-1",
    vendor_name: "Tech Supplies Co.",
    vendor_gstin: "27AABCT1332L1ZV",
    invoice_number: "VINV-001",
    purchase_date: "2024-06-10",
    total_amount: 500,
    notes: "",
    items: [],
    created_at: "2024-06-10T00:00:00Z",
    updated_at: "2024-06-10T00:00:00Z",
  }),
);

vi.mock("@/lib/api/services", () => ({
  purchasesApi: {
    get: (...args: unknown[]) => mockGetPurchase(...args),
    list: vi.fn(() => Promise.resolve({ count: 0, results: [] })),
    create: vi.fn(() => Promise.resolve({})),
  },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import PurchaseDetailPage from "@/app/purchases/[id]/page";
import { useAuth } from "@/context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue("OWNER") as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PurchaseDetailPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Purchase detail page (purchases/[id]) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderPage();
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });
});

describe("Purchase detail page (purchases/[id]) — regression tests", () => {
  it("shows 'Purchase Details' heading after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Purchase Details" }),
      ).toBeInTheDocument();
    });
  });

  it("shows vendor name after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Tech Supplies Co.")).toBeInTheDocument();
    });
  });

  it("shows invoice number after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/VINV-001/)).toBeInTheDocument();
    });
  });

  it("calls purchasesApi.get with id from useParams", async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGetPurchase).toHaveBeenCalledWith("pur-1");
    });
  });
});
