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
  InvoiceStatusBadge,
  LoadingState,
  EmptyState,
  StatsCard,
} from "@/components/ui";
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
  CreditCard,
  Calendar,
  AlertCircle,
  Edit,
  IndianRupee,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { Invoice, InvoiceStatus, InvoiceLineItem, Payment } from "@/types";
import { INVOICE_STATUS_CONFIG } from "@/types";

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
      label: "Total Outstanding",
      value: `₹${stats.total_pending.toLocaleString("en-IN")}`,
      icon: <AlertCircle className="w-5 h-5" />,
      color: "text-amber-700",
      bg: "bg-amber-50",
      iconBg: "bg-amber-100",
    },
    {
      label: "Total Collected",
      value: `₹${stats.total_paid.toLocaleString("en-IN")}`,
      icon: <CheckCircle className="w-5 h-5" />,
      color: "text-green-700",
      bg: "bg-green-50",
      iconBg: "bg-green-100",
    },
    {
      label: "Total Invoiced",
      value: `₹${stats.total_invoiced.toLocaleString("en-IN")}`,
      icon: <IndianRupee className="w-5 h-5" />,
      color: "text-primary-700",
      bg: "bg-primary-50",
      iconBg: "bg-primary-100",
    },
    {
      label: "Invoice Count",
      value: stats.invoice_count,
      icon: <FileText className="w-5 h-5" />,
      color: "text-blue-700",
      bg: "bg-blue-50",
      iconBg: "bg-blue-100",
    },
  ];

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
          Payment Summary
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-4 p-5">
            <div
              className={`w-10 h-10 rounded-xl ${item.iconBg} ${item.color} flex items-center justify-center flex-shrink-0`}
            >
              {item.icon}
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {item.label}
              </p>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
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
  children,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  children?: React.ReactNode;
}) {
  const isActive = currentSort === field;

  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
      <div className="space-y-1.5">
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
        {children}
      </div>
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
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];

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
          <span className="inline-flex mt-1.5 items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
            🌍 Universal
          </span>
        )}
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-neutral-900">{invoice.customer_name}</p>
        <p className="text-sm text-neutral-500">{invoice.customer_mobile}</p>
      </td>
      <td className="px-4 py-4 text-sm text-neutral-600">
        {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
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
        <span
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: statusConfig.bgColor,
            color: statusConfig.color,
          }}
        >
          {statusConfig.label}
        </span>
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
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={`/billing/${invoice.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {invoice.status !== "CANCELLED" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(invoice)}
            >
              <Download className="w-4 h-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// =====================================================
// Invoice Detail Panel (Zoho Split-Pane)
// =====================================================

function InvoiceDetailPanel({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status];

  // Fetch full invoice details with line items
  const { data: fullInvoice } = useQuery({
    queryKey: ["invoice", invoice.id],
    queryFn: () => billingApi.getInvoice(invoice.id),
    enabled: !!invoice.id,
  });

  // Fetch payments
  const { data: payments } = useQuery({
    queryKey: ["invoice-payments", invoice.id],
    queryFn: () => billingApi.getPayments(invoice.id),
    enabled: !!invoice.id,
  });

  const inv = fullInvoice || invoice;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[550px] bg-white shadow-2xl z-50 flex flex-col border-l border-neutral-200 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">
            {inv.invoice_number}
          </h2>
          <p className="text-sm text-neutral-500">{inv.customer_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/billing/${inv.id}`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Eye className="w-4 h-4" />}
            >
              Full View
            </Button>
          </Link>
          <Link href={`/billing/${inv.id}/edit`}>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Edit className="w-4 h-4" />}
            >
              Edit
            </Button>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-200 transition-colors text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Status + Amount Row */}
        <div className="flex items-center justify-between">
          <span
            className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{
              backgroundColor: statusConfig.bgColor,
              color: statusConfig.color,
            }}
          >
            {statusConfig.label}
          </span>
          <div className="text-right">
            <p className="text-2xl font-bold text-neutral-900">
              ₹{Number(inv.total_amount).toLocaleString("en-IN")}
            </p>
            <p
              className={`text-sm font-medium ${inv.balance_due > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {inv.balance_due > 0
                ? `₹${inv.balance_due.toLocaleString("en-IN")} due`
                : "Fully Paid"}
            </p>
          </div>
        </div>

        {/* Invoice Details Card */}
        <div className="bg-neutral-50 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider">
                Date
              </p>
              <p className="font-medium text-neutral-900">
                {format(new Date(inv.invoice_date), "dd MMM yyyy")}
              </p>
            </div>
            {inv.due_date && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider">
                  Due Date
                </p>
                <p className="font-medium text-neutral-900">
                  {format(new Date(inv.due_date), "dd MMM yyyy")}
                </p>
              </div>
            )}
            {inv.job_number && (
              <div>
                <p className="text-neutral-500 text-xs uppercase tracking-wider">
                  Job Reference
                </p>
                <p className="font-medium text-neutral-900">{inv.job_number}</p>
              </div>
            )}
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider">
                Customer
              </p>
              <p className="font-medium text-neutral-900">
                {inv.customer_name}
              </p>
              <p className="text-xs text-neutral-500">{inv.customer_mobile}</p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        {inv.line_items && inv.line_items.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Line Items
            </h4>
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500 uppercase">
                      Item
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-500 uppercase">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-500 uppercase">
                      Rate
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-neutral-500 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {inv.line_items.map((item: InvoiceLineItem, idx: number) => (
                    <tr key={idx}>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-neutral-900">
                          {item.description}
                        </p>
                        <span className="text-xs text-neutral-400">
                          {item.item_type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-neutral-600">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2.5 text-right text-neutral-600">
                        ₹{Number(item.unit_price).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium text-neutral-900">
                        ₹{Number(item.amount).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Totals */}
              <div className="bg-neutral-50 border-t border-neutral-200 px-3 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-medium">
                    ₹{Number(inv.subtotal).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Tax (GST)</span>
                  <span className="font-medium">
                    ₹{Number(inv.total_tax).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-neutral-300 pt-2 mt-1">
                  <span>Total</span>
                  <span>
                    ₹{Number(inv.total_amount).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment History */}
        {payments && payments.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Payments ({payments.length})
            </h4>
            <div className="space-y-2">
              {payments.map((payment: Payment, idx: number) => (
                <div
                  key={payment.id || idx}
                  className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-neutral-900">
                        ₹{Number(payment.amount).toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {format(new Date(payment.payment_date), "dd MMM yyyy")}{" "}
                        • {payment.payment_method}
                      </p>
                    </div>
                  </div>
                  {payment.reference && (
                    <span className="text-xs text-neutral-400">
                      Ref: {payment.reference}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {inv.notes && (
          <div>
            <h4 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-2">
              Notes
            </h4>
            <p className="text-sm text-neutral-600 bg-neutral-50 rounded-xl p-3">
              {inv.notes}
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center gap-3">
        <Link href={`/billing/${inv.id}`} className="flex-1">
          <Button
            variant="primary"
            className="w-full"
            leftIcon={<Eye className="w-4 h-4" />}
          >
            View Full Details
          </Button>
        </Link>
        {inv.status !== "CANCELLED" && (
          <Button
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={async () => {
              try {
                await billingApi.logDownload(inv.id);
                await billingApi.downloadPdf(inv.id, inv.invoice_number);
              } catch (e) {
                console.error(e);
              }
            }}
          >
            PDF
          </Button>
        )}
      </div>
    </div>
  );
}

// =====================================================
// Main Billing Page
// =====================================================

export default function BillingPage() {
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

  const invoices = data?.results || [];

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
      await billingApi.downloadPdf(invoice.id, invoice.invoice_number);
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

        <div className="p-6 space-y-6">
          {/* Payment Summary Banner */}
          <PaymentSummaryBanner stats={stats} />

          {/* Universal Search + Status */}
          <Card padding="md">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by invoice number or customer..."
                  leftIcon={<Search className="w-5 h-5" />}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
              <div className="w-48">
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </Card>

          {/* Main Content Area */}
          <div className="flex gap-0 relative">
            {/* Invoices Table */}
            <div
              className={`flex-1 transition-all duration-300 ${selectedInvoice ? "mr-[550px]" : ""}`}
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
                          >
                            <input
                              type="text"
                              placeholder="Filter..."
                              value={customerInput}
                              onChange={(e) => setCustomerInput(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="block w-full px-2 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800 placeholder-neutral-400"
                            />
                          </SortableHeader>
                          <SortableHeader
                            label="Date"
                            field="invoice_date"
                            currentSort={sortField}
                            currentDir={sortDir}
                            onSort={handleSort}
                          >
                            <div className="flex gap-1">
                              <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="block w-full px-1.5 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800"
                                title="From date"
                              />
                              <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="block w-full px-1.5 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800"
                                title="To date"
                              />
                            </div>
                          </SortableHeader>
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

              {/* Pagination */}
              {(data?.previous || data?.next) && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-neutral-500">
                    Showing {(page - 1) * 10 + 1} to{" "}
                    {Math.min(page * 10, data?.count || 0)} of{" "}
                    {data?.count || 0}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!data?.previous}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!data?.next}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Detail Panel Overlay */}
            {selectedInvoice && (
              <>
                {/* Backdrop for mobile */}
                <div
                  className="fixed inset-0 bg-black/20 z-40 md:hidden"
                  onClick={() => setSelectedInvoice(null)}
                />
                <InvoiceDetailPanel
                  invoice={selectedInvoice}
                  onClose={() => setSelectedInvoice(null)}
                />
              </>
            )}
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
