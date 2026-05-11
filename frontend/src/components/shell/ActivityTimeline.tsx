"use client";

import React from "react";
import { cx } from "./cx";

export type ActivityTimelineItem = {
  id: string;
  /** Row body — caller formats text/dates; shell does not interpret domain fields. */
  content: React.ReactNode;
};

export interface ActivityTimelineProps {
  items: ActivityTimelineItem[];
  loading?: boolean;
  emptySlot?: React.ReactNode;
  className?: string;
}

/**
 * Vertical activity list chrome — no API or date-formatting opinions.
 */
export function ActivityTimeline({
  items,
  loading,
  emptySlot,
  className,
}: ActivityTimelineProps) {
  if (loading) {
    return (
      <div
        className={cx(
          "flex justify-center py-8 text-sm text-neutral-500 dark:text-slate-400",
          className,
        )}
      >
        Loading…
      </div>
    );
  }

  if (items.length === 0) {
    return <div className={className}>{emptySlot ?? null}</div>;
  }

  return (
    <div className={cx("relative", className)}>
      <ul className="m-0 list-none space-y-4 p-0" role="list">
        {items.map((item) => (
          <li key={item.id} className="relative pl-5">
            <span
              className="absolute left-0 top-2 block h-1.5 w-1.5 rounded-full bg-primary-500 ring-4 ring-white dark:bg-primary-400 dark:ring-slate-900"
              aria-hidden
            />
            {item.content}
          </li>
        ))}
      </ul>
    </div>
  );
}
