import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/track/JOB-001",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ job_number: "JOB-001" }),
}));

// The track page imports API_BASE_URL from @/lib/api
vi.mock("@/lib/api", () => ({
  API_BASE_URL: "http://test-api.example.com",
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import TrackJobPage from "@/app/track/[job_number]/page";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <TrackJobPage />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Track Job page (track/[job_number]) smoke tests", () => {
  it("renders without crashing", () => {
    expect(() => renderPage()).not.toThrow();
  });
});

describe("Track Job page (track/[job_number]) — regression tests", () => {
  it("shows 'Track Your Service' heading", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /track your service/i }),
    ).toBeInTheDocument();
  });

  it("shows Verify Identity subheading", () => {
    renderPage();
    expect(screen.getByText(/verify identity/i)).toBeInTheDocument();
  });

  it("displays the job number on screen", () => {
    renderPage();
    expect(screen.getByText("JOB-001")).toBeInTheDocument();
  });

  it("shows phone number input field", () => {
    renderPage();
    expect(
      screen.getByPlaceholderText(/enter last 10 digits/i),
    ).toBeInTheDocument();
  });

  it("shows View Status submit button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /view status/i })).toBeInTheDocument();
  });

  it("shows error when submitting with a short phone number", async () => {
    renderPage();
    const input = screen.getByPlaceholderText(/enter last 10 digits/i);
    const pinInput = screen.getByPlaceholderText(/pin from your sms/i);
    const button = screen.getByRole("button", { name: /view status/i });

    await userEvent.type(input, "123");
    await userEvent.type(pinInput, "1234");
    await userEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid phone number/i),
      ).toBeInTheDocument();
    });
  });
});
