"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { notificationsApi } from "@/lib/api";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  ShoppingCart,
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
  Menu,
  X,
  Search,
  IndianRupee,
  UserSearch,
  Contact,
  BookOpen,
  BadgePercent,
} from "lucide-react";
import type { UserRole } from "@/types";
import { ROLE_PERMISSIONS } from "@/types";
import { CommandPalette } from "../CommandPalette";
import { TechnicianLocationTracker } from "./TechnicianLocationTracker";

// =====================================================
// Navigation Items Configuration
// =====================================================

interface NavItem {
  name: string;
  href?: string;
  icon: React.ElementType;
  permission?: keyof (typeof ROLE_PERMISSIONS)[UserRole];
  roles?: UserRole[];
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  { name: "Dashboard",     href: "/dashboard",     icon: LayoutDashboard, permission: "canViewDashboard" },
  { name: "Organizations", href: "/organizations", icon: Building2,       roles: ["SUPER_ADMIN"] },
  { name: "Job Cards",     href: "/jobs",          icon: FileText,        permission: "canViewJobCards" },
  { name: "My Jobs",       href: "/my-jobs",       icon: Wrench,          roles: ["TECHNICIAN"] },
  { name: "Customers",     href: "/customers",     icon: Users,           roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
  { name: "Enquiries",     href: "/enquiries",     icon: UserSearch,      roles: ["OWNER", "MANAGER", "RECEPTIONIST"] },
  { name: "Inventory",     href: "/inventory",     icon: Package,         permission: "canViewInventory" },
  { name: "Suppliers",     href: "/suppliers",     icon: Contact,         roles: ["OWNER", "MANAGER"] },
  {
    name: "Transactions",
    icon: Receipt,
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    children: [
      { name: "New Invoice", href: "/billing/new", icon: Receipt },
      { name: "New Purchase", href: "/purchases/new", icon: ShoppingCart },
      { name: "Record Payment", href: "/payments", icon: IndianRupee },
      { name: "Expenses", href: "/expenses", icon: IndianRupee },
    ],
  },
  {
    name: "Finance Reports",
    icon: BarChart3,
    roles: ["OWNER", "MANAGER", "ACCOUNTANT"],
    children: [
      { name: "Sales Register", href: "/billing", icon: FileText },
      { name: "Purchase Register", href: "/purchases", icon: FileText },
      { name: "Receipts", href: "/receipts", icon: IndianRupee },
      { name: "Ledger", href: "/ledger", icon: BookOpen },
      { name: "GST Dashboard", href: "/gst", icon: BadgePercent },
    ],
  },
  { name: "Business Reports", href: "/reports",    icon: BarChart3,       permission: "canViewReports" },
  { name: "Branches",      href: "/branches",      icon: Building2,       permission: "canManageBranches" },
  { name: "Staff",         href: "/users",         icon: UserPlus,        permission: "canManageUsers" },
  { name: "Pickup & Drop", href: "/pickups",       icon: Truck,           permission: "canViewPickups" },
  { name: "Notifications", href: "/notifications", icon: Bell,            permission: "canManageBranches" },
  { name: "Settings",      href: "/settings",      icon: Settings,        roles: ["SUPER_ADMIN", "OWNER", "MANAGER"] },
];

// =====================================================
// Mobile Sidebar Context – share open/close across layout
// =====================================================

const MobileSidebarContext = React.createContext<{
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}>({ isOpen: false, toggle: () => {}, close: () => {} });

function useMobileSidebar() {
  return React.useContext(MobileSidebarContext);
}

// =====================================================
// Sidebar Component
// =====================================================

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, currentBranch, accessibleBranches, switchBranch, logout, hasPermission, isRole } = useAuth();
  const [branchMenuOpen, setBranchMenuOpen] = React.useState(false);
  const { close: closeMobile } = useMobileSidebar();

  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    for (const item of navigationItems) {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (c) => c.href && (pathname === c.href || pathname?.startsWith(`${c.href}/`)),
        );
        // Keep finance groups expanded by default so sub-pages are discoverable.
        state[item.name] = hasActiveChild || true;
      }
    }
    return state;
  });

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const visibleNavItems = navigationItems.filter((item) => {
    if (item.permission) return hasPermission(item.permission);
    if (item.roles)      return isRole(...item.roles);
    return true;
  });

  const handleBranchSwitch = async (branchId: string) => {
    try {
      await switchBranch(branchId);
      setBranchMenuOpen(false);
      await queryClient.invalidateQueries();
      router.refresh();
    } catch (error) {
      console.error("Failed to switch branch:", error);
      toast.error("Failed to switch branch. Please try again.");
    }
  };

  if (!user) return null;

  return (
    <aside className="sidebar flex flex-col">
      {/* Logo + Mobile Close */}
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center gradient-accent shadow-lg">
              <Wrench className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">ServiceHub</h1>
              <p className="text-xs text-violet-300/70">Management System</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={closeMobile}
            className="lg:hidden flex min-h-11 min-w-11 items-center justify-center rounded-xl text-violet-300/60 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Branch Selector */}
      {accessibleBranches.length > 1 && (
        <div className="px-3 pb-3">
          <div className="relative">
            <button
              onClick={() => setBranchMenuOpen(!branchMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors bg-white/[0.08]"
            >
              <div className="text-left">
                <p className="text-[10px] text-violet-300/60 uppercase tracking-widest font-medium">Branch</p>
                <p className="text-sm font-semibold text-white truncate">{currentBranch?.name || "Select Branch"}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-violet-300/60 transition-transform ${branchMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {branchMenuOpen && (
              <div className="absolute left-0 right-0 mt-2 py-1 rounded-xl shadow-2xl z-50 border border-white/10 overflow-hidden bg-[rgba(30,24,80,0.98)] backdrop-blur-md">
                {accessibleBranches.map((branch) => (
                  <button
                    key={branch.id}
                    onClick={() => handleBranchSwitch(branch.id)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-violet-200 hover:text-white transition-colors ${branch.id === currentBranch?.id ? "bg-white/[0.08]" : "bg-transparent"}`}
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
          const isActive = item.href ? (pathname === item.href || pathname?.startsWith(`${item.href}/`)) : false;
          const Icon = item.icon;
          
          if (item.children) {
            const isExpanded = expandedItems[item.name];
            const hasActiveChild = item.children.some(
              (c) => c.href && (pathname === c.href || pathname?.startsWith(`${c.href}/`)),
            );
            return (
              <div key={item.name} className="space-y-0.5">
                <button
                  onClick={() => toggleExpanded(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
                    isExpanded
                      ? "bg-white/5 text-white"
                      : hasActiveChild
                        ? "text-white bg-white/[0.06] border-l-2 border-violet-400 pl-[10px]"
                        : "text-violet-200 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4.5 h-4.5 shrink-0 text-violet-300" />
                    <span>{item.name}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                
                {isExpanded && (
                  <div className="pl-9 pr-2 space-y-0.5 py-1">
                    {item.children.map((child) => {
                      const isChildActive = child.href ? (pathname === child.href || pathname?.startsWith(`${child.href}/`)) : false;
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.name}
                          href={child.href || "#"}
                          onClick={closeMobile}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                            isChildActive
                              ? "bg-violet-500/20 text-white font-medium"
                              : "text-violet-200/80 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <ChildIcon className="w-4 h-4 shrink-0" />
                          <span>{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href || "#"}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={closeMobile}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 bg-white/[0.07]">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br from-indigo-400 to-violet-400">
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
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export function Header({ title, subtitle, actions, breadcrumbs }: HeaderProps) {
  const { currentBranch, organizationBranding } = useAuth();
  const { toggle } = useMobileSidebar();

  const { data: notifData } = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 60_000,
  });
  const notificationCount = notifData?.count ?? 0;

  return (
    <header className="min-h-[4rem] lg:min-h-[4.5rem] py-3 px-4 lg:px-6 flex flex-wrap items-center justify-between gap-y-3 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-neutral-200/50 dark:border-slate-800/50">
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger button – visible only on mobile */}
        <button
          onClick={toggle}
          className="lg:hidden -ml-1 flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
        </button>

        <div className="min-w-0">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 mb-0.5 truncate">
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={crumb.label}>
                  {i > 0 && <span className="select-none">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-500 dark:text-neutral-400 font-medium">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          {organizationBranding?.name && organizationBranding.name !== "ServiceHub" ? (
            <h1 className="text-lg lg:text-2xl font-bold bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-500 dark:from-indigo-400 dark:via-violet-400 dark:to-purple-400 bg-clip-text text-transparent truncate">
              {title}
            </h1>
          ) : (
            <h1 className="text-lg lg:text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent truncate">{title}</h1>
          )}
          {subtitle && <p className="text-xs lg:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
        {actions}

        {/* Dark Mode Toggle */}
        <ThemeToggle />

        {/* Global Search Hint — desktop full, mobile icon-only */}
        <button
          aria-label="Open search"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
            )
          }
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-slate-800 rounded-lg border border-neutral-200 dark:border-slate-700 text-xs text-neutral-500 font-medium hover:bg-neutral-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="ml-1 font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-neutral-200 dark:border-slate-700 shadow-sm text-[10px]">Ctrl K</kbd>
        </button>
        <button
          aria-label="Open search"
          onClick={() =>
            window.dispatchEvent(
              new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
            )
          }
          className="lg:hidden flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-neutral-200/60 dark:hover:border-white/10"
        >
          <Search className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          aria-label="Notifications"
          title="Notifications"
          className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-colors border border-transparent hover:border-neutral-200/60 dark:hover:border-white/10"
        >
          <Bell className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </Link>

        {/* Branch Badge */}
        {currentBranch && (
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-200/60 dark:border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-900/30">
            <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
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
      className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 border border-transparent hover:border-neutral-200/60 dark:hover:border-white/10 group"
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
// Main Layout Component (with mobile sidebar toggle)
// =====================================================

interface LayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const toggle = React.useCallback(() => setSidebarOpen((o) => !o), []);
  const close = React.useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on window resize to desktop
  React.useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  React.useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <MobileSidebarContext.Provider value={{ isOpen: sidebarOpen, toggle, close }}>
      <div className="min-h-screen bg-transparent">
        {/* Desktop sidebar – always visible ≥ lg */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay + drawer */}
        {sidebarOpen && (
          <>
            {/* Backdrop overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
              onClick={close}
            />
            {/* Sidebar drawer */}
            <div className="fixed inset-y-0 left-0 z-50 w-64 lg:hidden animate-slide-in-from-left">
              <Sidebar />
            </div>
          </>
        )}

        {/* Global Command Palette */}
        <CommandPalette />
        
        {/* Background Technician Tracking */}
        <TechnicianLocationTracker />

        <main className="main-content">{children}</main>
      </div>
    </MobileSidebarContext.Provider>
  );
}
