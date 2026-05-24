"use client";

import React from "react";
import { cx } from "./cx";

export interface RegisterListCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
  /** Accessible name when the card is interactive */
  ariaLabel?: string;
}

/**
 * Touch-friendly list row for register pages below `lg`.
 * Use with `hidden lg:block` table + `lg:hidden` card stack pattern.
 */
export function RegisterListCard({
  children,
  onClick,
  selected = false,
  className,
  ariaLabel,
}: RegisterListCardProps) {
  const base = cx(
    "card w-full text-left p-4 transition-all duration-200",
    "hover:shadow-md dark:hover:border-slate-600",
    selected && "ring-2 ring-primary-500 border-primary-200 dark:border-primary-600",
    onClick && "cursor-pointer",
    className,
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={base}
      >
        {children}
      </div>
    );
  }

  return <div className={base}>{children}</div>;
}
