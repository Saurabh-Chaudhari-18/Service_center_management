"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
}

interface ToastContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  toast: {
    success: (message: string, action?: ToastAction) => void;
    error: (message: string, action?: ToastAction) => void;
    warning: (message: string, action?: ToastAction) => void;
    info: (message: string, action?: ToastAction) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string, action?: ToastAction) => {
      const id = String(++counter.current);
      setToasts((prev) => [...prev, { id, type, message, action }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const toast = {
    success: (message: string, action?: ToastAction) => add("success", message, action),
    error: (message: string, action?: ToastAction) => add("error", message, action),
    warning: (message: string, action?: ToastAction) => add("warning", message, action),
    info: (message: string, action?: ToastAction) => add("info", message, action),
  };

  return (
    <ToastContext.Provider value={{ toasts, dismiss, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
