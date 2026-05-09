"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Calendar, FileText, CheckCircle2 } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Purchase } from "@/types";

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPurchase = useCallback(async () => {
    try {
      const data = await purchasesApi.get(id);
      setPurchase(data);
    } catch (error) {
      console.error("Failed to load purchase:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      void loadPurchase();
    }
  }, [id, loadPurchase]);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount));
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6 flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 dark:border-emerald-500"></div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!purchase) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="p-6">
            <div className="max-w-4xl mx-auto text-center mt-20">
              <h2 className="text-2xl font-bold text-neutral-800 dark:text-slate-200">Purchase not found</h2>
              <button onClick={() => router.push("/purchases")} className="mt-4 text-primary-600 dark:text-emerald-400 hover:text-primary-700 dark:hover:text-emerald-300 font-medium hover:underline">
                Go back to Purchases
              </button>
            </div>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header 
          title="Purchase Details"
          actions={
            <button
              onClick={() => router.push("/purchases")}
              className="px-4 py-2 flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-emerald-400 transition-colors bg-white dark:bg-slate-800/50 rounded-lg hover:bg-neutral-50 dark:hover:bg-slate-800 border border-neutral-200 dark:border-slate-700/50 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to History
            </button>
          }
        />
        <div className="p-6 font-sans">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/90 dark:bg-slate-800/40 backdrop-blur-md border border-neutral-200 dark:border-slate-700/50 shadow-sm rounded-2xl p-6">
                <h3 className="text-sm font-medium text-neutral-500 dark:text-slate-400 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Vendor
                </h3>
                <p className="text-lg font-semibold text-neutral-900 dark:text-slate-100">{purchase.vendor_name}</p>
                {purchase.invoice_number && (
                  <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1">Inv: {purchase.invoice_number}</p>
                )}
              </div>

              <div className="bg-white/90 dark:bg-slate-800/40 backdrop-blur-md border border-neutral-200 dark:border-slate-700/50 shadow-sm rounded-2xl p-6">
                <h3 className="text-sm font-medium text-neutral-500 dark:text-slate-400 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Date
                </h3>
                <p className="text-lg font-semibold text-neutral-900 dark:text-slate-100">
                  {new Date(purchase.purchase_date).toLocaleDateString("en-IN", {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>

              <div className="bg-primary-50 dark:bg-slate-800/40 backdrop-blur-md border border-primary-200 dark:border-emerald-500/30 dark:shadow-[0_0_15px_rgba(16,185,129,0.1)] shadow-sm rounded-2xl p-6">
                <h3 className="text-sm font-medium text-primary-600 dark:text-slate-400 mb-1">Total Amount</h3>
                <p className="text-2xl font-bold text-primary-700 dark:text-emerald-400">
                  {formatCurrency(purchase.total_amount)}
                </p>
              </div>
            </div>

            {/* Items Table */}
            <div className="bg-white/90 dark:bg-slate-800/40 backdrop-blur-xl border border-neutral-200 dark:border-slate-700/50 shadow-sm rounded-2xl overflow-hidden mt-8">
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700/50 flex items-center gap-2 bg-neutral-50/50 dark:bg-transparent">
                <CheckCircle2 className="w-5 h-5 text-primary-500 dark:text-emerald-500" />
                <h3 className="font-semibold text-neutral-900 dark:text-slate-200">Items Added to Stock</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-slate-900/50 text-neutral-500 dark:text-slate-400 text-sm border-b border-neutral-200 dark:border-transparent">
                      <th className="px-6 py-4 font-medium">Item Name</th>
                      <th className="px-6 py-4 font-medium text-right">Quantity</th>
                      <th className="px-6 py-4 font-medium text-right">Unit Price</th>
                      <th className="px-6 py-4 font-medium text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-slate-700/50 text-neutral-700 dark:text-slate-300 bg-white dark:bg-transparent">
                    {purchase.items?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-neutral-500 dark:text-slate-500">
                          No items found in this purchase.
                        </td>
                      </tr>
                    ) : (
                      purchase.items?.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-neutral-900 dark:text-slate-200">{item.item_name}</p>
                            {item.sku && <p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">SKU: {item.sku}</p>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 text-sm font-medium bg-primary-50 dark:bg-emerald-500/10 text-primary-700 dark:text-emerald-400 rounded-full border border-primary-100 dark:border-emerald-500/20">
                              +{item.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-neutral-900 dark:text-slate-200">
                            {formatCurrency(item.total_price)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
