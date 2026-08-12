import { beforeEach, describe, expect, it, vi } from "vitest";

import { RefreshCoordinator } from "@/lib/api/refreshCoordinator";
import { tenantQueryKeyHash } from "@/lib/queryPolicy";
import { isPublicPath } from "@/lib/routePolicy";

describe("RefreshCoordinator", () => {
  it("rejects every waiting request when the shared refresh fails", async () => {
    const coordinator = new RefreshCoordinator<string>();
    let rejectRefresh!: (error: Error) => void;
    const operation = vi.fn(() => new Promise<string>((_, reject) => {
      rejectRefresh = reject;
    }));

    const first = coordinator.run(operation);
    const second = coordinator.run(operation);
    rejectRefresh(new Error("refresh rejected"));

    const outcomes = await Promise.allSettled([first, second]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "rejected",
      "rejected",
    ]);
  });
});

describe("tenant query identity", () => {
  beforeEach(() => sessionStorage.clear());

  it("changes the cache hash when the active branch changes", () => {
    sessionStorage.setItem("scm_current_branch", "branch-a");
    const first = tenantQueryKeyHash(["invoices"]);
    sessionStorage.setItem("scm_current_branch", "branch-b");
    const second = tenantQueryKeyHash(["invoices"]);
    expect(first).not.toBe(second);
  });
});

describe("route policy", () => {
  it("keeps only intentional public routes public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/track/JOB-1")).toBe(true);
    expect(isPublicPath("/operations")).toBe(false);
    expect(isPublicPath("/outsourcing")).toBe(false);
    expect(isPublicPath("/schedule")).toBe(false);
  });
});
