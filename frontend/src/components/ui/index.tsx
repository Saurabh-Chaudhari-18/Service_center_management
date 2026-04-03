"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertCircle, Check, X, Info } from "lucide-react";
import { JOB_STATUS_CONFIG, INVOICE_STATUS_CONFIG } from "@/types";
import type { JobStatus, InvoiceStatus } from "@/types";

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

  return (
    <button
      className={`btn btn-${variant} ${sizeClasses[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : leftIcon}
      {children}
      {rightIcon && !isLoading && rightIcon}
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
          <label className="block text-sm font-semibold text-neutral-700">
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
        {helperText && !error && <p className="text-xs text-neutral-500">{helperText}</p>}
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
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm font-semibold text-neutral-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <select ref={ref} className={`input ${error ? "input-error" : ""} ${className}`} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
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
          <label className="block text-sm font-semibold text-neutral-700">
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
}

export function Badge({ children, variant = "default", size = "md" }: BadgeProps) {
  const variantClasses = {
    default: "bg-neutral-100 text-neutral-600",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    danger:  "bg-red-100 text-red-700",
    info:    "bg-blue-100 text-blue-700",
  };
  const sizeClasses = { sm: "px-2 py-0.5 text-[10px]", md: "px-3 py-0.5 text-xs" };

  return (
    <span className={`badge ${variantClasses[variant]} ${sizeClasses[size]}`}>{children}</span>
  );
}

// =====================================================
// Job Status Badge
// =====================================================

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const config = JOB_STATUS_CONFIG[status];
  return (
    <span className="badge" style={{ backgroundColor: config.bgColor, color: config.textColor }}>
      {config.label}
    </span>
  );
}

// =====================================================
// Invoice Status Badge
// =====================================================

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config = INVOICE_STATUS_CONFIG[status];
  return (
    <span className="badge" style={{ backgroundColor: config.bgColor, color: config.color }}>
      {config.label}
    </span>
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
          <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 p-1.5 rounded-lg hover:bg-black/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Modal Component
// =====================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = "md", footer }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal-content ${sizeClasses[size]} w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100/80">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-neutral-100/80 transition-colors text-neutral-500 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-neutral-100/80 flex justify-end gap-3">{footer}</div>
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
      <p className="text-neutral-600 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}
