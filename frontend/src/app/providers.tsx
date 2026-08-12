"use client";

import React from "react";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { ToastContainer } from "@/components/ui/Toasts";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { tenantQueryKeyHash } from "@/lib/queryPolicy";
import { isPublicPath } from "@/lib/routePolicy";
import type { AuthUser } from "@/types";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
      // Tenant scope is part of every cache identity, including legacy query
      // keys that do not explicitly contain a branch id.
      queryKeyHashFn: tenantQueryKeyHash,
    },
  },
});

interface ProvidersProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}

export function AuthenticatedAppGate({ children }: ProvidersProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const isPublic = isPublicPath(pathname);

  useEffect(() => {
    if (!isPublic && !isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isLoading, isPublic, pathname, router]);

  if (!isPublic && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner" aria-label="Checking session" />
      </div>
    );
  }
  return <>{children}</>;
}

export function Providers({ children, initialUser = null }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={initialUser}>
          <AuthenticatedAppGate>
            <ToastProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <ToastContainer />
            </ToastProvider>
          </AuthenticatedAppGate>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
