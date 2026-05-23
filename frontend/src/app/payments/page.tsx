"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { IndianRupee, CreditCard, CheckCircle2, Search, Calendar, FileText, User, ChevronDown, ChevronUp, History } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Purchase } from "@/types";
import { formatDateLong } from "@/lib/formatters";
import { Button, LoadingState, EmptyState, Modal, Input, Select } from "@/components/ui";
import {
  ActionBar,
  FormSection,
  PageShell,
  PaginationFooter,
  RegisterToolbar,
  SegmentedControl,
  WorkspaceEyebrow,
  WorkspaceSurface,
} from "@/components/shell";
import { AccountsPayableSummaryCard } from "@/components/domain/payments/AccountsPayableSummaryCard";
import { PaymentHistoryList } from "@/components/domain/payments/PaymentHistoryList";

const PAGE_SIZE = 10;

const RECORD_PAYMENT_FORM_ID = "record-payment-form";

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Credit/Debit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

const AP_SCOPE_SEGMENTS = [
  {
    value: "pending" as const,
    label: "Pending Payables",
    selectedClassName:
      "bg-white text-rose-600 shadow-sm dark:bg-slate-700 dark:text-rose-400",
  },
  {
    value: "history" as const,
    label: "All History",
    selectedClassName:
      "bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400",
  },
];

export default function PaymentsPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const outstandingErrorRef = React.useRef(false);
  const listErrorRef = React.useRef(false);

  const outstandingQuery = useQuery({
    queryKey: ["purchases", "outstanding-total", currentBranch?.id] as const,
    queryFn: () => purchasesApi.outstandingTotal({ branch: currentBranch!.id }),
    enabled: !!currentBranch?.id,
    staleTime: 20_000,
  });

  const payablesQuery = useQuery({
    queryKey: [
      "purchases",
      "payables",
      currentBranch?.id,
      currentPage,
      searchTerm.trim(),
      activeTab,
    ] as const,
    queryFn: async () => {
      const res = await purchasesApi.list({
        branch: currentBranch!.id,
        page: currentPage,
        page_size: PAGE_SIZE,
        ...(searchTerm.trim() ? { search: searchTerm.trim() } : {}),
        ...(activeTab === "pending" ? { has_outstanding: "true" } : {}),
      });
      const items = Array.isArray(res) ? res : res.results || [];
      const count = typeof (res as { count?: number }).count === "number"
        ? (res as { count: number }).count
        : items.length;
      return { items: items as Purchase[], count };
    },
    enabled: !!currentBranch?.id,
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (outstandingQuery.isError && !outstandingErrorRef.current) {
      outstandingErrorRef.current = true;
      toast.error("Failed to load accounts payable summary.");
    }
    if (!outstandingQuery.isError) outstandingErrorRef.current = false;
  }, [outstandingQuery.isError, toast]);

  React.useEffect(() => {
    if (payablesQuery.isError && !listErrorRef.current) {
      listErrorRef.current = true;
      toast.error("Failed to load payments. Please try again.");
    }
    if (!payablesQuery.isError) listErrorRef.current = false;
  }, [payablesQuery.isError, toast]);

  const payMutation = useMutation({
    mutationFn: ({
      id,
      amount,
      method,
    }: {
      id: string;
      amount: number;
      method: string;
    }) => purchasesApi.recordPayment(id, amount, method),
    onSuccess: () => {
      setSelectedPurchase(null);
      setPaymentAmount("");
      toast.success("Payment recorded successfully.");
      void queryClient.invalidateQueries({ queryKey: ["purchases"] });
    },
    onError: () => {
      toast.error("Failed to record payment. Please try again.");
    },
  });

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;
    payMutation.mutate({
      id: selectedPurchase.id,
      amount: parseFloat(paymentAmount),
      method: paymentMethod,
    });
  };

  const purchases = payablesQuery.data?.items ?? [];
  const totalCount = payablesQuery.data?.count ?? 0;
  const totalPayable = parseFloat(outstandingQuery.data?.total_outstanding || "0") || 0;
  const loading = !currentBranch || payablesQuery.isLoading;
  const listError = payablesQuery.isError;

  const hasNextPage = currentPage * PAGE_SIZE < totalCount;
  const hasPrevPage = currentPage > 1;

  return (
    <AppLayout>
      <Header
        title="Accounts Payable"
        subtitle="Manage outgoing payments to vendors for your purchases"
      />

      <PageShell width="fluid" className="pb-24">
        <WorkspaceEyebrow>Workspace — vendor payables &amp; disbursement</WorkspaceEyebrow>

        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <AccountsPayableSummaryCard
            loading={outstandingQuery.isLoading}
            totalOutstandingDisplay={`₹${totalPayable.toLocaleString()}`}
          />

          <RegisterToolbar
            className="w-full min-w-0 lg:max-w-md"
            search={
              <Input
                type="text"
                placeholder="Search vendor or invoice..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="h-5 w-5" />}
                aria-label="Search payables"
                className="py-3 text-sm"
              />
            }
          />
        </div>

        <SegmentedControl
          aria-label="Payables list scope"
          className="w-full sm:w-fit"
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
            setCurrentPage(1);
          }}
          options={AP_SCOPE_SEGMENTS}
        />

        <WorkspaceSurface>
          {loading ? (
            <div className="p-8">
              <LoadingState />
            </div>
          ) : listError ? (
            <div className="p-8">
              <EmptyState
                icon={<FileText className="h-8 w-8 text-neutral-400" />}
                title="Couldn’t load payments"
                description="Check your connection and try again."
                action={
                  <Button type="button" onClick={() => void payablesQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-8">
              {activeTab === "pending" ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
                  title="All Caught Up!"
                  description="You have no pending payments for any purchases."
                />
              ) : (
                <EmptyState
                  icon={<FileText className="h-10 w-10 text-neutral-300 dark:text-slate-600" />}
                  title="No Purchase History"
                  description="You haven't recorded any purchases yet."
                />
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-slate-700">
              {purchases.map((purchase) => {
                const isExpanded = expandedPurchaseId === purchase.id;
                const hasPayments = purchase.payments && purchase.payments.length > 0;

                return (
                  <div key={purchase.id} className="flex flex-col transition-colors hover:bg-neutral-50/80 dark:hover:bg-slate-800/40">
                    <div className="flex flex-col items-start justify-between gap-3 p-3 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pr-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-neutral-400" />
                          <h4 className="font-semibold text-neutral-900 dark:text-white">{purchase.vendor_name}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {purchase.invoice_number || "No Inv #"}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {formatDateLong(purchase.purchase_date)}</span>
                          <span>Total: ₹{parseFloat(String(purchase.total_amount)).toLocaleString()}</span>
                          {hasPayments && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedPurchaseId(isExpanded ? null : purchase.id)}
                              rightIcon={isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              leftIcon={<History className="h-3.5 w-3.5" />}
                              className="ml-2 h-auto p-1 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                              {isExpanded ? "Hide History" : "View History"}
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="flex w-full min-w-0 flex-col items-stretch justify-between gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                        {parseFloat(String(purchase.balance_due)) <= 0 ? (
                          <div className="flex items-center gap-3">
                            <div className="hidden text-right sm:block">
                              <p className="mb-0.5 text-xs font-medium text-neutral-500">Paid Amount</p>
                              <p className="font-bold text-neutral-900 dark:text-white">₹{parseFloat(String(purchase.paid_amount || 0)).toLocaleString()}</p>
                            </div>
                            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Paid
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="text-left sm:text-right">
                              <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-rose-500">Balance Due</p>
                              <p className="text-lg font-bold text-neutral-900 dark:text-white">₹{parseFloat(String(purchase.balance_due)).toLocaleString()}</p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              leftIcon={<CreditCard className="h-4 w-4" />}
                              onClick={() => {
                                setSelectedPurchase(purchase);
                                setPaymentAmount(String(purchase.balance_due));
                              }}
                              className="whitespace-nowrap rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
                            >
                              Pay Now
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && hasPayments && (
                      <PaymentHistoryList payments={purchase.payments!} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && !listError && purchases.length > 0 && (hasPrevPage || hasNextPage) && (
            <PaginationFooter
              page={currentPage}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPrevious={() => setCurrentPage((p) => p - 1)}
              onNext={() => setCurrentPage((p) => p + 1)}
              disabledPrevious={!hasPrevPage}
              disabledNext={!hasNextPage}
            />
          )}
        </WorkspaceSurface>
      </PageShell>

      <Modal
        isOpen={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        title="Record Vendor Payment"
        footer={
          <div className="w-full min-w-[min(100%,24rem)]">
            <ActionBar className="border-transparent border-t-0 pt-0 pb-0">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => setSelectedPurchase(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form={RECORD_PAYMENT_FORM_ID}
                className="w-full sm:w-auto"
                disabled={!paymentAmount || payMutation.isPending}
                isLoading={payMutation.isPending}
              >
                Confirm Payment
              </Button>
            </ActionBar>
          </div>
        }
      >
        {selectedPurchase ? (
          <form id={RECORD_PAYMENT_FORM_ID} onSubmit={handleRecordPayment} className="space-y-5">
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
              <p className="mb-1 flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
                <IndianRupee className="h-4 w-4" />
                Paying Vendor
              </p>
              <p className="font-semibold text-rose-900 dark:text-rose-300">{selectedPurchase.vendor_name}</p>
              <div className="mt-2 flex justify-between border-t border-rose-200 pt-2 dark:border-rose-500/30">
                <span className="text-sm text-rose-600/80 dark:text-rose-400/80">Balance Due</span>
                <span className="font-bold text-rose-700 dark:text-rose-300">
                  ₹{parseFloat(String(selectedPurchase.balance_due)).toLocaleString()}
                </span>
              </div>
            </div>

            <FormSection title="Payment details" fieldGap="tight">
              <Input
                required
                type="number"
                min={1}
                max={parseFloat(String(selectedPurchase.balance_due))}
                step="0.01"
                label="Amount to Pay"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                leftIcon={<span className="text-sm text-neutral-500">₹</span>}
                className="text-sm"
              />
              <Select
                label="Payment Method"
                value={paymentMethod}
                options={PAYMENT_METHOD_OPTIONS}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-sm py-2.5"
              />
            </FormSection>
          </form>
        ) : null}
      </Modal>
    </AppLayout>
  );
}
