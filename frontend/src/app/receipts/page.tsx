"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ledgerApi, customersApi } from "@/lib/api/services";
import {
  IndianRupee, Search, RefreshCw, X, ChevronRight, User, FileText, CheckCircle2,
} from "lucide-react";
import { Modal, Button, Input } from "@/components/ui";
import { PageShell } from "@/components/shell";

const makeEmptyForm = () => ({
  customer: "",
  entry_type: "DEBIT",
  amount: "",
  description: "Payment Received",
  reference_type: "PAYMENT",
  entry_date: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function ReceiptsPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);

  const { data: outstandingData, isLoading, refetch: refetchOutstanding } = useQuery({
    queryKey: ["ledger", "outstanding"],
    queryFn: () => ledgerApi.getOutstanding(),
  });
  const outstanding: any[] = (outstandingData as any)?.results || outstandingData || [];

  const { data: statement } = useQuery<any>({
    queryKey: ["statement", selectedCustomer?.id],
    queryFn: () => ledgerApi.getStatement(selectedCustomer!.id),
    enabled: !!selectedCustomer,
  });

  const { data: customersData } = useQuery({
    queryKey: ["customer-search-receipts", customerSearch, currentBranch?.id],
    queryFn: () => customersApi.list({ branch: currentBranch?.id, search: customerSearch }),
    enabled: customerSearch.length >= 1,
  });
  const customers: any[] = customersData?.results || [];

  const submitMutation = useMutation({
    mutationFn: () =>
      ledgerApi.create({
        ...form,
        amount: parseFloat(form.amount),
        branch: currentBranch?.id,
      }),
    onSuccess: () => {
      setShowForm(false);
      setForm({ ...makeEmptyForm(), customer: selectedCustomer?.id ?? "" });
      toast.success("Payment recorded.");
      void queryClient.invalidateQueries({ queryKey: ["ledger", "outstanding"] });
      if (selectedCustomer) {
        void queryClient.invalidateQueries({ queryKey: ["statement", selectedCustomer.id] });
      }
    },
    onError: () => toast.error("Failed to record payment."),
  });

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate();
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
          <Button onClick={() => setShowForm(true)} leftIcon={<IndianRupee className="w-4 h-4" />}>
            Receive Payment
          </Button>
        }
      />

      <PageShell width="fluid">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 border-l-4 border-l-amber-500">
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
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 border-l-4 border-l-violet-500">
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
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                Customers to Collect From
              </h3>
              <button
                type="button"
                onClick={() => void refetchOutstanding()}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-slate-800"
                aria-label="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoading ? (
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
                    className={`flex min-h-[3.25rem] w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
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
          <div className="bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl p-5 lg:col-span-2 flex flex-col items-center justify-center min-h-[400px]">
            {selectedCustomer ? (
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                    Receive Payment
                  </h3>
                  <button
                    onClick={() => { setSelectedCustomer(null); setForm({ ...form, customer: "", amount: "" }); }}
                    className="p-2 rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-slate-800"
                    aria-label="Deselect customer"
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
                      ₹{Math.abs(parseFloat((statement as any).balance || 0)).toLocaleString("en-IN")}
                    </p>
                  </div>
                )}

                <form onSubmit={handleInlineSubmit} className="space-y-4">
                  <Input
                    required
                    label="Amount to Receive (₹) *"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    className="text-lg font-bold"
                  />
                  <Input
                    required
                    label="Description *"
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="e.g., Cash Payment"
                  />
                  <Input
                    required
                    label="Date *"
                    type="date"
                    value={form.entry_date}
                    onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                  />
                  <Button
                    type="submit"
                    disabled={submitMutation.isPending || !form.amount}
                    isLoading={submitMutation.isPending}
                    className="w-full mt-4"
                    size="lg"
                  >
                    Confirm Payment
                  </Button>
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
      </PageShell>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Receive Payment"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="receipt-manual-form"
              disabled={submitMutation.isPending || !form.customer || !form.amount}
              isLoading={submitMutation.isPending}
            >
              Save Receipt
            </Button>
          </>
        }
      >
        <form
          id="receipt-manual-form"
          onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }}
          className="space-y-4"
        >
          {/* Customer search */}
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Select Customer *</label>
            <Input
              type="text"
              placeholder="Search by name or mobile..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              aria-label="Search customers"
            />
            {customers.length > 0 && customerSearch && !form.customer && (
              <div className="mt-1 border border-neutral-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto bg-white dark:bg-slate-800 shadow-lg">
                {customers.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, customer: c.id });
                      setCustomerSearch(`${c.first_name} ${c.last_name}`);
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

          <Input
            required
            label="Amount Received (₹) *"
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
            className="font-bold text-green-600"
          />

          <Input
            required
            label="Description"
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </form>
      </Modal>
    </AppLayout>
  );
}
