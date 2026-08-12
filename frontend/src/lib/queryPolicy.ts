import type { QueryKey } from "@tanstack/react-query";
import { tokenManager } from "@/lib/api";

/** Include tenant identity in every cache entry, including legacy query keys. */
export function tenantQueryKeyHash(queryKey: QueryKey): string {
  return JSON.stringify([
    tokenManager.getCurrentBranchId() ?? "no-branch",
    queryKey,
  ]);
}
