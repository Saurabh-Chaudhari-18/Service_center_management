"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import type { Invoice, InvoiceStatus } from "@/types";

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
// Invoice Row Component
// =====================================================

interface InvoiceRowProps {
  invoice: Invoice;
  onDownload: (invoice: Invoice) => void;
}

function InvoiceRow({ invoice, onDownload }: InvoiceRowProps) {
  return (
    <tr className="hover:bg-neutral-50">
      <td className="px-4 py-4">
        <Link
          href={`/billing/${invoice.id}`}
          className="font-mono text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {invoice.invoice_number}
        </Link>
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-neutral-900">{invoice.customer_name}</p>
        <p className="text-sm text-neutral-500">{invoice.customer_mobile}</p>
      </td>
      <td className="px-4 py-4 text-sm text-neutral-600">
        {format(new Date(invoice.invoice_date), "MMM dd, yyyy")}
      </td>
      <td className="px-4 py-4">
        <p className="font-medium text-neutral-900">
          ₹{invoice.total_amount.toLocaleString("en-IN")}
        </p>
        <p className="text-xs text-neutral-500">
          Tax: ₹{invoice.total_tax.toLocaleString("en-IN")}
        </p>
      </td>
      <td className="px-4 py-4">
        <InvoiceStatusBadge status={invoice.status} />
      </td>
      <td className="px-4 py-4">
        <p
          className={`font-medium ${
            invoice.balance_due > 0 ? "text-red-600" : "text-green-600"
          }`}
        >
          ₹{invoice.balance_due.toLocaleString("en-IN")}
        </p>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Link href={`/billing/${invoice.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {invoice.is_finalized && (
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
// Main Billing Page
// =====================================================

export default function BillingPage() {
  const { currentBranch } = useAuth();

  // Read initial status from URL (e.g. /billing?status=PENDING)
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || "";

  // Local input state (updates instantly as user types)
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [customerInput, setCustomerInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Debounced values (used for API queries, with delay)
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
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatsCard
              label="Total Invoiced"
              value={`₹${(stats?.total_invoiced || 0).toLocaleString("en-IN")}`}
              icon={<Receipt className="w-6 h-6 text-primary-600" />}
              variant="primary"
            />
            <StatsCard
              label="Total Collected"
              value={`₹${(stats?.total_paid || 0).toLocaleString("en-IN")}`}
              icon={<CheckCircle className="w-6 h-6 text-green-600" />}
              variant="success"
            />
            <StatsCard
              label="Pending"
              value={`₹${(stats?.total_pending || 0).toLocaleString("en-IN")}`}
              icon={<Clock className="w-6 h-6 text-amber-600" />}
              variant="warning"
            />
            <StatsCard
              label="Invoice Count"
              value={stats?.invoice_count || 0}
              icon={<FileText className="w-6 h-6 text-blue-600" />}
              variant="accent"
            />
          </div>

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

          {/* Invoices Table */}
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        <div className="space-y-1.5">
                          <span>Customer</span>
                          <input
                            type="text"
                            placeholder="Filter..."
                            value={customerInput}
                            onChange={(e) => setCustomerInput(e.target.value)}
                            className="block w-full px-2 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800 placeholder-neutral-400"
                          />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        <div className="space-y-1.5">
                          <span>Date</span>
                          <div className="flex gap-1">
                            <input
                              type="date"
                              value={dateFrom}
                              onChange={(e) => setDateFrom(e.target.value)}
                              className="block w-full px-1.5 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800"
                              title="From date"
                            />
                            <input
                              type="date"
                              value={dateTo}
                              onChange={(e) => setDateTo(e.target.value)}
                              className="block w-full px-1.5 py-1 text-xs font-normal border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-400 focus:border-primary-400 bg-white text-neutral-800"
                              title="To date"
                            />
                          </div>
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Balance
                      </th>
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
                    {invoices.map((invoice) => (
                      <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-500">
                Showing {(page - 1) * 10 + 1} to{" "}
                {Math.min(page * 10, data?.count || 0)} of {data?.count || 0}
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
      </AppLayout>
    </ProtectedRoute>
  );
}
