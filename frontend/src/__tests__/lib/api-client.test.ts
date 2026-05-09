/**
 * Tests for the API client's tokenManager.
 *
 * Verifies token storage / retrieval / clearing behavior.
 * Uses the REAL tokenManager (not mocked) — this IS the unit under test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { tokenManager, API_BASE_URL } from "@/lib/api/client";

const ACCESS_KEY = "scm_access_token";
const REFRESH_KEY = "scm_refresh_token";
const BRANCH_KEY = "scm_current_branch";

describe("tokenManager", () => {
  beforeEach(() => {
    // localStorage is reset in vitest.setup.ts beforeEach;
    // clear mocks so call counts start fresh
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("getAccessToken returns null when nothing stored", () => {
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it("getRefreshToken returns null when nothing stored", () => {
    expect(tokenManager.getRefreshToken()).toBeNull();
  });

  it("setTokens stores access and refresh tokens", () => {
    tokenManager.setTokens("access-abc", "refresh-xyz");
    expect(localStorage.setItem).toHaveBeenCalledWith(ACCESS_KEY, "access-abc");
    expect(localStorage.setItem).toHaveBeenCalledWith(REFRESH_KEY, "refresh-xyz");
  });

  it("getAccessToken returns stored token after setTokens", () => {
    // Simulate what localStorage.getItem should return after setTokens
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === ACCESS_KEY) return "my-access";
      if (key === REFRESH_KEY) return "my-refresh";
      return null;
    });

    expect(tokenManager.getAccessToken()).toBe("my-access");
    expect(tokenManager.getRefreshToken()).toBe("my-refresh");
  });

  it("clearTokens removes access, refresh, and branch keys", () => {
    tokenManager.clearTokens();
    expect(localStorage.removeItem).toHaveBeenCalledWith(ACCESS_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(REFRESH_KEY);
    expect(localStorage.removeItem).toHaveBeenCalledWith(BRANCH_KEY);
  });

  it("setCurrentBranchId stores branch id", () => {
    tokenManager.setCurrentBranchId("branch-42");
    expect(localStorage.setItem).toHaveBeenCalledWith(BRANCH_KEY, "branch-42");
  });

  it("getCurrentBranchId returns null when not set", () => {
    expect(tokenManager.getCurrentBranchId()).toBeNull();
  });

  it("getCurrentBranchId returns stored branch id", () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) => {
      if (key === BRANCH_KEY) return "branch-99";
      return null;
    });

    expect(tokenManager.getCurrentBranchId()).toBe("branch-99");
  });
});

// ── API_BASE_URL ───────────────────────────────────────────────────────────────

describe("API_BASE_URL", () => {
  it("has a non-empty string value", () => {
    expect(typeof API_BASE_URL).toBe("string");
    expect(API_BASE_URL.length).toBeGreaterThan(0);
  });

  it("ends with /api (required by the backend routing convention)", () => {
    expect(API_BASE_URL.endsWith("/api")).toBe(true);
  });
});
