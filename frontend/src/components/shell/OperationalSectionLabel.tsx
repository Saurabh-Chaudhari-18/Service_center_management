"use client";

import React from "react";
import { cx } from "./cx";

export interface OperationalSectionLabelProps {
  title: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}

/** Queue / list section heading + optional right hint (triage rhythm). */
export function OperationalSectionLabel({ title, hint, className }: OperationalSectionLabelProps) {
  return (
    <div
      className={cx(
        "mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-2",
        className,
      )}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400">
        {title}
      </h2>
      {hint !== undefined ? (
        <span className="text-[11px] text-neutral-400 dark:text-slate-500">{hint}</span>
      ) : null}
    </div>
  );
}
