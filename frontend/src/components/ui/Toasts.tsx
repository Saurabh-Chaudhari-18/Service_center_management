"use client";

import { useToast, type ToastItem } from "@/context/ToastContext";

const TYPE_STYLES: Record<ToastItem["type"], { bar: string; icon: string }> = {
  success: { bar: "bg-green-500", icon: "✓" },
  error:   { bar: "bg-red-500",   icon: "✕" },
  warning: { bar: "bg-amber-500", icon: "⚠" },
  info:    { bar: "bg-blue-500",  icon: "ℹ" },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { bar, icon } = TYPE_STYLES[toast.type];
  return (
    <div className="flex min-w-[280px] max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
      <div className={`w-1.5 flex-shrink-0 ${bar}`} />
      <div className="flex flex-1 items-start gap-3 px-4 py-3">
        <span className={`mt-0.5 text-sm font-bold ${bar.replace("bg-", "text-")}`}>
          {icon}
        </span>
        <p className="flex-1 text-sm text-gray-800 dark:text-gray-100">{toast.message}</p>
        <button
          onClick={onDismiss}
          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}
