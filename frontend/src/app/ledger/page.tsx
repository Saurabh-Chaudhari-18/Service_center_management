"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { ledgerApi, customersApi } from "@/lib/api/services";
import {
  Plus, BookOpen, TrendingUp, Search,
  RefreshCw, X, ChevronRight, IndianRupee, User, FileText,
  HelpCircle,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { formatPhone } from "@/lib/formatters";
import { Button, Spinner, EmptyState, Modal, Input, Select, Textarea } from "@/components/ui";
import {
  ActionBar,
  FormSection,
  PageShell,
  PaginationFooter,
  SummaryStrip,
  WorkspaceEyebrow,
} from "@/components/shell";
import { LedgerWorkspace } from "@/components/domain/ledger/LedgerWorkspace";
import { LedgerEntryRow } from "@/components/domain/ledger/LedgerEntryRow";

const ENTRIES_PAGE_SIZE = 15;

const LEDGER_ENTRY_FORM_ID = "ledger-entry-form";

const ENTRY_TYPE_OPTIONS = [
  { value: "CREDIT", label: "Amount Added to Bill (Customer Owes)" },
  { value: "DEBIT", label: "Payment Received from Customer" },
];

const REFERENCE_TYPE_OPTIONS = [
  { value: "INVOICE", label: "Invoice" },
  { value: "PAYMENT", label: "Payment Received" },
  { value: "ADJUSTMENT", label: "Manual Adjustment" },
  { value: "REFUND", label: "Refund" },
  { value: "ADVANCE", label: "Advance Payment" },
];

type LedgerStatementShape = {
  total_credit?: string | number;
  total_debit?: string | number;
  balance?: string | number;
};

export default function LedgerPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [entriesPage, setEntriesPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [form, setForm] = useState({
    customer: "",
    entry_type: "CREDIT",
    amount: "",
    description: "",
    reference_type: "ADJUSTMENT",
    entry_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const entriesQueryKey = ["ledger", "entries", currentBranch?.id, selectedCustomer?.id ?? null, entriesPage] as const;

  const entriesQuery = useQuery({
    queryKey: entriesQueryKey,
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page: entriesPage,
        page_size: ENTRIES_PAGE_SIZE,
      };
      if (currentBranch) params.branch = currentBranch.id;
      if (selectedCustomer) params.customer = selectedCustomer.id;
      return ledgerApi.list(params);
    },
    staleTime: 20_000,
  });

  const outstandingQuery = useQuery({
    queryKey: ["ledger", "outstanding"] as const,
    queryFn: async () => {
      const res = await ledgerApi.getOutstanding();
      return (res as { results?: unknown[] })?.results ?? res ?? [];
    },
    staleTime: 30_000,
  });

  const statementQuery = useQuery({
    queryKey: ["ledger", "statement", selectedCustomer?.id ?? ""] as const,
    queryFn: () => ledgerApi.getStatement(selectedCustomer!.id),
    enabled: !!selectedCustomer?.id,
    staleTime: 15_000,
  });

  const customersSearchQuery = useQuery({
    queryKey: ["ledger", "customer-search", currentBranch?.id, customerSearch] as const,
    queryFn: () =>
      customersApi.list({ branch: currentBranch?.id, search: customerSearch }),
    enabled: showForm && customerSearch.length >= 1,
    staleTime: 5_000,
  });

  const entriesListErrorRef = React.useRef(false);
  React.useEffect(() => {
    if (entriesQuery.isError && !entriesListErrorRef.current) {
      entriesListErrorRef.current = true;
      toast.error("Failed to load ledger entries.");
    }
    if (!entriesQuery.isError) entriesListErrorRef.current = false;
  }, [entriesQuery.isError, toast]);

  const outstandingErrorRef = React.useRef(false);
  React.useEffect(() => {
    if (outstandingQuery.isError && !outstandingErrorRef.current) {
      outstandingErrorRef.current = true;
      toast.error("Failed to load outstanding balances.");
    }
    if (!outstandingQuery.isError) outstandingErrorRef.current = false;
  }, [outstandingQuery.isError, toast]);

  const statementErrorRef = React.useRef(false);
  React.useEffect(() => {
    if (statementQuery.isError && selectedCustomer && !statementErrorRef.current) {
      statementErrorRef.current = true;
      toast.error("Failed to load customer statement.");
    }
    if (!statementQuery.isError) statementErrorRef.current = false;
  }, [statementQuery.isError, selectedCustomer, toast]);

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => ledgerApi.create(payload),
    onSuccess: () => {
      setShowForm(false);
      setForm({
        customer: "",
        entry_type: "CREDIT",
        amount: "",
        description: "",
        reference_type: "ADJUSTMENT",
        entry_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setCustomerSearch("");
      toast.success("Ledger entry added successfully.");
      void queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
    onError: () => {
      toast.error("Failed to add ledger entry. Please try again.");
    },
  });

  const entries = entriesQuery.data?.results ?? [];
  const entriesTotalCount =
    typeof entriesQuery.data?.count === "number"
      ? entriesQuery.data.count
      : entries.length;
  const outstanding = (outstandingQuery.data ?? []) as Array<{
    id: string;
    name: string;
    mobile?: string;
    balance: string;
  }>;
  const statement = statementQuery.data as LedgerStatementShape | undefined;
  const customers = customersSearchQuery.data?.results ?? [];

  const totalOutstanding = outstanding.reduce(
    (sum, c) => sum + (parseFloat(c.balance) || 0),
    0,
  );

  const invalidateLedger = () =>
    void queryClient.invalidateQueries({ queryKey: ["ledger"] });

  const entriesLoading = entriesQuery.isLoading;
  const entriesIsError = entriesQuery.isError;

  return (
    <AppLayout>
      <Header
        title={
          <span>
            Ledger{" "}
            <span className="text-base font-normal text-gray-400">(Khata)</span>
          </span>
        }
        subtitle="Track customer balances, credits & payment history"
        actions={
          <Button type="button" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
            Add Entry
          </Button>
        }
      />

      <PageShell width="fluid">
        <WorkspaceEyebrow>Workspace — customer khata &amp; dues</WorkspaceEyebrow>

        <SummaryStrip columns={3}>
          <div className="card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                <TrendingUp className="h-4 w-4 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total outstanding</p>
                <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                  ₹{totalOutstanding.toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <User className="h-4 w-4 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Customers with balance</p>
                <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">
                  {outstandingQuery.isLoading ? "—" : outstanding.length}
                </p>
              </div>
            </div>
          </div>
          <div className="card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <BookOpen className="h-4 w-4 text-violet-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total entries (list)</p>
                <p className="text-lg font-bold tabular-nums text-neutral-900 dark:text-white">{entriesTotalCount}</p>
              </div>
            </div>
          </div>
        </SummaryStrip>

        <LedgerWorkspace
          rail={
            <div className="card p-4">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
              <IndianRupee className="h-4 w-4 text-amber-500" />
              Customers with dues
            </h3>
            {outstandingQuery.isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner />
              </div>
            ) : outstandingQuery.isError ? (
              <EmptyState
                title="Couldn’t load balances"
                description="Try refreshing the page."
                action={
                  <Button type="button" size="sm" onClick={() => void outstandingQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            ) : outstanding.length === 0 ? (
              <p className="py-5 text-center text-sm text-neutral-400">No outstanding balances</p>
            ) : (
              <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
                {outstanding.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEntriesPage(1);
                      setSelectedCustomer({ id: c.id, name: c.name });
                    }}
                    className={`h-auto w-full justify-between rounded-lg border px-3 py-2 font-normal text-sm ${
                      selectedCustomer?.id === c.id
                        ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20"
                        : "border-neutral-100 hover:bg-neutral-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-neutral-500">{formatPhone(c.mobile) || ""}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        ₹{parseFloat(c.balance || "0").toLocaleString("en-IN")}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
          }
          workspace={
          <div className="card p-4">
            {selectedCustomer ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    <FileText className="h-4 w-4 text-violet-500" />
                    Statement — {selectedCustomer.name}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setEntriesPage(1);
                    }}
                    leftIcon={<X className="h-3.5 w-3.5" />}
                    className="text-xs font-normal text-neutral-400 hover:text-neutral-700"
                  >
                    Clear
                  </Button>
                </div>

                {statementQuery.isLoading ? (
                  <div className="mb-4 flex justify-center py-6">
                    <Spinner />
                  </div>
                ) : statement && !statementQuery.isError ? (
                  <div className="mb-4 flex gap-4 rounded-xl bg-neutral-50 p-3 dark:bg-slate-800">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-neutral-500">Total Credited</p>
                      <p className="font-bold text-red-600">₹{Number(statement.total_credit ?? 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex-1 border-x border-neutral-200 text-center dark:border-slate-700">
                      <p className="text-xs text-neutral-500">Total Paid</p>
                      <p className="font-bold text-green-600">₹{Number(statement.total_debit ?? 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-neutral-500">Balance Due</p>
                      <p className={`font-bold ${Number(statement.balance ?? 0) > 0 ? "text-amber-600" : "text-green-600"}`}>
                        ₹{Math.abs(Number(statement.balance ?? 0)).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="max-h-[min(28rem,calc(100vh-22rem))] space-y-1.5 overflow-y-auto">
                  {entriesLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                      <Spinner />
                      <p className="text-sm text-neutral-500">Loading entries…</p>
                    </div>
                  ) : entriesIsError ? (
                    <EmptyState
                      title="Couldn’t load entries"
                      action={
                        <Button type="button" size="sm" onClick={() => void entriesQuery.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : entries.length === 0 ? (
                    <p className="py-8 text-center text-sm text-neutral-400">No entries for this customer</p>
                  ) : (
                    entries.map((e: { id: string; description: string; entry_type: string; amount: number; reference_type?: string; entry_date?: string }) => (
                      <LedgerEntryRow
                        key={e.id}
                        variant="statement"
                        description={e.description}
                        entry_type={e.entry_type}
                        amount={e.amount}
                        reference_type={e.reference_type}
                        entry_date={e.entry_date}
                      />
                    ))
                  )}
                </div>
                {!entriesLoading && selectedCustomer && entries.length > 0 && (
                  <PaginationFooter
                    className="mt-3"
                    page={entriesPage}
                    pageSize={ENTRIES_PAGE_SIZE}
                    totalCount={entriesTotalCount}
                    onPrevious={() => setEntriesPage((p) => Math.max(1, p - 1))}
                    onNext={() => setEntriesPage((p) => p + 1)}
                  />
                )}
              </>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    <BookOpen className="h-4 w-4 text-violet-500" />
                    Recent Ledger Entries
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={invalidateLedger}
                    className="rounded-lg border border-neutral-200 p-1.5 dark:border-slate-700"
                    aria-label="Refresh ledger"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-[min(28rem,calc(100vh-22rem))] space-y-1.5 overflow-y-auto">
                  {entriesLoading ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10">
                      <Spinner />
                      <p className="text-sm text-neutral-500">Loading entries…</p>
                    </div>
                  ) : entriesIsError ? (
                    <EmptyState
                      title="Couldn’t load entries"
                      action={
                        <Button type="button" size="sm" onClick={() => void entriesQuery.refetch()}>
                          Retry
                        </Button>
                      }
                    />
                  ) : entries.length === 0 ? (
                    <p className="py-8 text-center text-sm text-neutral-400">No ledger entries yet. Add your first entry!</p>
                  ) : (
                    entries.map((e: {
                      id: string;
                      description: string;
                      entry_type: string;
                      amount: number;
                      entry_date?: string;
                      customer_name?: string;
                    }) => (
                      <LedgerEntryRow
                        key={e.id}
                        variant="feed"
                        description={e.description}
                        entry_type={e.entry_type}
                        amount={e.amount}
                        entry_date={e.entry_date}
                        customer_name={e.customer_name}
                      />
                    ))
                  )}
                </div>
                {!entriesLoading && !selectedCustomer && entries.length > 0 && (
                  <PaginationFooter
                    className="mt-3"
                    page={entriesPage}
                    pageSize={ENTRIES_PAGE_SIZE}
                    totalCount={entriesTotalCount}
                    onPrevious={() => setEntriesPage((p) => Math.max(1, p - 1))}
                    onNext={() => setEntriesPage((p) => p + 1)}
                  />
                )}
              </>
            )}
          </div>
          }
        />
      </PageShell>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Ledger Entry"
        footer={
          <div className="w-full min-w-[min(100%,24rem)]">
            <ActionBar
              className="border-transparent border-t-0 pt-0 pb-0"
              secondary={
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              }
              primary={
                <Button
                  type="submit"
                  form={LEDGER_ENTRY_FORM_ID}
                  className="w-full sm:w-auto"
                  disabled={createMutation.isPending || !form.customer || !form.amount}
                  isLoading={createMutation.isPending}
                >
                  Save Entry
                </Button>
              }
            />
          </div>
        }
      >
        <form
          id={LEDGER_ENTRY_FORM_ID}
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              ...form,
              amount: parseFloat(form.amount),
              branch: currentBranch?.id,
            });
          }}
          className="space-y-6"
        >
          <FormSection title="Customer" fieldGap="tight">
            <div>
              <Input
                type="text"
                label="Search customer"
                placeholder="Search customer by name..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                className="text-sm"
              />
              {customers.length > 0 && customerSearch && !form.customer && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {customersSearchQuery.isLoading ? (
                    <div className="flex justify-center py-3">
                      <Spinner size="sm" />
                    </div>
                  ) : (
                    customers.map((c: { id: string; first_name: string; last_name: string; mobile?: string }) => (
                      <Button
                        key={c.id}
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setForm({ ...form, customer: c.id });
                          setCustomerSearch(`${c.first_name} ${c.last_name}`);
                        }}
                        className="h-auto w-full justify-start rounded-none border-b border-neutral-100 px-4 py-2.5 text-left text-sm font-normal last:border-0 hover:bg-neutral-50 dark:border-slate-700 dark:hover:bg-slate-700"
                      >
                        <span className="font-medium">{c.first_name} {c.last_name}</span>
                        <span className="ml-2 text-neutral-400">{c.mobile}</span>
                      </Button>
                    ))
                  )}
                </div>
              )}
            </div>
          </FormSection>

          <FormSection title="Entry" fieldGap="tight">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1.5 flex items-center gap-1">
                  <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Entry Type</span>
                  <span className="text-red-500">*</span>
                  <span
                    title="Amount Added to Bill: customer owes more. Payment Received: customer paid you."
                    className="cursor-help text-gray-400"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </div>
                <Select
                  value={form.entry_type}
                  options={ENTRY_TYPE_OPTIONS}
                  onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
                  className="text-sm py-2"
                />
              </div>
              <Input
                required
                type="number"
                step="0.01"
                min={0.01}
                label="Amount (₹)"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                className="text-sm"
              />
            </div>
            <Input
              required
              type="text"
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g., Advance payment for repair"
              className="text-sm"
            />
          </FormSection>

          <FormSection title="Reference & date" fieldGap="tight">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Reference Type"
                value={form.reference_type}
                options={REFERENCE_TYPE_OPTIONS}
                onChange={(e) => setForm({ ...form, reference_type: e.target.value })}
                className="text-sm py-2"
              />
              <Input
                required
                type="date"
                label="Date"
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
                className="text-sm"
              />
            </div>
          </FormSection>

          <FormSection title="Notes" fieldGap="tight">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Additional notes..."
              aria-label="Notes"
              className="resize-none text-sm"
            />
          </FormSection>
        </form>
      </Modal>
    </AppLayout>
  );
}
