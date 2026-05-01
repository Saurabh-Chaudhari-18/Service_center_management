"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Search, UserPlus, PackagePlus, Truck, FilePlus, Settings } from "lucide-react";

import { FastCreateCustomerModal } from "./FastCreateCustomerModal";
import { FastCreateInventoryModal } from "./FastCreateInventoryModal";
import { FastCreatePickupModal } from "./FastCreatePickupModal";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const { hasPermission, isRole, currentBranch } = useAuth();
  const router = useRouter();

  // Refs for scrolling active item into view
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = [
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
  ];

  const filteredActions = actions
    .filter((a) => a.show)
    .filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Reset active index when the filtered list or search changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Scroll active item into view whenever activeIndex changes
  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleActionClick = useCallback((action: () => void) => {
    setIsOpen(false);
    setSearchQuery("");
    action();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle palette with Ctrl+K / Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchQuery("");
          break;

        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((i) =>
            filteredActions.length === 0 ? 0 : (i + 1) % filteredActions.length
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((i) =>
            filteredActions.length === 0
              ? 0
              : i === 0
              ? filteredActions.length - 1
              : i - 1
          );
          break;

        case "Enter":
          e.preventDefault();
          if (filteredActions[activeIndex]) {
            handleActionClick(filteredActions[activeIndex].action);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredActions, activeIndex, handleActionClick]);

  // Lock body scroll when open
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
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 sm:pt-32">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setIsOpen(false);
              setSearchQuery("");
            }}
          />

          {/* Palette panel */}
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200/50 dark:border-slate-700/50 transform transition-all animate-slide-up mx-4">

            {/* Search */}
            <div className="flex items-center px-4 py-3 border-b border-neutral-100 dark:border-slate-800">
              <Search className="w-5 h-5 text-neutral-400 shrink-0" />
              <input
                type="text"
                autoFocus
                className="flex-1 px-3 py-1 bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 text-lg outline-none"
                placeholder="What do you want to do?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="px-2 py-1 bg-neutral-100 dark:bg-slate-800 rounded border border-neutral-200 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-neutral-500">ESC</span>
              </div>
            </div>

            {/* Actions list */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <div className="space-y-1">
                  {filteredActions.map((action, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <button
                        key={action.id}
                        ref={(el) => {
                          itemRefs.current[index] = el;
                        }}
                        onClick={() => handleActionClick(action.action)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors group ${
                          isActive
                            ? "bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-700"
                            : "hover:bg-neutral-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-colors ${
                              isActive
                                ? "bg-white dark:bg-slate-800 border-indigo-200 dark:border-indigo-700"
                                : "bg-neutral-50 dark:bg-slate-950 border-neutral-100 dark:border-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700"
                            }`}
                          >
                            {action.icon}
                          </div>
                          <span
                            className={`text-sm font-medium transition-colors ${
                              isActive
                                ? "text-indigo-700 dark:text-indigo-300"
                                : "text-neutral-700 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white"
                            }`}
                          >
                            {action.name}
                          </span>
                        </div>

                        {/* Right hint */}
                        <div
                          className={`flex items-center transition-opacity ${
                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                          }`}
                        >
                          {isActive ? (
                            <kbd className="text-[10px] font-mono bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-700">
                              ↵ Enter
                            </kbd>
                          ) : (
                            <span className="text-xs text-neutral-400">click</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-neutral-500 text-sm">
                  No actions found matching &ldquo;{searchQuery}&rdquo;
                </div>
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
              <span className="hidden sm:inline">ServiceHub Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
