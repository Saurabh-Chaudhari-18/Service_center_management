"use client";

import React from "react";
import { cx } from "./cx";

export interface WorkspaceEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

/** One-line workspace context per LAYOUT_SYSTEM (operational, not marketing). */
export function WorkspaceEyebrow({ children, className }: WorkspaceEyebrowProps) {
  return (
    <p
      className={cx(
        "text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-slate-400",
        className,
      )}
    >
      {children}
    </p>
  );
}
