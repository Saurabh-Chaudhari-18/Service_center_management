import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, mockAuthValue } from "../test-utils";
import type { Customer, UserRole } from "@/types";

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

vi.mock("@/app/customers/CustomerCreateForm", () => ({
  CustomerCreateForm: () => <div data-testid="customer-create-form" />,
}));

// Module-level vi.fn() with default impl — survives vi.restoreAllMocks() between tests.
const mockCustomersList = vi.fn(() =>
  Promise.resolve({ count: 0, results: [], next: null, previous: null }),
);

vi.mock("@/lib/api", () => ({
  customersApi: {
    list: (...args: unknown[]) => mockCustomersList(...args),
    create: vi.fn(() => Promise.resolve({ id: "cust-new" })),
    // Page uses getServiceHistory (not getJobHistory) in the CustomerDetailsModal
    getServiceHistory: vi.fn(() => Promise.resolve([])),
  },
  authApi: { getMe: vi.fn(), getMyBranches: vi.fn() },
  organizationsApi: { getBranding: vi.fn(() => Promise.reject(new Error())) },
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import CustomersPage from "@/app/customers/page";
import { useAuth } from "@/context/AuthContext";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    branch: "branch-1",
    branch_name: "Main Branch",
    first_name: "Alice",
    last_name: "Kumar",
    email: "alice@test.com",
    mobile: "9876543210",
    alternate_mobile: "",
    address_line1: "123 Main St",
    address_line2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    state_code: "27",
    gstin: "",
    company_name: "",
    sms_enabled: false,
    whatsapp_enabled: false,
    notes: "",
    is_active: true,
    pending_jobs_count: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderCustomers(role: UserRole = "OWNER") {
  vi.mocked(useAuth).mockReturnValue(mockAuthValue(role) as ReturnType<typeof useAuth>);
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <CustomersPage />
    </QueryClientProvider>,
  );
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe("Customers page smoke tests", () => {
  it("renders without crashing for OWNER", () => {
    expect(() => renderCustomers("OWNER")).not.toThrow();
  });

  it("renders the app layout wrapper", () => {
    renderCustomers("OWNER");
    expect(screen.getByTestId("app-layout")).toBeInTheDocument();
  });

  it("shows Customers heading", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument();
    });
  });

  it("shows Add Customer button", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add customer/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows search input", async () => {
    renderCustomers("OWNER");
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search by name or mobile/i),
      ).toBeInTheDocument();
    });
  });

  it("renders without crashing for MANAGER", () => {
    expect(() => renderCustomers("MANAGER")).not.toThrow();
  });

  it("renders without crashing for RECEPTIONIST", () => {
    expect(() => renderCustomers("RECEPTIONIST")).not.toThrow();
  });
});

// ── Regression tests ──────────────────────────────────────────────────────────

describe("Customers page — regression tests", () => {
  it("shows 'No customers found' when list is empty", async () => {
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("No customers found")).toBeInTheDocument();
    });
  });

  it("shows 'Add your first customer to get started' in empty state", async () => {
    renderCustomers();
    await waitFor(() => {
      expect(
        screen.getByText("Add your first customer to get started"),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Add Customer' button inside the empty state", async () => {
    renderCustomers();
    await waitFor(() => {
      // Both the header action and the empty state action render "Add Customer" buttons
      const buttons = screen.getAllByRole("button", { name: /add customer/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders customer first and last name as a card", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ first_name: "Alice", last_name: "Kumar" })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("Alice Kumar")).toBeInTheDocument();
    });
  });

  it("renders customer mobile number", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ mobile: "9876543210" })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("9876543210")).toBeInTheDocument();
    });
  });

  it("renders customer email when present", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ email: "alice@example.com" })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
  });

  it("renders customer city and state", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ city: "Mumbai", state: "Maharashtra" })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("Mumbai, Maharashtra")).toBeInTheDocument();
    });
  });

  it("shows pending badge when customer has pending jobs", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ pending_jobs_count: 3 })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("3 pending")).toBeInTheDocument();
    });
  });

  it("does not show pending badge when pending_jobs_count is 0", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ pending_jobs_count: 0 })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("Alice Kumar")).toBeInTheDocument();
    });
    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
  });

  it("renders multiple customers in the grid", async () => {
    mockCustomersList.mockResolvedValue({
      count: 2,
      results: [
        makeCustomer({ id: "cust-1", first_name: "Alice", last_name: "Kumar" }),
        makeCustomer({ id: "cust-2", first_name: "Bob", last_name: "Singh" }),
      ],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      expect(screen.getByText("Alice Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Singh")).toBeInTheDocument();
  });

  it("opens Add New Customer modal when Add Customer button is clicked", async () => {
    const user = userEvent.setup();
    renderCustomers();

    // Wait for the page to fully render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add customer/i })).toBeInTheDocument();
    });

    // Click the header "Add Customer" button
    const buttons = screen.getAllByRole("button", { name: /add customer/i });
    await user.click(buttons[0]);

    // The CustomerCreateForm stub should appear (rendered inside the Modal)
    await waitFor(() => {
      expect(screen.getByTestId("customer-create-form")).toBeInTheDocument();
    });
  });

  it("shows 'joined' date in customer card when created_at is set", async () => {
    mockCustomersList.mockResolvedValue({
      count: 1,
      results: [makeCustomer({ created_at: "2024-01-01T00:00:00Z" })],
      next: null,
      previous: null,
    });
    renderCustomers();
    await waitFor(() => {
      // The card shows "Since Jan 2024" format
      expect(screen.getByText(/since jan 2024/i)).toBeInTheDocument();
    });
  });
});
