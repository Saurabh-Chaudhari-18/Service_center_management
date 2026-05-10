"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, ChevronRight, Calculator } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { formatDateLong } from "@/lib/formatters";
import { useAuth, ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Purchase } from "@/types";

export default function PurchasesPage() {
  const router = useRouter();
  const { currentBranch } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadPurchases = useCallback(async () => {
    if (!currentBranch) return;
    setLoading(true);
    try {
      const response = await purchasesApi.list({
        branch: currentBranch.id,
        search: search.length > 2 ? search : undefined,
      });
      setPurchases(response.results);
    } catch (error) {
      console.error("Failed to load purchases:", error);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, search]);

  useEffect(() => {
    if (currentBranch) {
      void loadPurchases();
    }
  }, [currentBranch, loadPurchases]);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount));
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header 
          title="Purchase History" 
          subtitle="Track inbound inventory, vendor bills, and historical costs."
          actions={
            <button
              onClick={() => router.push("/purchases/new")}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white transition-all duration-200 bg-gradient-to-r from-primary-600 to-primary-500 dark:from-emerald-500 dark:to-teal-500 border border-transparent rounded-xl hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add New Purchase</span>
            </button>
          }
        />
        <div className="p-6 font-sans">
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Search & Filters */}
            <div className="bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl border border-neutral-200 dark:border-slate-700/50 shadow-sm p-4 rounded-2xl flex flex-col md:flex-row gap-4 focus-within:ring-1 focus-within:ring-primary-500/50 transition-all">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 dark:text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by vendor name or invoice number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700/50 rounded-xl text-neutral-900 dark:text-slate-200 placeholder-neutral-400 dark:placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
                />
              </div>
            </div>

            {/* Purchases List */}
            <div className="grid gap-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-emerald-500"></div>
                </div>
              ) : purchases.length === 0 ? (
                <div className="bg-neutral-50 dark:bg-slate-800/30 border border-neutral-200 dark:border-slate-700/50 rounded-2xl p-12 text-center shadow-sm backdrop-blur-sm">
                  <FileText className="w-16 h-16 text-neutral-300 dark:text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-neutral-800 dark:text-slate-300">No purchases found</h3>
                  <p className="text-neutral-500 dark:text-slate-500 mt-2">
                    {search ? "Try adjusting your search terms." : "You haven't added any vendor purchases yet."}
                  </p>
                </div>
              ) : (
                purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    onClick={() => router.push(`/purchases/${purchase.id}`)}
                    className="group relative bg-white/90 dark:bg-slate-800/40 backdrop-blur-md border border-neutral-200 dark:border-slate-700/50 hover:border-primary-300 dark:hover:border-emerald-500/30 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md dark:hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden"
                  >
                    
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors">
                            {purchase.vendor_name}
                          </h3>
                          {purchase.invoice_number && (
                            <span className="px-2.5 py-1 text-xs font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-slate-300 rounded-md border border-neutral-200 dark:border-slate-600">
                              INV: {purchase.invoice_number}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-slate-400 mt-2">
                          <span className="flex items-center gap-1">
                            <Calculator className="w-4 h-4" />
                            {formatDateLong(purchase.purchase_date)}
                          </span>
                          
                          {/* Status Badge */}
                          <div className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            purchase.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                            purchase.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' :
                            purchase.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                            'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                          }`}>
                            {purchase.status || 'UNPAID'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-end md:items-center justify-between md:justify-end gap-6">
                        <div className="text-right">
                          <p className="text-sm text-neutral-500 dark:text-slate-400 mb-1">Total Amount</p>
                          <p className="text-xl font-bold text-neutral-900 dark:text-white">
                            {formatCurrency(purchase.total_amount)}
                          </p>
                        </div>
                        {parseFloat(String(purchase.balance_due)) > 0 && (
                          <div className="text-right">
                            <p className="text-xs font-medium text-rose-500 uppercase tracking-wide mb-1">Balance Due</p>
                            <p className="text-lg font-bold text-rose-600 dark:text-rose-400">
                              {formatCurrency(purchase.balance_due || 0)}
                            </p>
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-full bg-neutral-50 dark:bg-slate-700/50 border border-neutral-100 dark:border-transparent flex items-center justify-center group-hover:bg-primary-50 dark:group-hover:bg-emerald-500/20 group-hover:border-primary-100 transition-colors self-center">
                          <ChevronRight className="w-5 h-5 text-neutral-400 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-emerald-400 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
