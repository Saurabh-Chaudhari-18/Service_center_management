"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { tokenManager } from "@/lib/api/client";
import { authApi } from "@/lib/api/services";
import type { AuthUser, Branch, UserRole, ROLE_PERMISSIONS } from "@/types";
import { ROLE_PERMISSIONS as permissions } from "@/types";

// =====================================================
// Auth Context Types
// =====================================================

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  currentBranch: Branch | null;
  accessibleBranches: Branch[];
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchBranch: (branchId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: keyof (typeof permissions)[UserRole]) => boolean;
  isRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =====================================================
// Auth Provider Component
// =====================================================

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    currentBranch: null,
    accessibleBranches: [],
  });

  // Initialize auth state from stored tokens
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const token = tokenManager.getAccessToken();

      if (!token) {
        if (isMounted) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
        return;
      }

      try {
        // Fetch current user
        const user = await authApi.getMe();
        const branches = await authApi.getMyBranches();

        // Determine current branch
        const storedBranchId = tokenManager.getCurrentBranchId();
        let currentBranch =
          branches.find((b) => b.id === storedBranchId) || null;

        // If no stored branch or invalid, use first accessible branch
        if (!currentBranch && branches.length > 0) {
          currentBranch = branches[0];
          tokenManager.setCurrentBranchId(branches[0].id);
        }

        if (isMounted) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
            currentBranch,
            accessibleBranches: branches,
          });
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        tokenManager.clearTokens();
        if (isMounted) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
            currentBranch: null,
            accessibleBranches: [],
          });
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const tokens = await authApi.login(email, password);
      tokenManager.setTokens(tokens.access, tokens.refresh);

      const user = await authApi.getMe();
      const branches = await authApi.getMyBranches();

      // Set first branch as current
      let currentBranch: Branch | null = null;
      if (branches.length > 0) {
        currentBranch = branches[0];
        tokenManager.setCurrentBranchId(branches[0].id);
      }

      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        currentBranch,
        accessibleBranches: branches,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    tokenManager.clearTokens();
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      currentBranch: null,
      accessibleBranches: [],
    });
  }, []);

  // Switch branch
  const switchBranch = useCallback(
    async (branchId: string) => {
      const branch = state.accessibleBranches.find((b) => b.id === branchId);

      if (!branch) {
        throw new Error("Branch not accessible");
      }

      try {
        await authApi.setCurrentBranch(branchId);
        tokenManager.setCurrentBranchId(branchId);
        setState((prev) => ({ ...prev, currentBranch: branch }));
      } catch (error) {
        console.error("Failed to switch branch:", error);
        throw error;
      }
    },
    [state.accessibleBranches]
  );

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await authApi.getMe();
      const branches = await authApi.getMyBranches();

      setState((prev) => ({
        ...prev,
        user,
        accessibleBranches: branches,
      }));
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [state.isAuthenticated]);

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permission: keyof (typeof permissions)[UserRole]): boolean => {
      if (!state.user) return false;
      const rolePerms = permissions[state.user.role];
      return rolePerms ? rolePerms[permission] : false;
    },
    [state.user]
  );

  // Check if user has one of the specified roles
  const isRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user]
  );

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    switchBranch,
    refreshUser,
    hasPermission,
    isRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// =====================================================
// Custom Hook
// =====================================================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

// =====================================================
// HOC for Protected Routes
// =====================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  requiredPermission?: keyof (typeof permissions)[UserRole];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasPermission, isRole } = useAuth();
  const [shouldRedirect, setShouldRedirect] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      setShouldRedirect(true);
    }
  }, [isLoading, isAuthenticated, user]);

  React.useEffect(() => {
    if (shouldRedirect && typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, [shouldRedirect]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // Check role access
  if (requiredRoles && !isRole(...requiredRoles)) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900">
              Access Denied
            </h1>
            <p className="mt-2 text-neutral-600">
              You do not have permission to access this page.
            </p>
          </div>
        </div>
      )
    );
  }

  // Check permission access
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900">
              Access Denied
            </h1>
            <p className="mt-2 text-neutral-600">
              You do not have permission to access this page.
            </p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
