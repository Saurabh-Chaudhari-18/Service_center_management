"use client";

import React, { useState } from "react";
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
import { format } from "date-fns";
import type { Invoice, InvoiceStatus } from "@/types";

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", currentBranch?.id, search, statusFilter, page],
    queryFn: () =>
      billingApi.listInvoices({
        branch: currentBranch?.id,
        status: statusFilter || undefined,
        page,
      }),
    enabled: !!currentBranch,
  });

  const { data: stats } = useQuery({
    queryKey: ["invoice-stats", currentBranch?.id],
    queryFn: () => billingApi.getStats(),
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

          {/* Filters */}
          <Card padding="md">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by invoice number or customer..."
                  leftIcon={<Search className="w-5 h-5" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                  search || statusFilter
                    ? "Try adjusting your search or filter"
                    : "Create your first invoice"
                }
                action={
                  !search &&
                  !statusFilter && (
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
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Date
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
