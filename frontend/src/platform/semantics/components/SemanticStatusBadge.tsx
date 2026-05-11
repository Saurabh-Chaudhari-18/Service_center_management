"use client";

import React from "react";
import type { StatusPresentation } from "../types";
import { SEMANTIC_TONE_BADGE_CLASSES } from "../tone";

function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}

export interface SemanticStatusBadgeProps {
  presentation: StatusPresentation;
  /** `md` matches global `.badge`; `sm` matches compact register chips. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Presentational status chip. Callers supply `StatusPresentation` from platform adapters.
 */
export function SemanticStatusBadge({
  presentation,
  size = "md",
  className,
}: SemanticStatusBadgeProps) {
  const { label, tone, chipColors } = presentation;
  const sizeClass =
    size === "sm"
      ? "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      : "badge";

  return (
    <span
      data-semantic-tone={tone}
      className={cx(sizeClass, className)}
      style={{
        backgroundColor: chipColors.background,
        color: chipColors.foreground,
      }}
      title={label}
    >
      {label}
    </span>
  );
}

/** Story/tests: render without inline colors using tone classes only. */
export function SemanticToneBadge({
  tone,
  label,
  size = "md",
  className,
}: {
  tone: StatusPresentation["tone"];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizeClass =
    size === "sm"
      ? "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      : "badge";
  return (
    <span className={cx(sizeClass, SEMANTIC_TONE_BADGE_CLASSES[tone], className)}>
      {label}
    </span>
  );
}
