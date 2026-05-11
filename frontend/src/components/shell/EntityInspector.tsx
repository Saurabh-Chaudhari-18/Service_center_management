"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cx } from "./cx";

export type EntityInspectorWidth = "md" | "lg";

export interface EntityInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  /** Panel width on `md+` breakpoints; always full width on small screens. */
  width?: EntityInspectorWidth;
  children: React.ReactNode;
  className?: string;
}

const WIDTH_CLASS: Record<EntityInspectorWidth, string> = {
  md: "md:w-[550px]",
  lg: "md:w-[min(90vw,720px)]",
};

/**
 * Docked right inspector chrome only — no data fetching.
 * Governance: routes/domain bodies own queries; shell owns layout + overlay stacking.
 */
export function EntityInspector({
  open,
  onOpenChange,
  title,
  subtitle,
  headerActions,
  footer,
  width = "md",
  children,
  className,
}: EntityInspectorProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 bg-black/20 md:hidden"
        style={{ zIndex: "var(--z-inspector-backdrop)" }}
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cx(
          "fixed inset-y-0 right-0 flex w-full flex-col border-l border-neutral-200 bg-white shadow-2xl animate-slide-in-right dark:border-slate-700 dark:bg-slate-900",
          WIDTH_CLASS[width],
          className,
        )}
        style={{ zIndex: "var(--z-inspector)" }}
        role="complementary"
        aria-label="Detail inspector"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="truncate text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {title}
            </h2>
            {subtitle != null && subtitle !== "" && (
              <p className="truncate text-sm text-neutral-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-200 dark:hover:bg-slate-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>

        {footer != null && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/80">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
