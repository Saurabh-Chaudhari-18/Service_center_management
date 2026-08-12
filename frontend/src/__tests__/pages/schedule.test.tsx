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
vi.mock("@/components/layout/Layout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, Header: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/lib/api", () => ({ jobsApi: { schedule: vi.fn(() => Promise.resolve({ jobs: [], technician_load: [], unassigned_count: 0 })) } }));

import SchedulePage from "@/app/schedule/page";

describe("Work Schedule page", () => {
  it("shows capacity and empty schedule guidance", async () => {
    render(<QueryClientProvider client={createTestQueryClient()}><SchedulePage /></QueryClientProvider>);
    expect(screen.getByRole("heading", { name: "Work Schedule" })).toBeInTheDocument();
    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    expect(await screen.findByText("No scheduled work")).toBeInTheDocument();
  });
});
