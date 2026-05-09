"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { IndianRupee, CreditCard, CheckCircle2, Search, Calendar, FileText, User, ChevronDown, ChevronUp, History } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { useAuth } from "@/context/AuthContext";
import { Purchase } from "@/types";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { currentBranch } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  
  // Payment Modal state
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [isPaying, setIsPaying] = useState(false);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await purchasesApi.list({ branch: currentBranch?.id });
      const items = Array.isArray(res) ? res : res.results || [];
      setPurchases(items);
    } catch (e) {
      console.error("Failed to load purchases", e);
    } finally {
      setLoading(false);
    }
  }, [currentBranch?.id]);

  useEffect(() => {
    if (currentBranch) {
      void loadPurchases();
    }
  }, [currentBranch, loadPurchases]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    
    setIsPaying(true);
    try {
      await purchasesApi.recordPayment(selectedPurchase.id, parseFloat(paymentAmount), paymentMethod);
      setSelectedPurchase(null);
      setPaymentAmount("");
      loadPurchases();
    } catch (error) {
      console.error("Failed to record payment", error);
      alert("Failed to record payment. Please try again.");
    } finally {
      setIsPaying(false);
    }
  };

  const filteredPurchases = purchases.filter(p => {
    const matchesSearch = p.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.invoice_number && p.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()));
      
    if (!matchesSearch) return false;
    
    if (activeTab === "pending") {
      return parseFloat(String(p.balance_due)) > 0;
    }
    return true;
  });

  const totalPayable = purchases
    .filter(p => parseFloat(String(p.balance_due)) > 0)
    .reduce((acc, p) => acc + parseFloat(String(p.balance_due || 0)), 0);

  return (
    <AppLayout>
      <Header
        title="Accounts Payable"
        subtitle="Manage outgoing payments to vendors for your purchases"
      />

      <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto pb-24">
        
        {/* Top Summary & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-neutral-200 dark:border-slate-700 shadow-sm flex items-center gap-4 w-full md:w-auto min-w-[300px]">
            <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <IndianRupee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-500 dark:text-slate-400 mb-0.5">Total Accounts Payable</p>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">₹{totalPayable.toLocaleString()}</h3>
            </div>
          </div>
          
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search vendor or invoice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-neutral-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-neutral-200/50 dark:hover:bg-slate-700/50"
            }`}
          >
            Pending Payables
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-neutral-200/50 dark:hover:bg-slate-700/50"
            }`}
          >
            All History
          </button>
        </div>

        {/* List of Purchases */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-neutral-500">Loading {activeTab === "pending" ? "pending payments" : "payment history"}...</div>
          ) : filteredPurchases.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              {activeTab === "pending" ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-white">All Caught Up!</h3>
                  <p className="text-neutral-500">You have no pending payments for any purchases.</p>
                </>
              ) : (
                <>
                  <FileText className="w-12 h-12 text-neutral-300 dark:text-slate-600 mb-3" />
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-white">No Purchase History</h3>
                  <p className="text-neutral-500">You haven&apos;t recorded any purchases yet.</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-slate-700">
              {filteredPurchases.map((purchase) => {
                const isExpanded = expandedPurchaseId === purchase.id;
                const hasPayments = purchase.payments && purchase.payments.length > 0;
                
                return (
                  <div key={purchase.id} className="flex flex-col hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-neutral-400" />
                          <h4 className="font-semibold text-neutral-900 dark:text-white">{purchase.vendor_name}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {purchase.invoice_number || "No Inv #"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {format(new Date(purchase.purchase_date), "dd MMM yyyy")}</span>
                          <span>Total: ₹{parseFloat(String(purchase.total_amount)).toLocaleString()}</span>
                          {hasPayments && (
                            <button
                              onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                              className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium ml-2"
                            >
                              <History className="w-3.5 h-3.5" />
                              {isExpanded ? "Hide History" : "View History"}
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        {parseFloat(String(purchase.balance_due)) <= 0 ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                              <p className="text-xs font-medium text-neutral-500 mb-0.5">Paid Amount</p>
                              <p className="font-bold text-neutral-900 dark:text-white">₹{parseFloat(String(purchase.paid_amount || 0)).toLocaleString()}</p>
                            </div>
                            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-xs rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              PAID
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="text-left sm:text-right">
                              <p className="text-xs font-medium text-rose-500 uppercase tracking-wide mb-0.5">Balance Due</p>
                              <p className="font-bold text-neutral-900 dark:text-white text-lg">₹{parseFloat(String(purchase.balance_due)).toLocaleString()}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedPurchase(purchase);
                                setPaymentAmount(String(purchase.balance_due));
                              }}
                              className="px-4 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-medium rounded-lg text-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <CreditCard className="w-4 h-4" />
                              Pay Now
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Expandable Payment History */}
                    {isExpanded && hasPayments && (
                      <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-neutral-100 dark:border-slate-700/50 bg-neutral-50/50 dark:bg-slate-800/30">
                        <h5 className="text-sm font-semibold text-neutral-700 dark:text-slate-300 mb-3 mt-2">Payment History</h5>
                        <div className="space-y-2">
                          {purchase.payments!.map((payment, idx) => (
                            <div key={payment.id || idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                  <IndianRupee className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-neutral-900 dark:text-white">
                                    ₹{parseFloat(String(payment.amount)).toLocaleString()}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {payment.payment_method} {payment.reference ? `• Ref: ${payment.reference}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-xs text-neutral-500">
                                {format(new Date(payment.created_at || new Date()), "dd MMM yyyy, hh:mm a")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-neutral-100 dark:border-slate-700 flex justify-between items-center bg-neutral-50 dark:bg-slate-800/80">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-rose-500" />
                Record Vendor Payment
              </h3>
            </div>
            
            <form onSubmit={handleRecordPayment} className="p-5 space-y-4">
              <div className="bg-rose-50 dark:bg-rose-500/10 rounded-xl p-4 border border-rose-100 dark:border-rose-500/20">
                <p className="text-sm text-rose-600 dark:text-rose-400 mb-1">Paying Vendor</p>
                <p className="font-semibold text-rose-900 dark:text-rose-300">{selectedPurchase.vendor_name}</p>
                <div className="flex justify-between mt-2 pt-2 border-t border-rose-200 dark:border-rose-500/30">
                  <span className="text-sm text-rose-600/80 dark:text-rose-400/80">Balance Due</span>
                  <span className="font-bold text-rose-700 dark:text-rose-300">₹{parseFloat(String(selectedPurchase.balance_due)).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1.5">
                  Amount to Pay
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    max={parseFloat(String(selectedPurchase.balance_due))}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-slate-300 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Credit/Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPurchase(null)}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-slate-300 bg-neutral-100 dark:bg-slate-700 hover:bg-neutral-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPaying || !paymentAmount}
                  className="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isPaying ? "Processing..." : "Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
