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
import type {
  AuthUser,
  Branch,
  UserRole,
  UserPermissions,
  OrganizationBranding,
} from "@/types";
import { ROLE_PERMISSIONS as fallbackPermissions } from "@/types";
import { organizationsApi } from "@/lib/api/services";

// =====================================================
// Auth Context Types
// =====================================================

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  currentBranch: Branch | null;
  accessibleBranches: Branch[];
  organizationBranding: OrganizationBranding | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchBranch: (branchId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: keyof UserPermissions) => boolean;
  isRole: (...roles: UserRole[]) => boolean;
  /** True if the current branch has GST enabled (default: true if no branch set) */
  gstEnabled: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// =====================================================
// Auth Provider Component
// =====================================================

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
}) {
  const [state, setState] = useState<AuthState>({
    user: initialUser,
    isLoading: !initialUser,
    isAuthenticated: Boolean(initialUser),
    currentBranch: initialUser?.current_branch ?? null,
    accessibleBranches: initialUser?.accessible_branches ?? [],
    organizationBranding: null,
  });

  // Restore the signed HTTP-only cookie session without exposing tokens to JS.
  useEffect(() => {
    if (initialUser) {
      return;
    }
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        await authApi.refreshToken();
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

        // Fetch branding data for current user's organization
        let branding: OrganizationBranding | null = null;
        try {
          branding = await organizationsApi.getBranding();
        } catch {
          // Fallback branding if endpoint fails
          branding = {
            name: "ServiceHub",
            tagline: "Management System",
            logo: null,
            primary_color: "#6366f1",
            favicon: null,
          };
        }

        if (isMounted) {
          setState({
            user,
            isLoading: false,
            isAuthenticated: true,
            currentBranch,
            accessibleBranches: branches,
            organizationBranding: branding,
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
            organizationBranding: null,
          });
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [initialUser]);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      await authApi.login(email, password);

      const user = await authApi.getMe();
      const branches = await authApi.getMyBranches();

      // Set first branch as current
      let currentBranch: Branch | null = null;
      if (branches.length > 0) {
        currentBranch = branches[0];
        tokenManager.setCurrentBranchId(branches[0].id);
      }

      // Fetch branding data
      let branding: OrganizationBranding | null = null;
      try {
        branding = await organizationsApi.getBranding();
      } catch {
        branding = {
          name: "ServiceHub",
          tagline: "Management System",
          logo: null,
          primary_color: "#6366f1",
          favicon: null,
        };
      }

      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        currentBranch,
        accessibleBranches: branches,
        organizationBranding: branding,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    authApi.logout().catch(() => {
      /* still clear local session if API is unreachable */
    });
    tokenManager.clearTokens();
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      currentBranch: null,
      accessibleBranches: [],
      organizationBranding: null,
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
    [state.accessibleBranches],
  );

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!state.isAuthenticated) return;

    try {
      const user = await authApi.getMe();
      const branches = await authApi.getMyBranches();

      let branding: OrganizationBranding | null = null;
      try {
        branding = await organizationsApi.getBranding();
      } catch {
        branding = state.organizationBranding;
      }

      setState((prev) => ({
        ...prev,
        user,
        accessibleBranches: branches,
        organizationBranding: branding,
      }));
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  }, [state.isAuthenticated, state.organizationBranding]);

  // Check if user has a specific permission
  const hasPermission = useCallback(
    (permission: keyof UserPermissions): boolean => {
      if (!state.user) return false;
      // Prefer DB-driven permissions from API response
      if (state.user.permissions) {
        return state.user.permissions[permission] ?? false;
      }
      // Fallback to static map if API didn't return permissions
      const rolePerms = fallbackPermissions[state.user.role];
      return rolePerms ? rolePerms[permission] : false;
    },
    [state.user],
  );

  // Check if user has one of the specified roles
  const isRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!state.user) return false;
      return roles.includes(state.user.role);
    },
    [state.user],
  );

  const value: AuthContextValue = {
    ...state,
    login,
    logout,
    switchBranch,
    refreshUser,
    hasPermission,
    isRole,
    gstEnabled: state.currentBranch?.gst_enabled ?? true,
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
  requiredPermission?: keyof UserPermissions;
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
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto" />
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 font-medium">Redirecting to login…</p>
        </div>
      </div>
    );
  }

  // Check role access
  if (requiredRoles && !isRole(...requiredRoles)) {
    return (
      fallback || (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Access Denied
            </h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              You do not have permission to access this page.
            </p>
            <a
              href="/dashboard"
              className="inline-flex mt-5 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white"
            >
              Go to Dashboard
            </a>
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
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              Access Denied
            </h1>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              You do not have permission to access this page.
            </p>
            <a
              href="/dashboard"
              className="inline-flex mt-5 items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
