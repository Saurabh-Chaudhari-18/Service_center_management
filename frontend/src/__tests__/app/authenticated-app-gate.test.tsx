import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/operations";
const replace = vi.fn();
let authState = { isAuthenticated: false, isLoading: false };

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { AuthenticatedAppGate } from "@/app/providers";

describe("AuthenticatedAppGate", () => {
  beforeEach(() => {
    pathname = "/operations";
    authState = { isAuthenticated: false, isLoading: false };
    replace.mockReset();
  });

  it("blocks direct navigation to a protected route and redirects to login", async () => {
    render(<AuthenticatedAppGate><div>private page</div></AuthenticatedAppGate>);

    expect(screen.queryByText("private page")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Checking session")).toBeInTheDocument();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?next=%2Foperations");
    });
  });

  it("renders public tracking without an authenticated session", () => {
    pathname = "/track/JOB-1";
    render(<AuthenticatedAppGate><div>tracking page</div></AuthenticatedAppGate>);
    expect(screen.getByText("tracking page")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
