"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { expensesApi } from "@/lib/api/services";
import {
  Plus, IndianRupee, Trash2, Search,
  TrendingDown, Receipt, RefreshCw, BadgePercent,
} from "lucide-react";
import type { Expense } from "@/types";
import { Modal, Button, Badge, Input, Select, ConfirmDialog } from "@/components/ui";
import { PageShell, RegisterToolbar, WorkspaceSurface } from "@/components/shell";

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

const GST_RATES = [
  { value: "5", label: "5%" },
  { value: "12", label: "12%" },
  { value: "18", label: "18%" },
  { value: "28", label: "28%" },
];

const makeEmptyForm = () => ({
  title: "",
  category: "MISCELLANEOUS",
  amount: "",
  expense_date: new Date().toISOString().split("T")[0],
  payment_method: "CASH",
  vendor_name: "",
  description: "",
  reference: "",
  is_recurring: false,
  is_itc_eligible: false,
  vendor_gstin: "",
  vendor_invoice_number: "",
  gst_rate: "18",
  taxable_amount: "",
  cgst_amount: "0",
  sgst_amount: "0",
});

export default function ExpensesPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(makeEmptyForm);

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

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ["expenses", currentBranch?.id, search, categoryFilter],
    queryFn: () => {
      const params: Record<string, unknown> = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      return expensesApi.list(params);
    },
    enabled: !!currentBranch,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["expense-stats", currentBranch?.id],
    queryFn: () => {
      const params: Record<string, unknown> = {};
      if (currentBranch) params.branch = currentBranch.id;
      return expensesApi.getStats(params);
    },
    enabled: !!currentBranch,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      expensesApi.create({
        ...form,
        amount: parseFloat(form.amount),
        taxable_amount: form.is_itc_eligible ? parseFloat(form.taxable_amount) || 0 : 0,
        cgst_amount: parseFloat(form.cgst_amount) || 0,
        sgst_amount: parseFloat(form.sgst_amount) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        branch: currentBranch?.id,
      }),
    onSuccess: () => {
      setShowForm(false);
      setForm(makeEmptyForm());
      toast.success("Expense added.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
    },
    onError: () => toast.error("Failed to add expense."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      setPendingDeleteId(null);
      toast.success("Expense deleted.");
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
    },
    onError: () => toast.error("Failed to delete expense."),
  });

  const expenses: Expense[] = expensesData?.results || [];

  const getCategoryLabel = (val: string) =>
    EXPENSE_CATEGORIES.find((c) => c.value === val)?.label || val;

  return (
    <AppLayout>
      <Header
        title="Expenses"
        subtitle="Track daily operational costs & calculate net profit"
        actions={
          <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="w-4 h-4" />}>
            Add Expense
          </Button>
        }
      />

      <PageShell width="fluid">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5">
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
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5">
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
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5">
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

        <RegisterToolbar
          search={
            <Input
              type="text"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
              aria-label="Search expenses"
              className="py-3 text-sm"
            />
          }
          filters={
            <div className="flex items-center gap-3">
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                options={[{ value: "", label: "All Categories" }, ...EXPENSE_CATEGORIES]}
                className="w-48"
              />
              <button
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ["expenses"] });
                  void queryClient.invalidateQueries({ queryKey: ["expense-stats"] });
                }}
                className="p-2 rounded-xl border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          }
        />

        <WorkspaceSurface>
          {isLoading ? (
            <div className="p-8 text-center text-neutral-400">Loading expenses...</div>
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">
              {search || categoryFilter
                ? "No expenses found. Try adjusting your filters."
                : "No expenses yet. Add your first expense!"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Vendor</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">ITC</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-neutral-100 dark:border-slate-800 hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {new Date(exp.expense_date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 font-medium text-neutral-900 dark:text-white">
                        {exp.title}
                        {exp.is_recurring && (
                          <Badge size="sm" className="ml-2">Recurring</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-700 dark:text-neutral-300">
                          {getCategoryLabel(exp.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{exp.vendor_name || "—"}</td>
                      <td className="px-4 py-3 text-center">
                        {(exp as any).is_itc_eligible ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
                            <BadgePercent className="w-3 h-3" /> ITC
                          </span>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                        ₹{Number(exp.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setPendingDeleteId(exp.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </WorkspaceSurface>
      </PageShell>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add New Expense"
        size="xl"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="expense-create-form" isLoading={createMutation.isPending}>
              Save Expense
            </Button>
          </>
        }
      >
        <form id="expense-create-form" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <Input
            required
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g., Office electricity bill"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={EXPENSE_CATEGORIES}
            />
            <Input
              required
              label="Amount (₹) *"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              required
              label="Date *"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            />
            <Select
              label="Payment Method"
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              options={PAYMENT_METHODS}
            />
          </div>

          <Input
            label="Vendor / Payee"
            value={form.vendor_name}
            onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
            placeholder="Vendor name"
          />

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

          {/* ITC Section */}
          <div className="rounded-xl border border-dashed border-green-300 bg-green-50/50 p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                <BadgePercent className="w-4 h-4 text-green-600" />
                Claim ITC on this expense
              </span>
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
                  <Select
                    label="GST Rate (%)"
                    value={form.gst_rate}
                    onChange={(e) => handleITCChange("gst_rate", e.target.value)}
                    options={GST_RATES}
                  />
                  <Input
                    label="Taxable Amount (₹)"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.taxable_amount}
                    onChange={(e) => handleITCChange("taxable_amount", e.target.value)}
                    placeholder="Amount before GST"
                  />
                </div>

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
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => { if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId); }}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
