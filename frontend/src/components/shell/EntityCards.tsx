"use client";

import React from "react";
import { cx } from "./cx";

export interface EntityCardsProps {
  /** Card/grid items wholly owned by callers (e.g. job cards). */
  children: React.ReactNode;
  compact?: boolean;
  /**
   * `responsive`: 1 col mobile, 2 col from `sm` (default register fallback).
   * `single`: one column — operational queues / triage lists.
   */
  columns?: "responsive" | "single";
  className?: string;
}

/**
 * Consistent spacing for responsive card grids / workflow lists (fallback for narrow viewports).
 *
 * Intended migration: replace ad-hoc `grid grid-cols-1 md:grid-cols-2 gap-*` divergence.
 *
 * Anti-patterns avoided: pushing fetch or empty-state logic inside this wrapper.
 */
export function EntityCards({
  children,
  compact = false,
  columns = "responsive",
  className,
}: EntityCardsProps) {
  const gap = compact ? "gap-3" : cx("gap-4", "lg:gap-6");
  const gridCols =
    columns === "single"
      ? "grid grid-cols-1 min-w-0"
      : cx("grid grid-cols-1 min-w-0 sm:grid-cols-2");

  return <div className={cx(gridCols, gap, className)}>{children}</div>;
}
