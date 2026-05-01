"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { ledgerApi, customersApi } from "@/lib/api/services";
import {
  Plus, BookOpen, TrendingUp, TrendingDown, Search,
  RefreshCw, X, ChevronRight, IndianRupee, User, FileText,
} from "lucide-react";

export default function LedgerPage() {
  const { currentBranch } = useAuth();

  // ---- state ----
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [statement, setStatement] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer: "",
    entry_type: "CREDIT",
    amount: "",
    description: "",
    reference_type: "ADJUSTMENT",
    entry_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // ---- fetch ----
  const fetchLedger = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (selectedCustomer) params.customer = selectedCustomer.id;
      const res = await ledgerApi.list(params);
      setEntries(res.results || []);
    } catch (err) {
      console.error("Failed to load ledger:", err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, selectedCustomer]);

  const fetchOutstanding = useCallback(async () => {
    try {
      const res = await ledgerApi.getOutstanding();
      setOutstanding((res as any)?.results || res || []);
    } catch (err) {
      console.error("Failed to load outstanding:", err);
    }
  }, []);

  const fetchStatement = useCallback(async (customerId: string) => {
    try {
      const res = await ledgerApi.getStatement(customerId);
      setStatement(res);
    } catch (err) {
      console.error("Failed to load statement:", err);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await customersApi.list({ branch: currentBranch?.id, search: customerSearch });
      setCustomers(res.results || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    }
  }, [currentBranch, customerSearch]);

  useEffect(() => { fetchLedger(); }, [fetchLedger]);
  useEffect(() => { fetchOutstanding(); }, [fetchOutstanding]);
  useEffect(() => {
    if (customerSearch.length >= 1) fetchCustomers();
  }, [customerSearch, fetchCustomers]);
  useEffect(() => {
    if (selectedCustomer) fetchStatement(selectedCustomer.id);
    else setStatement(null);
  }, [selectedCustomer, fetchStatement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ledgerApi.create({
        ...form,
        amount: parseFloat(form.amount),
        branch: currentBranch?.id,
      });
      setShowForm(false);
      setForm({
        customer: "", entry_type: "CREDIT", amount: "",
        description: "", reference_type: "ADJUSTMENT",
        entry_date: new Date().toISOString().split("T")[0], notes: "",
      });
      fetchLedger();
      fetchOutstanding();
      if (selectedCustomer) fetchStatement(selectedCustomer.id);
    } catch (err) {
      console.error("Failed to create entry:", err);
    } finally {
      setSaving(false);
    }
  };

  const totalOutstanding = outstanding.reduce(
    (sum: number, c: any) => sum + (parseFloat(c.balance) || 0), 0
  );

  return (
    <AppLayout>
      <Header
        title="Customer Ledger (Khata)"
        subtitle="Track customer balances, credits & payment history"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                <TrendingUp className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Outstanding</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <User className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Customers with Balance</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  {outstanding.length}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-900/30">
                <BookOpen className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Entries</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{entries.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Outstanding Customers List */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-amber-500" />
              Customers with Dues
            </h3>
            {outstanding.length === 0 ? (
              <p className="text-sm text-neutral-400 text-center py-6">No outstanding balances</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {outstanding.map((c: any) => (
                  <button
                    key={c.customer_id}
                    onClick={() => setSelectedCustomer({ id: c.customer_id, name: c.customer_name })}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedCustomer?.id === c.customer_id
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
                        : "border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{c.customer_name}</p>
                      <p className="text-xs text-neutral-500">{c.mobile || ""}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        ₹{parseFloat(c.balance || 0).toLocaleString("en-IN")}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Statement / Entry List */}
          <div className="card p-5 lg:col-span-2">
            {selectedCustomer ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-500" />
                    Statement — {selectedCustomer.name}
                  </h3>
                  <button
                    onClick={() => { setSelectedCustomer(null); fetchLedger(); }}
                    className="text-xs text-neutral-400 hover:text-neutral-700 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>

                {statement && (
                  <div className="flex gap-4 mb-4 p-3 rounded-xl bg-neutral-50 dark:bg-slate-800">
                    <div className="text-center flex-1">
                      <p className="text-xs text-neutral-500">Total Credited</p>
                      <p className="font-bold text-red-600">₹{parseFloat(statement.total_credit || 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="text-center flex-1 border-x border-neutral-200 dark:border-slate-700">
                      <p className="text-xs text-neutral-500">Total Paid</p>
                      <p className="font-bold text-green-600">₹{parseFloat(statement.total_debit || 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-xs text-neutral-500">Balance Due</p>
                      <p className={`font-bold ${parseFloat(statement.balance || 0) > 0 ? "text-amber-600" : "text-green-600"}`}>
                        ₹{Math.abs(parseFloat(statement.balance || 0)).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                )}

                <div className="overflow-y-auto max-h-80 space-y-2">
                  {loading ? (
                    <p className="text-sm text-neutral-400 text-center py-8">Loading...</p>
                  ) : entries.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">No entries for this customer</p>
                  ) : (
                    entries.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-slate-700">
                        <div>
                          <p className="text-sm font-medium text-neutral-900 dark:text-white">{e.description}</p>
                          <p className="text-xs text-neutral-400">{e.reference_type} · {new Date(e.entry_date).toLocaleDateString("en-IN")}</p>
                        </div>
                        <span className={`font-bold text-sm ${e.entry_type === "CREDIT" ? "text-red-600" : "text-green-600"}`}>
                          {e.entry_type === "CREDIT" ? "-" : "+"}₹{parseFloat(e.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-violet-500" />
                    Recent Ledger Entries
                  </h3>
                  <button onClick={fetchLedger} className="p-1.5 rounded-lg border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-96 space-y-2">
                  {loading ? (
                    <p className="text-sm text-neutral-400 text-center py-8">Loading entries...</p>
                  ) : entries.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">No ledger entries yet. Add your first entry!</p>
                  ) : (
                    entries.map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between p-3 rounded-xl border border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${e.entry_type === "CREDIT" ? "bg-red-100 dark:bg-red-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                            {e.entry_type === "CREDIT"
                              ? <TrendingDown className="w-4 h-4 text-red-500" />
                              : <TrendingUp className="w-4 h-4 text-green-500" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{e.description}</p>
                            <p className="text-xs text-neutral-400">{e.customer_name || ""} · {new Date(e.entry_date).toLocaleDateString("en-IN")}</p>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${e.entry_type === "CREDIT" ? "text-red-600" : "text-green-600"}`}>
                          {e.entry_type === "CREDIT" ? "-" : "+"}₹{parseFloat(e.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Add Ledger Entry</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer search */}
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search customer by name..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                {customers.length > 0 && customerSearch && !form.customer && (
                  <div className="mt-1 border border-neutral-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto bg-white dark:bg-slate-800 shadow-lg">
                    {customers.map((c: any) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, customer: c.id });
                          setCustomerSearch(`${c.first_name} ${c.last_name}`);
                          setCustomers([]);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-slate-700 border-b border-neutral-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="text-neutral-400 ml-2">{c.mobile}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Entry Type *</label>
                  <select
                    value={form.entry_type}
                    onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="CREDIT">Credit (Customer Owes)</option>
                    <option value="DEBIT">Debit (Payment Received)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Amount (₹) *</label>
                  <input
                    required type="number" step="0.01" min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Description *</label>
                <input
                  required type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="e.g., Advance payment for repair"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Reference Type</label>
                  <select
                    value={form.reference_type}
                    onChange={(e) => setForm({ ...form, reference_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="INVOICE">Invoice</option>
                    <option value="PAYMENT">Payment Received</option>
                    <option value="ADJUSTMENT">Manual Adjustment</option>
                    <option value="REFUND">Refund</option>
                    <option value="ADVANCE">Advance Payment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Date *</label>
                  <input
                    required type="date"
                    value={form.entry_date}
                    onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-slate-800"
                >Cancel</button>
                <button
                  type="submit" disabled={saving || !form.customer || !form.amount}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  {saving ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
