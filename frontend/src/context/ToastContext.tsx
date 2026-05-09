"use client";

import React, { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
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
    (type: ToastType, message: string) => {
      const id = String(++counter.current);
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  const toast = {
    success: (message: string) => add("success", message),
    error: (message: string) => add("error", message),
    warning: (message: string) => add("warning", message),
    info: (message: string) => add("info", message),
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
