"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Select,
  LoadingState,
  EmptyState,
} from "@/components/ui";
import { EntityInspector, PageShell, PaginationFooter } from "@/components/shell";
import { BillingInvoiceInspectorBody } from "@/components/domain/billing/BillingInvoiceInspectorBody";
import { billingApi } from "@/lib/api";
import {
  Plus,
  Search,
  Receipt,
  Clock,
  CheckCircle,
  Download,
  Eye,
  FileText,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  IndianRupee,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatDateLong } from "@/lib/formatters";
import type { Invoice } from "@/types";
import { getInvoiceStatusPresentation, SemanticStatusBadge } from "@/platform/semantics";
import { InvoiceTemplate } from "@/components/billing/InvoiceTemplate";

// =====================================================
// Debounce Hook
// =====================================================

function useDebounce<T>(value: T, delayMs: number, onDebounce?: () => void): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedValue(value);
      onDebounce?.();
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs]);
  return debouncedValue;
}

// =====================================================
// Sort Types
// =====================================================

type SortField =
  | "invoice_number"
  | "customer_name"
  | "invoice_date"
  | "total_amount"
  | "status"
  | "balance_due";
type SortDir = "asc" | "desc";

// =====================================================
// Payment Summary Banner (Zoho-style)
// =====================================================

function PaymentSummaryBanner({
  stats,
}: {
  stats:
    | {
        total_invoiced: number;
        total_paid: number;
        total_pending: number;
        invoice_count: number;
      }
    | undefined;
}) {
  if (!stats) return null;

  const items = [
    {
      label: "TOTAL OUTSTANDING",
      value: `₹${stats.total_pending.toLocaleString("en-IN")}`,
      icon: <Clock className="w-5 h-5" />,
      iconStyle: { background: "#fef3c7", color: "#d97706" },
      valueColor: "text-amber-600",
    },
    {
      label: "TOTAL COLLECTED",
      value: `₹${stats.total_paid.toLocaleString("en-IN")}`,
      icon: <CheckCircle className="w-5 h-5" />,
      iconStyle: { background: "#dcfce7", color: "#16a34a" },
      valueColor: "text-green-600",
    },
    {
      label: "TOTAL INVOICED",
      value: `₹${stats.total_invoiced.toLocaleString("en-IN")}`,
      icon: <IndianRupee className="w-5 h-5" />,
      iconStyle: { background: "#ede9fe", color: "#4f46e5" },
      valueColor: "text-indigo-600",
    },
    {
      label: "INVOICE COUNT",
      value: String(stats.invoice_count),
      icon: <FileText className="w-5 h-5" />,
      iconStyle: { background: "#dbeafe", color: "#2563eb" },
      valueColor: "text-blue-600",
    },
  ];

  return (
    <div className="glass-card">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-white/60">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-4 p-5">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={item.iconStyle}
            >
              {item.icon}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">{item.label}</p>
              <p className={`text-xl font-bold ${item.valueColor}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================
// Sortable Column Header
// =====================================================

function SortableHeader({
  label,
  field,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
      <button
        onClick={() => onSort(field)}
        className={`flex items-center gap-1.5 hover:text-neutral-900 transition-colors ${
          isActive ? "text-primary-700" : ""
        }`}
      >
        <span>{label}</span>
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="w-3.5 h-3.5" />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

// =====================================================
// Invoice Row Component
// =====================================================

interface InvoiceRowProps {
  invoice: Invoice;
  isSelected: boolean;
  onSelect: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
}

function InvoiceRow({
  invoice,
  isSelected,
  onSelect,
  onDownload,
}: InvoiceRowProps) {
  const statusPresentation = getInvoiceStatusPresentation(invoice.status);

  return (
    <tr
      className={`cursor-pointer transition-colors ${
        isSelected
          ? "bg-primary-50 border-l-2 border-l-primary-500"
          : "hover:bg-neutral-50 border-l-2 border-l-transparent"
      }`}
      onClick={() => onSelect(invoice)}
    >
      <td className="px-4 py-4">
        <span className="font-mono text-sm font-medium text-primary-600 block">
          {invoice.invoice_number}
        </span>
        {!invoice.branch_name && (
          <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-slate-700 dark:text-slate-300">
            Universal
          </span>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-neutral-900">{invoice.customer_name}</p>
        <p className="text-sm text-neutral-500">{invoice.customer_mobile}</p>
      </td>
      <td className="px-4 py-4 text-sm text-neutral-600">
        {formatDateLong(invoice.invoice_date)}
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-neutral-900">
          ₹{invoice.total_amount.toLocaleString("en-IN")}
        </p>
        <p className="text-xs text-neutral-500">
          Tax: ₹{invoice.total_tax.toLocaleString("en-IN")}
        </p>
      </td>
      <td className="px-4 py-4">
        <SemanticStatusBadge presentation={statusPresentation} size="sm" />
      </td>
      <td className="px-4 py-4">
        <p
          className={`font-semibold ${
            invoice.balance_due > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          ₹{invoice.balance_due.toLocaleString("en-IN")}
        </p>
      </td>
      <td className="px-4 py-4">
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/billing/${invoice.id}`}>
            <Button variant="secondary" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
              View
            </Button>
          </Link>
          {invoice.status !== "CANCELLED" && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => onDownload(invoice)}
            >
              PDF
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

const BILLING_LIST_PAGE_SIZE = 10;

// =====================================================
// Main Billing Page
// =====================================================

function BillingContent() {
  const { currentBranch } = useAuth();

  // Read initial status from URL (e.g. /billing?status=PENDING)
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";

  // Local input state
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [customerInput, setCustomerInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // PDF Generation State
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (downloadingInvoice && pdfContainerRef.current) {
      const generatePdf = async () => {
        try {
          const html2pdf = (await import("html2pdf.js")).default;
          const opt = {
            margin: 0,
            filename: `${downloadingInvoice.invoice_number}.pdf`,
            image: { type: "jpeg" as const, quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: "in", format: "a4", orientation: "portrait" as const },
          };
          const element = pdfContainerRef.current;
          if (!element) return;
          await html2pdf()
            .set(opt)
            .from(element)
            .save();
          await billingApi.logDownload(downloadingInvoice.id);
        } catch (error) {
          console.error("Failed to generate PDF:", error);
        } finally {
          setDownloadingInvoice(null);
        }
      };

      setTimeout(generatePdf, 150);
    }
  }, [downloadingInvoice]);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("invoice_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Debounced values
  const resetPage = useCallback(() => setPage(1), []);
  const debouncedSearch = useDebounce(searchInput, 1000, resetPage);
  const debouncedCustomer = useDebounce(customerInput, 3000, resetPage);
  const debouncedDateFrom = useDebounce(dateFrom, 1500, resetPage);
  const debouncedDateTo = useDebounce(dateTo, 1500, resetPage);

  const { data, isLoading } = useQuery({
    queryKey: [
      "invoices",
      currentBranch?.id,
      debouncedSearch,
      statusFilter,
      debouncedCustomer,
      debouncedDateFrom,
      debouncedDateTo,
      page,
    ],
    queryFn: () =>
      billingApi.listInvoices({
        branch: currentBranch?.id,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        customer_name: debouncedCustomer || undefined,
        invoice_date_after: debouncedDateFrom || undefined,
        invoice_date_before: debouncedDateTo || undefined,
        page,
      }),
    enabled: !!currentBranch,
  });

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats({ branch: currentBranch?.id }),
    enabled: !!currentBranch,
  });

  const invoices = useMemo(() => data?.results ?? [], [data]);

  // Client-side sort
  const sortedInvoices = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "invoice_number":
          cmp = a.invoice_number.localeCompare(b.invoice_number);
          break;
        case "customer_name":
          cmp = a.customer_name.localeCompare(b.customer_name);
          break;
        case "invoice_date":
          cmp =
            new Date(a.invoice_date).getTime() -
            new Date(b.invoice_date).getTime();
          break;
        case "total_amount":
          cmp = a.total_amount - b.total_amount;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "balance_due":
          cmp = a.balance_due - b.balance_due;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [invoices, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleDownload = async (invoice: Invoice) => {
    try {
      const fullInvoice = await billingApi.getInvoice(invoice.id);
      setDownloadingInvoice(fullInvoice);
    } catch (error) {
      console.error("Failed to download invoice:", error);
    }
  };

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING", label: "Pending" },
    { value: "PARTIAL", label: "Partially Paid" },
    { value: "PAID", label: "Paid" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const hasColumnFilters = customerInput || dateFrom || dateTo;

  const clearColumnFilters = () => {
    setCustomerInput("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <ProtectedRoute requiredPermission="canViewBilling">
      <AppLayout>
        {/* Hidden PDF Template Container */}
        <div style={{ display: "none" }}>
          <div ref={pdfContainerRef}>
            {downloadingInvoice && <InvoiceTemplate invoice={downloadingInvoice} />}
          </div>
        </div>

        <Header
          title="Billing & Invoices"
          subtitle={`${data?.count || 0} total invoices`}
          actions={
            <Link href="/billing/new">
              <Button leftIcon={<Plus className="w-4 h-4" />}>
                New Invoice
              </Button>
            </Link>
          }
        />

        <PageShell width="fluid" className="min-w-0">
          {/* Payment Summary Banner */}
          <PaymentSummaryBanner stats={stats} />

          {/* Universal Search + Status */}
          <Card padding="md">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-5">
                <Input
                  placeholder="Search by invoice number or customer..."
                  leftIcon={<Search className="w-5 h-5" />}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="md:col-span-4 flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full text-sm font-normal text-neutral-800"
                  title="From date"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full text-sm font-normal text-neutral-800"
                  title="To date"
                />
              </div>
              <div className="md:col-span-3">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full"
                />
              </div>
            </div>
            {hasColumnFilters && (
              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Active Filters
                </span>
                <Button variant="ghost" size="sm" onClick={clearColumnFilters} leftIcon={<X className="w-3.5 h-3.5" />}>
                  Clear All
                </Button>
              </div>
            )}
          </Card>

          {/* Main Content Area */}
          <div className="relative flex min-w-0 gap-0">
            {/* Invoices Table */}
            <div
              className={`min-w-0 flex-1 transition-all duration-300 ${selectedInvoice ? "mr-[550px]" : ""}`}
            >
              {isLoading ? (
                <LoadingState />
              ) : invoices.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<Receipt className="w-8 h-8 text-neutral-400" />}
                    title="No invoices found"
                    description={
                      searchInput || statusFilter || hasColumnFilters
                        ? "Try adjusting your search or filter"
                        : "Create your first invoice"
                    }
                    action={
                      !searchInput &&
                      !statusFilter &&
                      !hasColumnFilters && (
                        <Link href="/billing/new">
                          <Button leftIcon={<Plus className="w-4 h-4" />}>
                            Create Invoice
                          </Button>
                        </Link>
                      )
                    }
                  />
                </Card>
              ) : (
                <Card padding="none">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50 border-b border-neutral-100">
                        <tr>
                          <SortableHeader
                            label="Invoice #"
                            field="invoice_number"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Customer"
                            field="customer_name"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Date"
                            field="invoice_date"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Amount"
                            field="total_amount"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Status"
                            field="status"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <SortableHeader
                            label="Balance"
                            field="balance_due"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                        {/* Clear column filters row */}
                        {hasColumnFilters && (
                          <tr className="bg-primary-50 border-b border-primary-100">
                            <td colSpan={7} className="px-4 py-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-primary-700">
                                  Column filters active
                                  {customerInput &&
                                    ` · Customer: "${customerInput}"`}
                                  {dateFrom && ` · From: ${dateFrom}`}
                                  {dateTo && ` · To: ${dateTo}`}
                                </span>
                                <button
                                  onClick={clearColumnFilters}
                                  className="text-xs text-primary-600 hover:text-primary-800 font-medium underline"
                                >
                                  Clear filters
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {sortedInvoices.map((invoice) => (
                          <InvoiceRow
                            key={invoice.id}
                            invoice={invoice}
                            isSelected={selectedInvoice?.id === invoice.id}
                            onSelect={setSelectedInvoice}
                            onDownload={handleDownload}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {(data?.previous || data?.next) && (
                <PaginationFooter
                  className="mt-4 rounded-xl border border-neutral-100 bg-white dark:border-slate-700 dark:bg-slate-900"
                  page={page}
                  pageSize={BILLING_LIST_PAGE_SIZE}
                  totalCount={data?.count ?? 0}
                  onPrevious={() => setPage((p) => p - 1)}
                  onNext={() => setPage((p) => p + 1)}
                  disabledPrevious={!data?.previous}
                  disabledNext={!data?.next}
                />
              )}
            </div>

            {selectedInvoice && (
              <EntityInspector
                open
                onOpenChange={(next) => {
                  if (!next) setSelectedInvoice(null);
                }}
                title={selectedInvoice.invoice_number}
                subtitle={selectedInvoice.customer_name}
                width="md"
                headerActions={
                  <>
                    <Link href={`/billing/${selectedInvoice.id}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Eye className="h-4 w-4" />}
                      >
                        Full View
                      </Button>
                    </Link>
                    <Link href={`/billing/${selectedInvoice.id}/edit`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Edit className="h-4 w-4" />}
                      >
                        Edit
                      </Button>
                    </Link>
                  </>
                }
                footer={
                  <div className="flex items-center gap-3">
                    <Link href={`/billing/${selectedInvoice.id}`} className="flex-1">
                      <Button
                        variant="primary"
                        className="w-full"
                        leftIcon={<Eye className="h-4 w-4" />}
                      >
                        View Full Details
                      </Button>
                    </Link>
                    {selectedInvoice.status !== "CANCELLED" && (
                      <Button
                        variant="secondary"
                        leftIcon={<Download className="h-4 w-4" />}
                        onClick={() => handleDownload(selectedInvoice)}
                      >
                        PDF
                      </Button>
                    )}
                  </div>
                }
              >
                <BillingInvoiceInspectorBody invoice={selectedInvoice} />
              </EntityInspector>
            )}
          </div>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function BillingPage() {
  return (
    <React.Suspense fallback={<AppLayout><LoadingState /></AppLayout>}>
      <BillingContent />
    </React.Suspense>
  );
}
