"use client";

import React from "react";
import { cx } from "./cx";

export interface WorkspaceSurfaceProps extends React.ComponentPropsWithoutRef<"div"> {
  children: React.ReactNode;
}

/** Bordered primary workspace list/detail container — no scroll or data logic. */
export function WorkspaceSurface({ children, className, ...rest }: WorkspaceSurfaceProps) {
  return (
    <div
      className={cx(
        "min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-slate-700 dark:bg-slate-800",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
