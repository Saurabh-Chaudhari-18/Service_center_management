"use client";

import React from "react";
import { cx } from "./cx";

export interface FormSectionProps
  extends Omit<React.ComponentPropsWithoutRef<"section">, "title"> {
  /** Section heading (distinct from HTML `section` tooltip `title`) */
  title?: React.ReactNode;
  /** Optional subdued helper shown under title */
  description?: React.ReactNode;
  /** Field groups owned by callers */
  children: React.ReactNode;
  /** Spacing density between fields inside the section */
  fieldGap?: "default" | "tight";
}

/**
 * Accessible grouping wrapper for dense forms (`section` + optional heading/description).
 *
 * Intended migration: large page forms and wizard steps.
 *
 * Anti-patterns avoided: rendering labels/inputs internally — callers use `Input`/`Select`.
 */
export const FormSection = React.forwardRef<HTMLElement, FormSectionProps>(
  function FormSection(
    { title, description, children, className, fieldGap = "default", ...rest },
    ref,
  ) {
    const titleIdSeed = React.useId();
    const ariaLabelledBy =
      title !== undefined ? `form-section-title-${titleIdSeed.replace(/:/g, "")}` : undefined;

    return (
      <section
        ref={ref}
        aria-labelledby={ariaLabelledBy}
        className={cx("min-w-0 space-y-3", className)}
        {...rest}
      >
        {title !== undefined ? (
          <header className="space-y-1">
            <h3
              id={ariaLabelledBy}
              className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {title}
            </h3>
            {description !== undefined ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
            ) : null}
          </header>
        ) : description !== undefined ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
        ) : null}

        <div className={cx(fieldGap === "tight" ? "space-y-3" : "space-y-4")}>{children}</div>
      </section>
    );
  },
);

FormSection.displayName = "FormSection";
