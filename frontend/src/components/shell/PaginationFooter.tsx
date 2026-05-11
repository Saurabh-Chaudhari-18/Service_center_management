"use client";

import React from "react";
import { Button } from "@/components/ui";
import { cx } from "./cx";

export interface PaginationFooterProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPrevious: () => void;
  onNext: () => void;
  disabledPrevious?: boolean;
  disabledNext?: boolean;
  className?: string;
}

/**
 * Register-style range + prev/next — presentational only (no fetch).
 * Mobile: stacked label + full-width button row to avoid overflow crush.
 */
export function PaginationFooter({
  page,
  pageSize,
  totalCount,
  onPrevious,
  onNext,
  disabledPrevious,
  disabledNext,
  className,
}: PaginationFooterProps) {
  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  const prevDisabled = disabledPrevious ?? page <= 1;
  const nextDisabled = disabledNext ?? page * pageSize >= totalCount;

  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-t border-neutral-100 px-3 py-3 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-4",
        className,
      )}
    >
      <p className="min-w-0 text-sm text-neutral-500 dark:text-slate-400">
        Showing {start} to {end} of {totalCount} results
      </p>
      <div className="flex w-full shrink-0 gap-2 sm:w-auto sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1 sm:flex-initial"
          disabled={prevDisabled}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-w-0 flex-1 sm:flex-initial"
          disabled={nextDisabled}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
