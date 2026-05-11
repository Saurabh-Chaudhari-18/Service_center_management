"use client";

import React from "react";
import { Button } from "@/components/ui";
import { cx } from "./cx";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  /** Applied when this segment is selected (include bg + text + shadow tokens). */
  selectedClassName: string;
};

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  "aria-label": string;
  className?: string;
}

const BASE_SEGMENT =
  "rounded-lg px-4 py-2 font-medium text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-300";

/**
 * Two–few mutually exclusive scopes (e.g. pending vs history). Callers own state.
 * Uses `role="tablist"` / `role="tab"` for a11y without implying router tabs.
 */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        "flex w-full min-w-0 gap-1 rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-slate-700 dark:bg-slate-900/40",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Button
            key={opt.value}
            type="button"
            variant="ghost"
            size="sm"
            role="tab"
            aria-selected={selected}
            className={cx(
              BASE_SEGMENT,
              "min-w-0 flex-1 sm:flex-initial",
              selected && opt.selectedClassName,
            )}
            onClick={() => onValueChange(opt.value)}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
