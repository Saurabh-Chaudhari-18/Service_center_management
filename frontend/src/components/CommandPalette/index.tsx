"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { customersApi, jobsApi } from "@/lib/api";
import {
  Search,
  UserPlus,
  PackagePlus,
  Truck,
  FilePlus,
  Settings,
  User,
  Hash,
  Loader2,
} from "lucide-react";
import { JobStatusBadge } from "@/components/ui";

import { FastCreateCustomerModal } from "./FastCreateCustomerModal";
import { FastCreateInventoryModal } from "./FastCreateInventoryModal";
import { FastCreatePickupModal } from "./FastCreatePickupModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionItem = {
  kind: "action";
  id: string;
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
};

type CustomerItem = {
  kind: "customer";
  id: string;
  label: string;
  sub: string;
  onSelect: () => void;
};

type JobItem = {
  kind: "job";
  id: string;
  label: string;
  sub: string;
  status: string;
  onSelect: () => void;
};

type PaletteItem = ActionItem | CustomerItem | JobItem;

// ─── Section header helper ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 select-none">
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const { hasPermission, isRole, currentBranch } = useAuth();
  const router = useRouter();

  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the search query — only fire API after 250 ms idle
  useEffect(() => {
    if (searchQuery.length < 2) {
      setDebouncedQuery("");
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const shouldSearch = isOpen && debouncedQuery.length >= 2;

  const { data: customerData, isFetching: searchingCustomers } = useQuery({
    queryKey: ["cmd-customers", debouncedQuery],
    queryFn: () =>
      customersApi.list({ search: debouncedQuery, page_size: 4 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const { data: jobData, isFetching: searchingJobs } = useQuery({
    queryKey: ["cmd-jobs", debouncedQuery],
    queryFn: () =>
      jobsApi.list({ search: debouncedQuery, page_size: 4 }),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  const isSearching = searchingCustomers || searchingJobs;

  // ─── Actions list ─────────────────────────────────────────────────────────

  const rawActions = useMemo(
    () => [
      {
        id: "create-job",
        name: "New Job Card",
        icon: <FilePlus className="w-5 h-5 text-indigo-500" />,
        show: hasPermission("canCreateJobCards"),
        action: () => router.push("/jobs/new"),
      },
      {
        id: "create-invoice",
        name: "New Invoice",
        icon: <FilePlus className="w-5 h-5 text-green-500" />,
        show: hasPermission("canCreateInvoices"),
        action: () => router.push("/billing/new"),
      },
      {
        id: "create-customer",
        name: "New Customer (In-Place)",
        icon: <UserPlus className="w-5 h-5 text-blue-500" />,
        show: isRole("OWNER", "MANAGER", "RECEPTIONIST"),
        action: () => setCustomerModalOpen(true),
      },
      {
        id: "create-inventory",
        name: "New Inventory Item (In-Place)",
        icon: <PackagePlus className="w-5 h-5 text-violet-500" />,
        show: hasPermission("canManageInventory"),
        action: () => setInventoryModalOpen(true),
      },
      {
        id: "create-pickup",
        name: "Request Pickup (In-Place)",
        icon: <Truck className="w-5 h-5 text-orange-500" />,
        show: hasPermission("canViewPickups"),
        action: () => setPickupModalOpen(true),
      },
      {
        id: "settings",
        name: "Open Settings",
        icon: <Settings className="w-5 h-5 text-gray-500" />,
        show: isRole("SUPER_ADMIN", "OWNER", "MANAGER"),
        action: () => router.push("/settings"),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasPermission, isRole],
  );

  const filteredActions = rawActions
    .filter((a) => a.show)
    .filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // ─── Unified navigable items ──────────────────────────────────────────────

  const allItems: PaletteItem[] = useMemo(() => {
    const actions: ActionItem[] = filteredActions.map((a) => ({
      kind: "action",
      id: a.id,
      label: a.name,
      icon: a.icon,
      onSelect: a.action,
    }));

    const customers: CustomerItem[] = shouldSearch
      ? (customerData?.results || []).map((c) => ({
          kind: "customer",
          id: c.id,
          label: `${c.first_name} ${c.last_name}`.trim(),
          sub: c.mobile,
          onSelect: () => router.push(`/customers/${c.id}`),
        }))
      : [];

    const jobs: JobItem[] = shouldSearch
      ? (jobData?.results || []).map((j) => ({
          kind: "job",
          id: j.id,
          label: j.job_number,
          sub: [
            j.customer
              ? `${(j.customer as { first_name?: string }).first_name ?? ""} ${(j.customer as { last_name?: string }).last_name ?? ""}`.trim()
              : "",
            j.brand,
            j.model,
          ]
            .filter(Boolean)
            .join(" · "),
          status: j.status,
          onSelect: () => router.push(`/jobs/${j.id}`),
        }))
      : [];

    return [...actions, ...customers, ...jobs];
  }, [filteredActions, customerData, jobData, shouldSearch, router]);

  const hasResults = allItems.length > 0;
  const hasCustomers = shouldSearch && (customerData?.results?.length || 0) > 0;
  const hasJobs = shouldSearch && (jobData?.results?.length || 0) > 0;
  // Index offset so we can render sections with correct activeIndex mapping
  const customerOffset = filteredActions.length;
  const jobOffset = customerOffset + (customerData?.results?.length || 0);

  // ─── Keyboard & scroll ────────────────────────────────────────────────────

  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, allItems.length]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setDebouncedQuery("");
  }, []);

  const handleSelect = useCallback(
    (item: PaletteItem) => {
      close();
      item.onSelect();
    },
    [close],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((p) => !p);
        return;
      }
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) =>
            allItems.length === 0 ? 0 : (i + 1) % allItems.length,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) =>
            allItems.length === 0
              ? 0
              : i === 0
                ? allItems.length - 1
                : i - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (allItems[activeIndex]) handleSelect(allItems[activeIndex]);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, allItems, activeIndex, close, handleSelect]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!currentBranch) return null;

  const branchId = currentBranch.id;

  return (
    <>
      <FastCreateCustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        branchId={branchId}
      />
      <FastCreateInventoryModal
        isOpen={inventoryModalOpen}
        onClose={() => setInventoryModalOpen(false)}
        branchId={branchId}
      />
      <FastCreatePickupModal
        isOpen={pickupModalOpen}
        onClose={() => setPickupModalOpen(false)}
        branchId={branchId}
      />

      {isOpen && (
        <div
          className="fixed inset-0 flex items-start justify-center pt-20 sm:pt-32"
          style={{ zIndex: "var(--z-command)" }}
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm"
            onClick={close}
          />

          {/* Palette panel */}
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200/50 dark:border-slate-700/50 transform animate-slide-up mx-4">

            {/* Search input */}
            <div className="flex items-center px-4 py-3 border-b border-neutral-100 dark:border-slate-800 gap-2">
              <Search className="w-5 h-5 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoFocus
                className="flex-1 py-1 bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 text-base outline-none"
                placeholder="Search jobs, customers, or type a command…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-neutral-400 animate-spin shrink-0" />
              ) : (
                <div className="px-2 py-1 bg-neutral-100 dark:bg-slate-800 rounded border border-neutral-200 dark:border-slate-700 shrink-0">
                  <span className="text-[10px] font-semibold text-neutral-500">ESC</span>
                </div>
              )}
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto pb-2">
              {!hasResults && !isSearching ? (
                <div className="p-8 text-center text-neutral-400 dark:text-neutral-600 text-sm">
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : "Type to search or run a command"}
                </div>
              ) : (
                <>
                  {/* ── Actions ─────────────────────────────────── */}
                  {filteredActions.length > 0 && (
                    <div>
                      {shouldSearch && <SectionLabel>Actions</SectionLabel>}
                      <div className="p-2 space-y-0.5">
                        {filteredActions.map((action, idx) => {
                          const isActive = idx === activeIndex;
                          return (
                            <button
                              key={action.id}
                              ref={(el) => { itemRefs.current[idx] = el; }}
                              onClick={() => handleSelect(allItems[idx])}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group ${
                                isActive
                                  ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700"
                                  : "hover:bg-neutral-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                                  isActive
                                    ? "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700"
                                    : "bg-neutral-50 dark:bg-slate-950 border-neutral-100 dark:border-slate-800"
                                }`}>
                                  {action.icon}
                                </div>
                                <span className={`text-sm font-medium ${isActive ? "text-indigo-700 dark:text-indigo-300" : "text-neutral-700 dark:text-neutral-200"}`}>
                                  {action.name}
                                </span>
                              </div>
                              {isActive && (
                                <kbd className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700">
                                  ↵
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Customer results ─────────────────────────── */}
                  {hasCustomers && (
                    <div>
                      <SectionLabel>Customers</SectionLabel>
                      <div className="px-2 space-y-0.5">
                        {(customerData?.results || []).map((c, i) => {
                          const idx = customerOffset + i;
                          const isActive = idx === activeIndex;
                          return (
                            <button
                              key={c.id}
                              ref={(el) => { itemRefs.current[idx] = el; }}
                              onClick={() => handleSelect(allItems[idx])}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                                isActive
                                  ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-inset ring-blue-200 dark:ring-blue-700"
                                  : "hover:bg-neutral-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? "bg-blue-100 text-blue-700" : "bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-neutral-300"}`}>
                                {`${c.first_name?.[0] ?? ""}${c.last_name?.[0] ?? ""}`.toUpperCase() || <User className="w-4 h-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${isActive ? "text-blue-800 dark:text-blue-200" : "text-neutral-800 dark:text-neutral-200"}`}>
                                  {c.first_name} {c.last_name}
                                </p>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                                  {c.mobile}
                                </p>
                              </div>
                              {isActive && (
                                <kbd className="text-[10px] font-mono bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-700 shrink-0">
                                  ↵
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Job results ──────────────────────────────── */}
                  {hasJobs && (
                    <div>
                      <SectionLabel>Job Cards</SectionLabel>
                      <div className="px-2 space-y-0.5">
                        {(jobData?.results || []).map((j, i) => {
                          const idx = jobOffset + i;
                          const isActive = idx === activeIndex;
                          return (
                            <button
                              key={j.id}
                              ref={(el) => { itemRefs.current[idx] = el; }}
                              onClick={() => handleSelect(allItems[idx])}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                                isActive
                                  ? "bg-violet-50 dark:bg-violet-900/30 ring-1 ring-inset ring-violet-200 dark:ring-violet-700"
                                  : "hover:bg-neutral-100 dark:hover:bg-slate-800"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-violet-100 dark:bg-violet-900/50" : "bg-neutral-100 dark:bg-slate-800"}`}>
                                <Hash className={`w-4 h-4 ${isActive ? "text-violet-600" : "text-neutral-500"}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-mono font-semibold ${isActive ? "text-violet-800 dark:text-violet-200" : "text-neutral-800 dark:text-neutral-200"}`}>
                                    {j.job_number}
                                  </span>
                                  <JobStatusBadge status={j.status} />
                                </div>
                                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
                                  {[
                                    j.customer
                                      ? `${(j.customer as { first_name?: string }).first_name ?? ""} ${(j.customer as { last_name?: string }).last_name ?? ""}`.trim()
                                      : "",
                                    j.brand,
                                    j.model,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                              {isActive && (
                                <kbd className="text-[10px] font-mono bg-violet-100 dark:bg-violet-800 text-violet-600 dark:text-violet-300 px-1.5 py-0.5 rounded border border-violet-200 dark:border-violet-700 shrink-0">
                                  ↵
                                </kbd>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Searching indicator */}
                  {isSearching && !hasCustomers && !hasJobs && shouldSearch && (
                    <div className="p-6 text-center text-neutral-400 text-sm flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching…
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-neutral-50 dark:bg-slate-950 border-t border-neutral-100 dark:border-slate-800 flex justify-between items-center text-xs text-neutral-500">
              <span className="flex items-center gap-2 flex-wrap">
                <span>
                  <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">ctrl</kbd>
                  {" "}+{" "}
                  <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">k</kbd>
                  {" "}open
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↑</kbd>
                  <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↓</kbd>
                  navigate
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span>
                  <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">↵</kbd>
                  {" "}select
                </span>
              </span>
              <span className="hidden sm:inline">
                {shouldSearch ? "jobs · customers · actions" : "ServiceHub"}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
