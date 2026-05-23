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
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
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
  ({ label, error, helperText, leftIcon, rightIcon, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">{leftIcon}</div>
          )}
          <input
            ref={ref}
            className={`input ${leftIcon ? "pl-10" : ""} ${rightIcon ? "pr-10" : ""} ${error ? "input-error" : ""} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400">{rightIcon}</div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" />{error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{helperText}</p>
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
  ({ label, error, options, placeholder, className = "", ...props }, ref) => {
    const internalRef = React.useRef<HTMLSelectElement | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

    // Track local value for immediate UI update
    const [localValue, setLocalValue] = useState(props.value || props.defaultValue || "");

    useEffect(() => { setMounted(true); }, []);

    // Manage refs for react-hook-form compatibility
    const handleRef = React.useCallback((node: HTMLSelectElement | null) => {
      internalRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLSelectElement | null>).current = node;
      if (node && node.value) setLocalValue(node.value);
    }, [ref]);

    // Resync when controlled value changes
    useEffect(() => {
      if (props.value !== undefined) setLocalValue(props.value as string);
    }, [props.value]);

    // Poll for react-hook-form async resets
    useEffect(() => {
      const interval = setInterval(() => {
        if (internalRef.current && internalRef.current.value !== localValue && props.value === undefined) {
          setLocalValue(internalRef.current.value);
        }
      }, 500);
      return () => clearInterval(interval);
    }, [localValue, props.value]);

    // Calculate position and open
    const openDropdown = () => {
      if (props.disabled) return;
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const maxDropH = 280;
        // If not enough space below, open upward
        if (spaceBelow < maxDropH && rect.top > spaceBelow) {
          setDropdownPos({ top: rect.top - Math.min(maxDropH, rect.top - 8), left: rect.left, width: Math.max(rect.width, 200) });
        } else {
          setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 200) });
        }
      }
      setIsOpen(prev => !prev);
    };

    // Close on click outside
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (
          triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    // Close on outside scroll (but NOT when scrolling inside dropdown) + resize
    useEffect(() => {
      if (!isOpen) return;

      const handleScroll = (e: Event) => {
        // If the scroll is happening inside the dropdown panel, ignore it
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
          return;
        }
        setIsOpen(false);
      };

      const handleResize = () => setIsOpen(false);

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }, [isOpen]);

    const handleSelect = (val: string) => {
      setLocalValue(val);
      setIsOpen(false);
      if (internalRef.current) {
        internalRef.current.value = val;
        internalRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (props.onChange) {
        props.onChange({ target: { name: props.name, value: val }, currentTarget: { name: props.name, value: val } } as any);
      }
    };

    const selectedOption = options.find((o) => String(o.value) === String(localValue));
    const displayLabel = selectedOption ? selectedOption.label : (placeholder || "Select…");

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* Hidden native select for form integration */}
        <select
          ref={handleRef}
          className="hidden"
          {...props}
          value={localValue}
          onChange={(e) => { setLocalValue(e.target.value); props.onChange?.(e); }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {/* Custom trigger button */}
        <button
          ref={triggerRef}
          type="button"
          className={`w-full flex items-center justify-between text-left input cursor-pointer ${error ? "input-error" : ""} ${className}`}
          onClick={openDropdown}
          disabled={props.disabled}
        >
          <span
            className={`block truncate ${
              !selectedOption && placeholder
                ? "text-neutral-400 dark:text-neutral-500"
                : "font-medium text-neutral-900 dark:text-neutral-100"
            }`}
          >
            {displayLabel}
          </span>
          <ChevronDown
            className={`ml-2 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 dark:text-neutral-500 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Portal-based dropdown */}
        {isOpen && mounted && createPortal(
          <div
            ref={dropdownRef}
            className="fixed max-h-[280px] overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: "var(--z-dropdown)",
            }}
          >
            <div className="space-y-0.5 p-1.5">
              {placeholder && (
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-50 dark:text-neutral-500 dark:hover:bg-slate-800"
                  onClick={() => handleSelect("")}
                >
                  {placeholder}
                </button>
              )}
              {options.map((opt) => {
                const isSelected = String(localValue) === String(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-primary-50 font-bold text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
                        : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-slate-800"
                    }`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary-500 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}

        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" />{error}
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
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          className={`input min-h-[100px] resize-y ${error ? "input-error" : ""} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
            <AlertCircle className="w-3 h-3" />{error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

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
// Stats Card Component  — V3 icon-bubble style
// =====================================================

interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  variant?: "primary" | "success" | "warning" | "danger" | "accent";
}

const STATS_ICON_STYLES: Record<string, { background: string; color: string }> = {
  primary: { background: "#ede9fe", color: "#4f46e5" },
  success: { background: "#dcfce7", color: "#16a34a" },
  warning: { background: "#fef3c7", color: "#d97706" },
  danger:  { background: "#fee2e2", color: "#dc2626" },
  accent:  { background: "#dbeafe", color: "#2563eb" },
};

export function StatsCard({ label, value, icon, trend, variant = "primary" }: StatsCardProps) {
  const iconStyle = STATS_ICON_STYLES[variant] ?? STATS_ICON_STYLES.primary;

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
          <div
            className="p-3 rounded-2xl shrink-0 ml-3 flex items-center justify-center"
            style={{ background: iconStyle.background, color: iconStyle.color }}
          >
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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
             style={{ background: "linear-gradient(135deg, #ede9fe, #e0e7ff)" }}>
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-neutral-800">{title}</h3>
      {description && <p className="mt-2 text-sm text-neutral-500 max-w-sm">{description}</p>}
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

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-neutral-500 font-medium">Loading…</p>
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
  size?: "sm" | "md" | "lg" | "xl" | "4xl";
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = "md", footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, mounted, onClose]);

  if (!isOpen || !mounted) return null;

  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl", "4xl": "max-w-4xl" };

  return createPortal(
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
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
