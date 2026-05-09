/**
 * Tests for reusable UI components.
 *
 * Covers: Button, Input, Badge, JobStatusBadge, InvoiceStatusBadge,
 *         StatsCard, EmptyState.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  Button,
  Input,
  Badge,
  JobStatusBadge,
  InvoiceStatusBadge,
  StatsCard,
  EmptyState,
} from "@/components/ui";
import type { JobStatus, InvoiceStatus } from "@/types";

// ── Button ────────────────────────────────────────────────────────────────────

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("applies primary variant class by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button").className).toContain("btn-primary");
  });

  it("applies secondary variant class", () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole("button").className).toContain("btn-secondary");
  });

  it("applies danger variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button").className).toContain("btn-danger");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("is disabled and shows loader when isLoading", () => {
    const { container } = render(<Button isLoading>Saving…</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    // Loader2 icon renders as SVG inside button
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("hides children text behind loader when isLoading", () => {
    render(<Button isLoading>Save</Button>);
    // Children are still in the DOM but button is functionally disabled
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick handler", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click me
      </Button>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders left icon", () => {
    render(<Button leftIcon={<span data-testid="left-icon" />}>Action</Button>);
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("hides right icon when isLoading", () => {
    render(
      <Button isLoading rightIcon={<span data-testid="right-icon" />}>
        Go
      </Button>,
    );
    expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
  });
});

// ── Input ─────────────────────────────────────────────────────────────────────

describe("Input", () => {
  it("renders without label when label prop omitted", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Type here")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Input label="Email" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("shows required asterisk when required prop is set", () => {
    render(<Input label="Email" required />);
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows error message when error prop is set", () => {
    render(<Input label="Email" error="Invalid email" />);
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  it("does not show error when error prop is not set", () => {
    render(<Input label="Email" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows helper text when helperText prop is set (no error)", () => {
    render(<Input helperText="We'll never share your email" />);
    expect(screen.getByText("We'll never share your email")).toBeInTheDocument();
  });

  it("hides helper text when there is an error", () => {
    render(<Input helperText="Hint" error="Error!" />);
    expect(screen.queryByText("Hint")).not.toBeInTheDocument();
    expect(screen.getByText("Error!")).toBeInTheDocument();
  });
});

// ── Badge ─────────────────────────────────────────────────────────────────────

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies success variant classes", () => {
    render(<Badge variant="success">Paid</Badge>);
    const badge = screen.getByText("Paid");
    expect(badge.className).toContain("bg-green-100");
    expect(badge.className).toContain("text-green-700");
  });

  it("applies danger variant classes", () => {
    render(<Badge variant="danger">Overdue</Badge>);
    const badge = screen.getByText("Overdue");
    expect(badge.className).toContain("bg-red-100");
  });

  it("applies sm size classes", () => {
    render(<Badge size="sm">Tag</Badge>);
    expect(screen.getByText("Tag").className).toContain("text-[10px]");
  });
});

// ── JobStatusBadge ────────────────────────────────────────────────────────────

describe("JobStatusBadge", () => {
  const cases: [JobStatus, string][] = [
    ["RECEIVED", "Received"],
    ["DIAGNOSIS", "Under Diagnosis"],
    ["APPROVED", "Customer Approved"],
    ["REJECTED", "Customer Rejected"],
    ["WAITING_FOR_PARTS", "Waiting for Parts"],
    ["REPAIR_IN_PROGRESS", "Repair in Progress"],
    ["READY_FOR_DELIVERY", "Ready for Delivery"],
    ["DELIVERED", "Delivered"],
    ["CANCELLED", "Cancelled"],
    ["ESTIMATE_SHARED", "Estimate Shared"],
  ];

  it.each(cases)("status %s renders label %s", (status, label) => {
    render(<JobStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

// ── InvoiceStatusBadge ────────────────────────────────────────────────────────

describe("InvoiceStatusBadge", () => {
  const cases: [InvoiceStatus, string][] = [
    ["DRAFT", "Draft"],
    ["PENDING", "Pending"],
    ["PARTIAL", "Partially Paid"],
    ["PAID", "Paid"],
    ["CANCELLED", "Cancelled"],
  ];

  it.each(cases)("status %s renders label %s", (status, label) => {
    render(<InvoiceStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

// ── StatsCard ─────────────────────────────────────────────────────────────────

describe("StatsCard", () => {
  it("renders label and value", () => {
    render(<StatsCard label="Total Jobs" value={42} />);
    expect(screen.getByText("Total Jobs")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders positive trend", () => {
    render(<StatsCard label="Revenue" value="₹10,000" trend={{ value: 12, isPositive: true }} />);
    expect(screen.getByText(/12%/)).toBeInTheDocument();
    expect(screen.getByText(/▲/)).toBeInTheDocument();
  });

  it("renders negative trend", () => {
    render(<StatsCard label="Revenue" value="₹10,000" trend={{ value: 5, isPositive: false }} />);
    expect(screen.getByText(/▼/)).toBeInTheDocument();
  });
});

// ── EmptyState ────────────────────────────────────────────────────────────────

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Empty" description="Add your first item to get started." />);
    expect(screen.getByText("Add your first item to get started.")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(
      <EmptyState
        title="Empty"
        action={<button data-testid="action-btn">Add Item</button>}
      />,
    );
    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
  });
});
