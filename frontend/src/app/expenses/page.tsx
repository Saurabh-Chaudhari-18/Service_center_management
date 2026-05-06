"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { expensesApi } from "@/lib/api/services";
import {
  Plus, IndianRupee, Calendar, Filter, Trash2, Search,
  TrendingDown, Receipt, RefreshCw, X, BadgePercent, ChevronDown,
} from "lucide-react";
import type { Expense } from "@/types";

const EXPENSE_CATEGORIES = [
  { value: "RENT", label: "Rent" },
  { value: "ELECTRICITY", label: "Electricity" },
  { value: "INTERNET", label: "Internet / Wi-Fi" },
  { value: "SALARY", label: "Staff Salary" },
  { value: "TEA_SNACKS", label: "Tea / Snacks / Meals" },
  { value: "TRANSPORT", label: "Transport / Fuel" },
  { value: "STATIONERY", label: "Stationery / Printing" },
  { value: "TOOLS", label: "Tools & Equipment" },
  { value: "MAINTENANCE", label: "Shop Maintenance" },
  { value: "MARKETING", label: "Marketing / Advertising" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "TAX", label: "Tax / Government Fees" },
  { value: "MISCELLANEOUS", label: "Miscellaneous" },
];

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "NEFT", label: "NEFT/RTGS" },
  { value: "OTHER", label: "Other" },
];

export default function ExpensesPage() {
  const { currentBranch } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Form state
  const [form, setForm] = useState({
    title: "",
    category: "MISCELLANEOUS",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "CASH",
    vendor_name: "",
    description: "",
    reference: "",
    is_recurring: false,
    // ITC fields
    is_itc_eligible: false,
    vendor_gstin: "",
    vendor_invoice_number: "",
    gst_rate: "18",
    taxable_amount: "",
    cgst_amount: "0",
    sgst_amount: "0",
  });
  const [saving, setSaving] = useState(false);

  // Auto-calculate CGST/SGST when taxable or rate changes
  const handleITCChange = (field: string, value: string | boolean) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (updated.is_itc_eligible) {
        const taxable = parseFloat(updated.taxable_amount) || 0;
        const rate = parseFloat(updated.gst_rate) || 0;
        const half = ((taxable * rate) / 100 / 2).toFixed(2);
        updated.cgst_amount = half;
        updated.sgst_amount = half;
      } else {
        updated.cgst_amount = "0";
        updated.sgst_amount = "0";
      }
      return updated;
    });
  };

  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      const res = await expensesApi.list(params);
      setExpenses(res.results || []);
    } catch (err) {
      console.error("Failed to load expenses:", err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, search, categoryFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      const res = await expensesApi.getStats(params);
      setStats(res);
    } catch (err) {
      console.error("Failed to load expense stats:", err);
    }
  }, [currentBranch]);

  useEffect(() => {
    fetchExpenses();
    fetchStats();
  }, [fetchExpenses, fetchStats]);

  const EMPTY_FORM = {
    title: "", category: "MISCELLANEOUS", amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "CASH", vendor_name: "", description: "",
    reference: "", is_recurring: false,
    is_itc_eligible: false, vendor_gstin: "", vendor_invoice_number: "",
    gst_rate: "18", taxable_amount: "", cgst_amount: "0", sgst_amount: "0",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await expensesApi.create({
        ...form,
        amount: parseFloat(form.amount),
        taxable_amount: form.is_itc_eligible ? parseFloat(form.taxable_amount) || 0 : 0,
        cgst_amount: parseFloat(form.cgst_amount) || 0,
        sgst_amount: parseFloat(form.sgst_amount) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        branch: currentBranch?.id,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      console.error("Failed to create expense:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await expensesApi.delete(id);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      console.error("Failed to delete expense:", err);
    }
  };

  const getCategoryLabel = (val: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === val)?.label || val;

  return (
    <AppLayout>
      <Header
        title="Expenses"
        subtitle="Track daily operational costs & calculate net profit"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Plus className="w-4 h-4" /> Add Expense
          </button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Expenses</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  ₹{Number(stats?.total_amount || 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-900/30">
                <Receipt className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Expense Count</p>
                <p className="text-xl font-bold text-neutral-900 dark:text-white">
                  {stats?.expense_count || 0}
                </p>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-900/30">
                <IndianRupee className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Top Category</p>
                <p className="text-base font-bold text-neutral-900 dark:text-white">
                  {stats?.by_category?.[0]
                    ? `${stats.by_category[0].category_display} (₹${Number(stats.by_category[0].total).toLocaleString("en-IN")})`
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="">All Categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button onClick={() => { fetchExpenses(); fetchStats(); }} className="p-2 rounded-xl border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Expenses Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-slate-700">
                  <th className="text-left p-3 font-semibold text-neutral-600 dark:text-neutral-300">Date</th>
                  <th className="text-left p-3 font-semibold text-neutral-600 dark:text-neutral-300">Title</th>
                  <th className="text-left p-3 font-semibold text-neutral-600 dark:text-neutral-300">Category</th>
                  <th className="text-left p-3 font-semibold text-neutral-600 dark:text-neutral-300">Vendor</th>
                  <th className="text-center p-3 font-semibold text-neutral-600 dark:text-neutral-300">ITC</th>
                  <th className="text-right p-3 font-semibold text-neutral-600 dark:text-neutral-300">Amount</th>
                  <th className="text-center p-3 font-semibold text-neutral-600 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-neutral-400">Loading expenses...</td></tr>
                ) : expenses.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-neutral-400">No expenses found. Add your first expense!</td></tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-neutral-100 dark:border-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-neutral-600 dark:text-neutral-400">
                        {new Date(exp.expense_date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="p-3 font-medium text-neutral-900 dark:text-white">
                        {exp.title}
                        {exp.is_recurring && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 font-semibold">
                            Recurring
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-neutral-300">
                          {getCategoryLabel(exp.category)}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-600 dark:text-neutral-400">{exp.vendor_name || "—"}</td>
                      <td className="p-3 text-center">
                        {(exp as any).is_itc_eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            <BadgePercent className="w-3 h-3" /> ITC
                          </span>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-semibold text-red-600 dark:text-red-400">
                        ₹{Number(exp.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Add New Expense</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Title *</label>
                <input
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="e.g., Office electricity bill"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Amount (₹) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Date *</label>
                  <input
                    required
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Payment Method</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Vendor / Payee</label>
                <input
                  type="text"
                  value={form.vendor_name}
                  onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="Vendor name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Notes</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
                  placeholder="Additional details..."
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })}
                  className="rounded"
                />
                Mark as recurring monthly expense
              </label>

              {/* ── ITC Section ──────────────────────────────────── */}
              <div className="rounded-xl border border-dashed border-green-300 bg-green-50/50 p-4 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    <BadgePercent className="w-4 h-4 text-green-600" />
                    Claim ITC on this expense
                  </span>
                  {/* Toggle switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_itc_eligible}
                    onClick={() => handleITCChange("is_itc_eligible", !form.is_itc_eligible)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      form.is_itc_eligible ? "bg-green-500" : "bg-neutral-300"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      form.is_itc_eligible ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </label>

                {form.is_itc_eligible && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">Vendor GSTIN</label>
                        <input
                          type="text"
                          value={form.vendor_gstin}
                          onChange={(e) => setForm({ ...form, vendor_gstin: e.target.value.toUpperCase() })}
                          placeholder="e.g. 27XXXXX1234X1Z5"
                          maxLength={15}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">Vendor Invoice #</label>
                        <input
                          type="text"
                          value={form.vendor_invoice_number}
                          onChange={(e) => setForm({ ...form, vendor_invoice_number: e.target.value })}
                          placeholder="Vendor's bill number"
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">GST Rate (%)</label>
                        <select
                          value={form.gst_rate}
                          onChange={(e) => handleITCChange("gst_rate", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
                        >
                          {["5", "12", "18", "28"].map(r => (
                            <option key={r} value={r}>{r}%</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1">Taxable Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.taxable_amount}
                          onChange={(e) => handleITCChange("taxable_amount", e.target.value)}
                          placeholder="Amount before GST"
                          className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm"
                        />
                      </div>
                    </div>

                    {/* Auto-calculated preview */}
                    <div className="grid grid-cols-2 gap-3 bg-white rounded-lg border border-green-200 p-3">
                      <div className="text-center">
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">CGST (auto)</p>
                        <p className="text-lg font-bold text-green-700">₹{form.cgst_amount}</p>
                      </div>
                      <div className="text-center border-l border-green-100">
                        <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">SGST (auto)</p>
                        <p className="text-lg font-bold text-green-700">₹{form.sgst_amount}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-green-600">* CGST and SGST are auto-calculated from taxable amount and GST rate.</p>
                  </div>
                )}
              </div>
              {/* ─────────────────────────────────────────────────── */}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  {saving ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
