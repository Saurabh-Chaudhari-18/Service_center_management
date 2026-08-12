import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { createTestQueryClient, mockAuthValue } from "../test-utils";

vi.mock("@/context/AuthContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/context/AuthContext")>()),
  useAuth: () => mockAuthValue("OWNER"),
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/context/ToastContext", () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }));
vi.mock("@/components/layout/Layout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));
vi.mock("@/lib/api/services", () => ({
  branchesApi: { list: vi.fn(() => Promise.resolve([])) }, inventoryApi: { list: vi.fn(() => Promise.resolve({ results: [] })), listTransfers: vi.fn(() => Promise.resolve({ results: [] })) },
  suppliersApi: { listPurchaseOrders: vi.fn(() => Promise.resolve({ results: [] })), list: vi.fn(() => Promise.resolve({ results: [] })) },
  billingApi: { listCreditNotes: vi.fn(() => Promise.resolve({ results: [] })), listCreditEligibleInvoices: vi.fn(() => Promise.resolve([])), downloadCreditNote: vi.fn() },
  auditApi: { listLogs: vi.fn(() => Promise.resolve({ results: [], next: null, previous: null })) },
}));

import OperationsPage from "@/app/operations/page";

describe("Operations page", () => {
  it("exposes all owner workflows", () => {
    render(<QueryClientProvider client={createTestQueryClient()}><OperationsPage /></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: "Operations" })).toBeInTheDocument();
    for (const label of ["Stock transfers", "Purchase orders", "Credit notes", "Audit trail"]) expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
});
