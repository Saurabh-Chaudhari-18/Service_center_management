/**
 * Tests for the API client's tokenManager.
 *
 * Verifies token storage / retrieval / clearing behavior.
 * Uses the REAL tokenManager (not mocked) — this IS the unit under test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { tokenManager, API_BASE_URL } from "@/lib/api/client";

const ACCESS_KEY = "scm_access_token";
const BRANCH_KEY = "scm_current_branch";

describe("tokenManager", () => {
  beforeEach(() => {
    // localStorage is reset in vitest.setup.ts beforeEach;
    // clear mocks so call counts start fresh
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("getAccessToken returns null when nothing stored", () => {
    expect(tokenManager.getAccessToken()).toBeNull();
  });


  it("setTokens never exposes an access token to browser storage", () => {
    tokenManager.setTokens("access-abc");
    expect(sessionStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(sessionStorage.getItem("scm_refresh_token")).toBeNull();
  });

  it("ignores legacy stored access tokens", () => {
    sessionStorage.setItem(ACCESS_KEY, "my-access");
    expect(tokenManager.getAccessToken()).toBeNull();
  });

  it("clearTokens removes access and branch keys", () => {
    sessionStorage.setItem(ACCESS_KEY, "access");
    sessionStorage.setItem(BRANCH_KEY, "branch");
    tokenManager.clearTokens();
    expect(sessionStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(sessionStorage.getItem(BRANCH_KEY)).toBeNull();
  });

  it("setCurrentBranchId stores branch id", () => {
    tokenManager.setCurrentBranchId("branch-42");
    expect(sessionStorage.getItem(BRANCH_KEY)).toBe("branch-42");
  });

  it("getCurrentBranchId returns null when not set", () => {
    expect(tokenManager.getCurrentBranchId()).toBeNull();
  });

  it("getCurrentBranchId returns stored branch id", () => {
    sessionStorage.setItem(BRANCH_KEY, "branch-99");
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
