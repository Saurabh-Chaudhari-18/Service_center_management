"use client";

import React, { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertCircle, Check, X, Info, ChevronDown } from "lucide-react";
import type { JobStatus, InvoiceStatus, PickupRequestStatus } from "@/types";
import {
  getJobStatusPresentation,
  getInvoiceStatusPresentation,
  getPickupStatusPresentation,
  SemanticStatusBadge,
} from "@/platform/semantics";

// =====================================================
// Button Component
// =====================================================

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  isLoading,
  leftIcon,
  rightIcon,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs min-h-[2.25rem]",
    md: "px-4 py-2.5 text-sm min-h-[2.75rem]",
    lg: "px-6 py-3 text-base min-h-[3rem]",
  };

  const showLeading = isLoading || leftIcon != null;

  return (
    <button
      className={`btn btn-${variant} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {showLeading ? (
        <span className="inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
          {isLoading ? <Loader2 className="animate-spin" aria-hidden /> : leftIcon}
        </span>
      ) : null}
      {children}
      {rightIcon && !isLoading ? (
        <span className="inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
}

// =====================================================
// Input Component
// =====================================================

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || `input-${generatedId}`;
    const messageId = `${inputId}-message`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error || helperText ? messageId : undefined}
            className={`input ${leftIcon ? "pl-10" : ""} ${rightIcon ? "pr-10" : ""} ${error ? "input-error" : ""} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">{rightIcon}</div>
          )}
        </div>
        {error && (
          <p id={messageId} role="alert" className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />{error}
          </p>
        )}
        {helperText && !error && (
          <p id={messageId} className="text-xs text-neutral-500 dark:text-neutral-400">{helperText}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

// =====================================================
// Select Component
// =====================================================

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || `select-${generatedId}`;
    const errorId = `${selectId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`input appearance-none pr-10 ${error ? "input-error" : ""} ${className}`}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />{error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

// =====================================================
// Textarea Component
// =====================================================

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || `textarea-${generatedId}`;
    const errorId = `${textareaId}-error`;

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`input min-h-[100px] resize-y ${error ? "input-error" : ""} ${className}`}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />{error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// =====================================================
// Checkbox & Switch Components
// =====================================================

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  containerClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, containerClassName = "", className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const checkboxId = id || `checkbox-${generatedId}`;
    const descriptionId = description ? `${checkboxId}-description` : undefined;

    return (
      <label
        htmlFor={checkboxId}
        className={`flex cursor-pointer items-start gap-3 text-sm text-neutral-700 dark:text-neutral-200 ${containerClassName}`.trim()}
      >
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          aria-describedby={descriptionId}
          className={`checkbox mt-0.5 ${className}`.trim()}
          {...props}
        />
        <span className="min-w-0">
          <span className="font-medium">{label}</span>
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </span>
          ) : null}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

interface RadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  containerClassName?: string;
}

export const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ label, containerClassName = "", className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const radioId = id || `radio-${generatedId}`;

    return (
      <label
        htmlFor={radioId}
        className={`flex cursor-pointer items-start gap-3 text-sm text-neutral-700 dark:text-neutral-200 ${containerClassName}`.trim()}
      >
        <input
          ref={ref}
          id={radioId}
          type="radio"
          className={`radio mt-0.5 ${className}`.trim()}
          {...props}
        />
        <span className="min-w-0 flex-1">{label}</span>
      </label>
    );
  },
);
Radio.displayName = "Radio";

interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
  containerClassName?: string;
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, containerClassName = "", className = "", id, ...props }, ref) => {
    const generatedId = useId();
    const switchId = id || `switch-${generatedId}`;
    const descriptionId = description ? `${switchId}-description` : undefined;

    return (
      <label
        htmlFor={switchId}
        className={`flex cursor-pointer items-center justify-between gap-4 ${containerClassName}`.trim()}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-neutral-800 dark:text-neutral-100">{label}</span>
          {description ? (
            <span id={descriptionId} className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </span>
          ) : null}
        </span>
        <span className="relative shrink-0">
          <input
            ref={ref}
            id={switchId}
            type="checkbox"
            role="switch"
            aria-describedby={descriptionId}
            className={`peer sr-only ${className}`.trim()}
            {...props}
          />
          <span className="switch-track bg-neutral-300 peer-checked:bg-primary-600 dark:bg-slate-700 dark:peer-checked:bg-primary-500">
            <span className="switch-thumb translate-x-0" />
          </span>
        </span>
      </label>
    );
  },
);
Switch.displayName = "Switch";

// =====================================================
// Card Component
// =====================================================

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({ children, className = "", padding = "md" }: CardProps) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-5",
    lg: "p-7",
  };

  return (
    <div className={`card ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

// =====================================================
// CardTitle Component
// =====================================================

interface CardTitleProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function CardTitle({ children, icon, className = "" }: CardTitleProps) {
  return (
    <h3
      className={[
        "text-base font-semibold text-neutral-900 dark:text-neutral-100",
        icon ? "flex items-center gap-2" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {children}
    </h3>
  );
}

// =====================================================
// Stats Card Component  — V3 icon-bubble style
// =====================================================

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  variant?: "primary" | "success" | "warning" | "danger" | "accent";
}

const STATS_ICON_CLASSES: Record<string, string> = {
  primary: "stats-icon-primary",
  success: "stats-icon-success",
  warning: "stats-icon-warning",
  danger:  "stats-icon-danger",
  accent:  "stats-icon-accent",
};

export function StatsCard({ label, value, icon, trend, variant = "primary" }: StatsCardProps) {
  const iconClass = STATS_ICON_CLASSES[variant] ?? STATS_ICON_CLASSES.primary;

  return (
    <div className="stats-card">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-500 truncate">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-neutral-900 tracking-tight">{value}</p>
          {trend && (
            <p className={`mt-1 text-xs font-semibold ${trend.isPositive ? "text-green-600" : "text-red-500"}`}>
              {trend.isPositive ? "▲" : "▼"} {Math.abs(trend.value)}%
              <span className="text-neutral-400 font-normal ml-1">vs last period</span>
            </p>
          )}
        </div>
        {icon && (
          <div className={`p-3 rounded-2xl shrink-0 ml-3 flex items-center justify-center ${iconClass}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Badge Component
// =====================================================

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps) {
  const variantClasses = {
    default: "bg-neutral-100 text-neutral-600",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger:  "bg-red-100 text-red-700",
    info:    "bg-blue-100 text-blue-700",
  };
  const sizeClasses = { sm: "px-2 py-0.5 text-[10px]", md: "px-3 py-0.5 text-xs" };

  return (
    <span
      className={`badge ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

// =====================================================
// Job Status Badge
// =====================================================

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <SemanticStatusBadge presentation={getJobStatusPresentation(status)} size="md" />
  );
}

// =====================================================
// Invoice Status Badge
// =====================================================

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <SemanticStatusBadge
      presentation={getInvoiceStatusPresentation(status)}
      size="md"
    />
  );
}

export function PickupStatusBadge({
  status,
  size = "sm",
}: {
  status: PickupRequestStatus;
  size?: "sm" | "md";
}) {
  return (
    <SemanticStatusBadge
      presentation={getPickupStatusPresentation(status)}
      size={size}
    />
  );
}

// =====================================================
// Empty State Component
// =====================================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// =====================================================
// Loading Spinner
// =====================================================

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return <div className={`spinner ${sizeClasses[size]}`} />;
}

export function LoadingState({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{message}</p>
    </div>
  );
}

// =====================================================
// Alert Component
// =====================================================

interface AlertProps {
  variant: "info" | "success" | "warning" | "error";
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Alert({ variant, title, children, onClose, className = "" }: AlertProps) {
  const variantConfig = {
    info:    { bg: "bg-blue-50/80",  border: "border-blue-200/60", icon: <Info className="w-5 h-5 text-blue-500" />,         titleColor: "text-blue-800",  textColor: "text-blue-700" },
    success: { bg: "bg-green-50/80", border: "border-green-200/60", icon: <Check className="w-5 h-5 text-green-500" />,      titleColor: "text-green-800", textColor: "text-green-700" },
    warning: { bg: "bg-amber-50/80", border: "border-amber-200/60", icon: <AlertCircle className="w-5 h-5 text-amber-500" />, titleColor: "text-amber-800", textColor: "text-amber-700" },
    error:   { bg: "bg-red-50/80",   border: "border-red-200/60",   icon: <AlertCircle className="w-5 h-5 text-red-500" />,   titleColor: "text-red-800",   textColor: "text-red-700" },
  };
  const config = variantConfig[variant];

  return (
    <div className={`${config.bg} ${config.border} border rounded-xl p-4 backdrop-blur-sm ${className}`}>
      <div className="flex">
        <div className="shrink-0">{config.icon}</div>
        <div className="ml-3 flex-1">
          {title && <h3 className={`text-sm font-semibold ${config.titleColor}`}>{title}</h3>}
          <div className={`text-sm ${config.textColor} ${title ? "mt-1" : ""}`}>{children}</div>
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Dismiss alert"
            onClick={onClose}
            className="ml-auto shrink-0 !p-1.5"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Modal Component
// Governance: body scroll lock + Escape while open; labelled `role="dialog"`; footer stacks on small viewports.
// =====================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = "md", footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const prevOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable || dialogRef.current)?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (!focusable.length) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, mounted]);

  if (!isOpen || !mounted) return null;

  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl", "3xl": "max-w-3xl", "4xl": "max-w-4xl" };

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`modal-content ${sizeClasses[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100/80 px-6 py-4 dark:border-slate-800/80">
          <h2 id={titleId} className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {title}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close dialog"
            onClick={onClose}
            className="shrink-0 !p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="max-h-[min(85vh,calc(100dvh-10rem))] overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex min-w-0 flex-col gap-3 border-t border-neutral-100/80 px-6 py-4 dark:border-slate-800/80 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// =====================================================
// Confirm Dialog Component
// =====================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen, onClose, onConfirm, title, message,
  confirmText = "Confirm", cancelText = "Cancel",
  variant = "primary", isLoading,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>{cancelText}</Button>
          <Button variant={variant === "danger" ? "danger" : "primary"} onClick={onConfirm} isLoading={isLoading}>{confirmText}</Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">{message}</p>
    </Modal>
  );
}

export * from "./LiveTrackingMap";
