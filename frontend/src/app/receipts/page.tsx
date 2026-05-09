"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { ledgerApi, customersApi } from "@/lib/api/services";
import {
  IndianRupee, Search, RefreshCw, X, ChevronRight, User, FileText, CheckCircle2,
} from "lucide-react";

export default function ReceiptsPage() {
  const { currentBranch } = useAuth();

  // ---- state ----
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
    entry_type: "DEBIT", // Receipt is always a DEBIT to Khata (Payment Received)
    amount: "",
    description: "Payment Received",
    reference_type: "PAYMENT",
    entry_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // ---- fetch ----
  const fetchOutstanding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await ledgerApi.getOutstanding();
      setOutstanding((res as any)?.results || res || []);
    } catch (err) {
      console.error("Failed to load outstanding:", err);
    } finally {
      setLoading(false);
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
        customer: "", entry_type: "DEBIT", amount: "",
        description: "Payment Received", reference_type: "PAYMENT",
        entry_date: new Date().toISOString().split("T")[0], notes: "",
      });
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
        title="Receipts (Accounts Receivable)"
        subtitle="Manage incoming payments from customers"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
          >
            <IndianRupee className="w-4 h-4" /> Receive Payment
          </button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <IndianRupee className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Receivables</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5 border-l-4 border-l-violet-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-900/30">
                <User className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Customers with Dues</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  {outstanding.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Outstanding Customers List */}
          <div className="card p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                Customers to Collect From
              </h3>
              <button onClick={fetchOutstanding} className="text-neutral-400 hover:text-neutral-700">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            
            {loading ? (
              <p className="text-sm text-neutral-400 text-center py-6">Loading...</p>
            ) : outstanding.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-50" />
                <p className="text-sm text-neutral-500">All caught up! No pending receivables.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {outstanding.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCustomer({ id: c.id, name: c.name });
                      setForm({ ...form, customer: c.id, amount: c.balance });
                    }}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all ${
                      selectedCustomer?.id === c.id
                        ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                        : "border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate max-w-[150px]">{c.name}</p>
                      <p className="text-xs text-neutral-500">{c.mobile || ""}</p>
                      {c.invoice_count > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          {c.invoice_count} pending invoice{c.invoice_count > 1 ? "s" : ""}
                        </p>
                      )}
                      {c.source === "khata" && (
                        <p className="text-xs text-violet-500 mt-0.5">Khata balance</p>
                      )}
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

          {/* Payment Action Area */}
          <div className="card p-5 lg:col-span-2 flex flex-col items-center justify-center min-h-[400px]">
            {selectedCustomer ? (
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                    Receive Payment
                  </h3>
                  <button
                    onClick={() => { setSelectedCustomer(null); setForm({ ...form, customer: "", amount: "" }); }}
                    className="p-2 rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {statement && (
                  <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 text-center mb-1">
                      Outstanding Balance for {selectedCustomer.name}
                    </p>
                    <p className="text-3xl font-bold text-red-600 text-center">
                      ₹{Math.abs(parseFloat(statement.balance || 0)).toLocaleString("en-IN")}
                    </p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Amount to Receive (₹) *</label>
                    <input
                      required type="number" step="0.01" min="0.01"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      className="w-full px-4 py-3 text-lg font-bold rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Description *</label>
                    <input
                      required type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                      placeholder="e.g., Cash Payment"
                    />
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

                  <button
                    type="submit" disabled={saving || !form.amount}
                    className="w-full mt-4 px-4 py-3 rounded-xl text-white font-bold text-base shadow-lg transition-all disabled:opacity-50 hover:scale-[1.02]"
                    style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                  >
                    {saving ? "Processing..." : "Confirm Payment"}
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center opacity-60">
                <FileText className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">No Customer Selected</h3>
                <p className="text-sm text-neutral-500 max-w-sm mt-2">
                  Select a customer from the left to view their outstanding balance and record a payment.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Manual Add Entry Modal (for customers not in the outstanding list) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Receive Payment</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Customer search */}
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Select Customer *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Search by name or mobile..."
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

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Amount Received (₹) *</label>
                <input
                  required type="number" step="0.01" min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-green-600"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Description</label>
                <input
                  required type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-slate-800"
                >Cancel</button>
                <button
                  type="submit" disabled={saving || !form.customer || !form.amount}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                >
                  {saving ? "Processing..." : "Save Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
