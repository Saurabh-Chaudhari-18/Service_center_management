"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Search, UserPlus, PackagePlus, Truck, FilePlus, Settings } from "lucide-react";

import { FastCreateCustomerModal } from "./FastCreateCustomerModal";
import { FastCreateInventoryModal } from "./FastCreateInventoryModal";
import { FastCreatePickupModal } from "./FastCreatePickupModal";

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals state
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  const { hasPermission, isRole, currentBranch } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Lock body scroll when palette is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!currentBranch) return null; // Needs branch context

  const branchId = currentBranch.id;

  const actions = [
    {
      id: "create-job",
      name: "New Job Card",
      icon: <FilePlus className="w-5 h-5 text-indigo-500" />,
      shortcut: "J",
      show: hasPermission("canCreateJobCards"),
      action: () => router.push("/jobs/new"),
    },
    {
      id: "create-invoice",
      name: "New Invoice",
      icon: <FilePlus className="w-5 h-5 text-green-500" />,
      shortcut: "I",
      show: hasPermission("canCreateInvoices"),
      action: () => router.push("/billing/new"),
    },
    {
      id: "create-customer",
      name: "New Customer (In-Place)",
      icon: <UserPlus className="w-5 h-5 text-blue-500" />,
      shortcut: "C",
      show: isRole("OWNER", "MANAGER", "RECEPTIONIST"),
      action: () => setCustomerModalOpen(true),
    },
    {
      id: "create-inventory",
      name: "New Inventory Item (In-Place)",
      icon: <PackagePlus className="w-5 h-5 text-violet-500" />,
      shortcut: "P",
      show: hasPermission("canManageInventory"),
      action: () => setInventoryModalOpen(true),
    },
    {
      id: "create-pickup",
      name: "Request Pickup (In-Place)",
      icon: <Truck className="w-5 h-5 text-orange-500" />,
      shortcut: "D",
      show: hasPermission("canViewPickups"), // Usually anyone who can view can create
      action: () => setPickupModalOpen(true),
    },
    {
      id: "settings",
      name: "Open Settings",
      icon: <Settings className="w-5 h-5 text-gray-500" />,
      shortcut: "S",
      show: isRole("SUPER_ADMIN", "OWNER", "MANAGER"),
      action: () => router.push("/settings"),
    },
  ];

  const filteredActions = actions
    .filter((a) => a.show)
    .filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleActionClick = (action: () => void) => {
    setIsOpen(false);
    action();
  };

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
            onClick={() => setIsOpen(false)}
          />

          {/* Command Palette */}
          <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-neutral-200/50 dark:border-slate-700/50 transform transition-all animate-slide-up mx-4">
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
              <div className="px-2 py-1 bg-neutral-100 dark:bg-slate-800 rounded border border-neutral-200 dark:border-slate-700 flex items-center gap-1">
                <span className="text-[10px] font-semibold text-neutral-500">ESC</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <div className="space-y-1">
                  {filteredActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleActionClick(action.action)}
                      className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-50 dark:bg-slate-950 flex items-center justify-center border border-neutral-100 dark:border-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                          {action.icon}
                        </div>
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200 group-hover:text-neutral-900 dark:group-hover:text-white">
                          {action.name}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-neutral-400">Press Enter or Click</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-neutral-500 text-sm">
                  No actions found matching "{searchQuery}"
                </div>
              )}
            </div>
            
            <div className="px-4 py-2 bg-neutral-50 dark:bg-slate-950 border-t border-neutral-100 dark:border-slate-800 flex justify-between items-center text-xs text-neutral-500">
              <span>Use <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">Ctrl</kbd> + <kbd className="font-mono bg-neutral-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px]">K</kbd> anywhere to open</span>
              <span className="hidden sm:inline">ServiceHub Command Palette</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
