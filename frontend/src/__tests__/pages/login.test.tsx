import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthValue } from "../test-utils";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Capture push so we can assert redirects. Module-level vi.fn() survives
// vi.clearAllMocks() with its implementation intact; only call history is wiped.
const mockReplace = vi.fn();

// Override the global next/navigation mock (from vitest.setup.ts) with one
// that hands the same mockPush instance to every useRouter() call.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

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

// ── Import AFTER mocks ────────────────────────────────────────────────────────

import LoginPage from "@/app/login/page";
import { useAuth } from "@/context/AuthContext";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Login page", () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      ...mockAuthValue("OWNER"),
      isLoading: false,
      login: mockLogin,
    } as ReturnType<typeof useAuth>);
  });

  it("renders without crashing", () => {
    expect(() => render(<LoginPage />)).not.toThrow();
  });

  it("shows the ServiceHub branding", () => {
    render(<LoginPage />);
    expect(screen.getByText("ServiceHub")).toBeInTheDocument();
  });

  it("shows email and password input fields", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  it("shows Sign In button", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("calls login and redirects to /dashboard on success", async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "owner@test.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("owner@test.com", "password123");
    });
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("displays error message when login throws", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "owner@test.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "wrongpass");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("shows validation error for non-email input", async () => {
    render(<LoginPage />);

    // Use fireEvent.change + fireEvent.submit to bypass the native HTML5
    // <input type="email"> constraint, which in jsdom prevents the form's
    // submit event from firing when the value looks invalid to the browser.
    // We want react-hook-form's zodResolver to run so we can verify the error.
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "not-an-email" },
    });
    fireEvent.submit(document.querySelector("form")!);

    await waitFor(() => {
      expect(mockLogin).not.toHaveBeenCalled();
    });
    await waitFor(() => {
      const found = screen.queryAllByText(
        (content) => content.toLowerCase().includes("valid email"),
      );
      expect(found.length).toBeGreaterThan(0);
    });
  });

  it("shows validation error for empty password", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "owner@test.com");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });
});
