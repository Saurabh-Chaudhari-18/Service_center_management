"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { ledgerApi, customersApi } from "@/lib/api/services";
import {
  Plus, BookOpen, TrendingUp, TrendingDown, Search,
  RefreshCw, X, ChevronRight, IndianRupee, User, FileText,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatPhone } from "@/lib/formatters";

const ENTRIES_PAGE_SIZE = 15;

export default function LedgerPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();

  // ---- state ----
  const [entries, setEntries] = useState<any[]>([]);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesTotalCount, setEntriesTotalCount] = useState(0);
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
      const params: any = {
        page: entriesPage,
        page_size: ENTRIES_PAGE_SIZE,
      };
      if (currentBranch) params.branch = currentBranch.id;
      if (selectedCustomer) params.customer = selectedCustomer.id;
      const res = await ledgerApi.list(params);
      setEntries(res.results || []);
      setEntriesTotalCount(typeof res.count === "number" ? res.count : (res.results || []).length);
    } catch (err) {
      console.error("Failed to load ledger:", err);
      toast.error("Failed to load ledger entries.");
    } finally {
      setLoading(false);
    }
  }, [currentBranch, selectedCustomer, entriesPage, toast]);

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

  useEffect(() => {
    setEntriesPage(1);
  }, [selectedCustomer?.id]);
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
      toast.success("Ledger entry added successfully.");
      fetchLedger();
      fetchOutstanding();
      if (selectedCustomer) fetchStatement(selectedCustomer.id);
    } catch (err) {
      console.error("Failed to create entry:", err);
      toast.error("Failed to add ledger entry. Please try again.");
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
        title={
          <span>
            Ledger{" "}
            <span className="text-gray-400 font-normal text-base">(Khata)</span>
          </span>
        }
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
                <p className="text-xl font-bold text-neutral-900 dark:text-white">{entriesTotalCount}</p>
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
                    key={c.id}
                    onClick={() => setSelectedCustomer({ id: c.id, name: c.name })}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedCustomer?.id === c.id
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
                        : "border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-neutral-500">{formatPhone(c.mobile) || ""}</p>
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
                    onClick={() => {
                      setSelectedCustomer(null);
                      setEntriesPage(1);
                      fetchLedger();
                    }}
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
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                e.entry_type === "CREDIT"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                              }`}
                            >
                              {e.entry_type === "CREDIT" ? "Billed" : "Paid"}
                            </span>
                            <span className="text-xs text-neutral-400">{e.reference_type} · {formatDate(e.entry_date)}</span>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${e.entry_type === "CREDIT" ? "text-amber-700" : "text-green-700"}`}>
                          {e.entry_type === "CREDIT" ? "-" : "+"}₹{parseFloat(e.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {!loading && selectedCustomer && entries.length > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100 dark:border-slate-700">
                    <p className="text-sm text-neutral-500">
                      Showing {(entriesPage - 1) * ENTRIES_PAGE_SIZE + 1} to{" "}
                      {Math.min(entriesPage * ENTRIES_PAGE_SIZE, entriesTotalCount)} of{" "}
                      {entriesTotalCount} results
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={entriesPage <= 1}
                        onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-slate-600 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={entriesPage * ENTRIES_PAGE_SIZE >= entriesTotalCount}
                        onClick={() => setEntriesPage((p) => p + 1)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-slate-600 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
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
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${e.entry_type === "CREDIT" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-green-100 dark:bg-green-900/30"}`}>
                            {e.entry_type === "CREDIT"
                              ? <TrendingDown className="w-4 h-4 text-amber-600" />
                              : <TrendingUp className="w-4 h-4 text-green-600" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900 dark:text-white">{e.description}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  e.entry_type === "CREDIT"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                    : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                                }`}
                              >
                                {e.entry_type === "CREDIT" ? "Billed" : "Paid"}
                              </span>
                              <span className="text-xs text-neutral-400">{e.customer_name || ""} · {formatDate(e.entry_date)}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`font-bold text-sm ${e.entry_type === "CREDIT" ? "text-amber-700" : "text-green-700"}`}>
                          {e.entry_type === "CREDIT" ? "-" : "+"}₹{parseFloat(e.amount).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                {!loading && !selectedCustomer && entries.length > 0 && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100 dark:border-slate-700">
                    <p className="text-sm text-neutral-500">
                      Showing {(entriesPage - 1) * ENTRIES_PAGE_SIZE + 1} to{" "}
                      {Math.min(entriesPage * ENTRIES_PAGE_SIZE, entriesTotalCount)} of{" "}
                      {entriesTotalCount} results
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={entriesPage <= 1}
                        onClick={() => setEntriesPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-slate-600 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={entriesPage * ENTRIES_PAGE_SIZE >= entriesTotalCount}
                        onClick={() => setEntriesPage((p) => p + 1)}
                        className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-slate-600 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
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
                  <label className="flex items-center gap-1 block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    Entry Type *
                    <span
                      title={'Amount Added to Bill: customer owes more. Payment Received: customer paid you.'}
                      className="cursor-help text-gray-400"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                  </label>
                  <select
                    value={form.entry_type}
                    onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="CREDIT">Amount Added to Bill (Customer Owes)</option>
                    <option value="DEBIT">Payment Received from Customer</option>
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
