"use client";

import React from "react";
import { cx } from "./cx";

export interface EntityTableProps {
  /** Content should normally be &lt;table&gt;…&lt;/table&gt; inside the scroll region */
  children: React.ReactNode;
  loading?: boolean;
  loadingSlot?: React.ReactNode;
  empty?: boolean;
  emptySlot?: React.ReactNode;
  paginationSlot?: React.ReactNode;
  /** When false, skips border/rounded wrapper (e.g. when already wrapped in Card) */
  bordered?: boolean;
  className?: string;
}

/**
 * Thin operational table wrapper: loading/empty/pagination choreography + horizontal scroll shell.
 *
 * Intended migration: wrap existing tables; render `loadingSlot={<LoadingState />}` etc.
 *
 * Anti-patterns avoided: column definitions, virtualization, mega data-grid props —
 * callers keep full control of &lt;thead&gt;/&lt;tbody&gt; and row semantics (Links, aria).
 */
export function EntityTable({
  children,
  loading = false,
  loadingSlot,
  empty = false,
  emptySlot,
  paginationSlot,
  bordered = true,
  className,
}: EntityTableProps) {
  let body: React.ReactNode = null;

  if (loading) {
    body = loadingSlot ?? null;
  } else if (empty) {
    body = emptySlot ?? null;
  } else if (bordered) {
    body = (
      <div className="-mx-px overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-slate-800/80 shadow-sm shadow-neutral-950/5 dark:shadow-black/40">
        {children}
      </div>
    );
  } else {
    body = <div className="min-w-0 overflow-x-auto">{children}</div>;
  }

  const showPagination =
    paginationSlot !== undefined && !loading && !empty;

  return (
    <div className={cx("flex min-w-0 flex-col space-y-4", className)}>
      {body}
      {showPagination ? (
        <div className="flex min-w-0 flex-wrap justify-end">{paginationSlot}</div>
      ) : null}
    </div>
  );
}
