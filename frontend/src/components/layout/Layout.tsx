"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Receipt,
  BarChart3,
  Settings,
  Building2,
  Wrench,
  Bell,
  LogOut,
  ChevronDown,
  Check,
} from "lucide-react";
import type { UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/types";

// =====================================================
// Navigation Items Configuration
// =====================================================

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  permission?: keyof (typeof ROLE_PERMISSIONS)[UserRole];
  roles?: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: "canViewDashboard",
  },
  {
    name: "Job Cards",
    href: "/jobs",
    icon: FileText,
    permission: "canViewJobCards",
  },
  {
    name: "My Jobs",
    href: "/my-jobs",
    icon: Wrench,
    roles: ["TECHNICIAN"],
  },
  {
    name: "Customers",
    href: "/customers",
    icon: Users,
    roles: ["OWNER", "MANAGER", "RECEPTIONIST"],
  },
  {
    name: "Inventory",
    href: "/inventory",
    icon: Package,
    permission: "canViewInventory",
  },
  {
    name: "Billing",
    href: "/billing",
    icon: Receipt,
    permission: "canViewBilling",
  },
  {
    name: "Reports",
    href: "/reports",
    icon: BarChart3,
    permission: "canViewReports",
  },
  {
    name: "Branches",
    href: "/branches",
    icon: Building2,
    permission: "canManageBranches",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["OWNER", "MANAGER"],
  },
];

// =====================================================
// Sidebar Component
// =====================================================

export function Sidebar() {
  const pathname = usePathname();
  const {
    user,
    currentBranch,
    accessibleBranches,
    switchBranch,
    logout,
    hasPermission,
    isRole,
  } = useAuth();
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false);

  // Filter navigation items based on permissions
  const visibleNavItems = navigationItems.filter((item) => {
    if (item.permission) {
      return hasPermission(item.permission);
    }
    if (item.roles) {
      return isRole(...item.roles);
    }
    return true;
  });

  const handleBranchSwitch = async (branchId: string) => {
    try {
      await switchBranch(branchId);
      setBranchMenuOpen(false);
      // Reload page to refresh data for new branch
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch branch:", error);
    }
  };

  if (!user) return null;

  return (
    <aside className="sidebar gradient-sidebar flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">ServiceHub</h1>
            <p className="text-xs text-neutral-400">Management System</p>
          </div>
        </div>
      </div>

      {/* Branch Selector */}
      {accessibleBranches.length > 1 && (
        <div className="px-4 py-3 border-b border-white/10">
          <div className="relative">
            <button
              onClick={() => setBranchMenuOpen(!branchMenuOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="text-left">
                <p className="text-xs text-neutral-400">Current Branch</p>
                <p className="text-sm font-medium text-white truncate">
                  {currentBranch?.name || "Select Branch"}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  branchMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {branchMenuOpen && (
              <div className="absolute left-0 right-0 mt-2 py-1 bg-neutral-800 rounded-lg shadow-xl border border-white/10 z-50">
                {accessibleBranches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSwitch(branch.id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-neutral-300 hover:bg-white/10 hover:text-white"
                  >
                    <span>{branch.name}</span>
                    {branch.id === currentBranch?.id && (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`sidebar-item ${isActive ? "active" : ""}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-sm">
            {user.first_name?.[0]}
            {user.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-xs text-neutral-400 capitalize">
              {user.role?.toLowerCase().replace("_", " ")}
            </p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-white/5 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

// =====================================================
// Header Component
// =====================================================

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const { user, currentBranch } = useAuth();
  const [notificationCount, setNotificationCount] = React.useState(0);

  return (
    <header className="h-16 bg-white border-b border-neutral-100 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {actions}

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-neutral-100 transition-colors">
          <Bell className="w-5 h-5 text-neutral-600" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Current Branch Badge */}
        {currentBranch && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-full">
            <Building2 className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-medium text-primary-700">
              {currentBranch.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

// =====================================================
// Main Layout Component
// =====================================================

interface LayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
