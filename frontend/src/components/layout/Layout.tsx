"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
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
  UserPlus,
  Truck,
  Sun,
  Moon,
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
  { name: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard, permission: "canViewDashboard" },
  { name: "Organizations", href: "/organizations", icon: Building2,       roles: ["SUPER_ADMIN"] },
  { name: "Job Cards",     href: "/jobs",          icon: FileText,        permission: "canViewJobCards" },
  { name: "My Jobs",       href: "/my-jobs",       icon: Wrench,          roles: ["TECHNICIAN"] },
  { name: "Customers",     href: "/customers",     icon: Users,           roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
  { name: "Inventory",     href: "/inventory",     icon: Package,         permission: "canViewInventory" },
  { name: "Billing",       href: "/billing",       icon: Receipt,         permission: "canViewBilling" },
  { name: "Reports",       href: "/reports",       icon: BarChart3,       permission: "canViewReports" },
  { name: "Branches",      href: "/branches",      icon: Building2,       permission: "canManageBranches" },
  { name: "Staff",         href: "/users",         icon: UserPlus,        permission: "canManageUsers" },
  { name: "Pickup & Drop", href: "/pickups",       icon: Truck,           permission: "canViewPickups" },
  { name: "Settings",      href: "/settings",      icon: Settings,        roles: ["SUPER_ADMIN", "OWNER", "MANAGER"] },
];

// =====================================================
// Sidebar Component
// =====================================================

export function Sidebar() {
  const pathname = usePathname();
  const { user, currentBranch, accessibleBranches, switchBranch, logout, hasPermission, isRole } = useAuth();
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false);

  const visibleNavItems = navigationItems.filter((item) => {
    if (item.permission) return hasPermission(item.permission);
    if (item.roles)      return isRole(...item.roles);
    return true;
  });

  const handleBranchSwitch = async (branchId: string) => {
    try {
      await switchBranch(branchId);
      setBranchMenuOpen(false);
      window.location.reload();
    } catch (error) {
      console.error("Failed to switch branch:", error);
    }
  };

  if (!user) return null;

  return (
    <aside className="sidebar flex flex-col">
      {/* Logo */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center gradient-accent shadow-lg">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide">ServiceHub</h1>
            <p className="text-xs text-violet-300/70">Management System</p>
          </div>
        </div>
      </div>

      {/* Branch Selector */}
      {accessibleBranches.length > 1 && (
        <div className="px-3 pb-3">
          <div className="relative">
            <button
              onClick={() => setBranchMenuOpen(!branchMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div className="text-left">
                <p className="text-[10px] text-violet-300/60 uppercase tracking-widest font-medium">Branch</p>
                <p className="text-sm font-semibold text-white truncate">{currentBranch?.name || "Select Branch"}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-violet-300/60 transition-transform ${branchMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {branchMenuOpen && (
              <div className="absolute left-0 right-0 mt-2 py-1 rounded-xl shadow-2xl z-50 border border-white/10 overflow-hidden"
                   style={{ background: "rgba(30,24,80,0.98)", backdropFilter: "blur(16px)" }}>
                {accessibleBranches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSwitch(branch.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-violet-200 hover:text-white transition-colors"
                    style={{ background: branch.id === currentBranch?.id ? "rgba(255,255,255,0.08)" : "transparent" }}
                  >
                    <span>{branch.name}</span>
                    {branch.id === currentBranch?.id && <Check className="w-3.5 h-3.5 text-violet-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href} className={`sidebar-item ${isActive ? "active" : ""}`}>
              <Icon className="w-4.5 h-4.5 shrink-0" style={{ width: "1.1rem", height: "1.1rem" }} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
               style={{ background: "linear-gradient(135deg, #818cf8, #a78bfa)" }}>
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user.first_name} {user.last_name}</p>
            <p className="text-xs text-violet-300/60 capitalize">{user.role?.toLowerCase().replace("_", " ")}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-violet-300/60 hover:text-red-300 hover:bg-red-500/10 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
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
  const { currentBranch, organizationBranding } = useAuth();
  const [notificationCount] = React.useState(0);

  return (
    <header className="min-h-[4.5rem] py-3 px-6 flex flex-wrap items-center justify-between gap-y-3"
            style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(226,232,240,0.5)" }}>
      <div>
        {organizationBranding?.name && organizationBranding.name !== "ServiceHub" ? (
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 bg-clip-text text-transparent">
            {title}
          </h1>
        ) : (
          <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">{title}</h1>
        )}
        {subtitle && <p className="text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {actions}

        {/* Dark Mode Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-neutral-200/60 dark:hover:border-white/10">
          <Bell className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* Branch Badge */}
        {currentBranch && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-500/30"
               style={{ background: "rgba(238,242,255,0.8)" }}>
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{currentBranch.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}

// =====================================================
// Theme Toggle Component
// =====================================================

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 border border-transparent hover:border-neutral-200/60 dark:hover:border-white/10 group"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="w-5 h-5 text-amber-400 transition-transform duration-300 group-hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 text-neutral-500 transition-transform duration-300 group-hover:-rotate-12" />
      )}
    </button>
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
    <div className="min-h-screen" style={{ background: "transparent" }}>
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}
