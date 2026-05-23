"use client";

import React from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { PageShell, RecordLayout, WorkspaceSurface } from "@/components/shell";
import { Button, LoadingState, EmptyState, CardTitle } from "@/components/ui";
import { Purchase } from "@/types";

// =====================================================
// Helpers
// =====================================================

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(amount));

// =====================================================
// DetailRow — flat label/value pair
// =====================================================

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 dark:border-slate-700/60 last:border-0">
      <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className="text-sm text-neutral-900 dark:text-neutral-100 text-right">
        {value}
      </span>
    </div>
  );
}

// =====================================================
// Status badge — simple inline chip for purchase status
// =====================================================

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  PAID: {
    bg: "bg-green-100 dark:bg-green-500/10",
    text: "text-green-700 dark:text-green-400",
    label: "Paid",
  },
  PARTIAL: {
    bg: "bg-amber-100 dark:bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-400",
    label: "Partial",
  },
  PENDING: {
    bg: "bg-neutral-100 dark:bg-slate-700",
    text: "text-neutral-600 dark:text-slate-300",
    label: "Pending",
  },
  CANCELLED: {
    bg: "bg-red-100 dark:bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    label: "Cancelled",
  },
};

function PurchaseStatusChip({ status }: { status?: Purchase["status"] }) {
  if (!status) return <span className="text-sm text-neutral-400">—</span>;
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

// =====================================================
// Main Page Component
// =====================================================

export default function PurchaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const {
    data: purchase,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchasesApi.get(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error || !purchase) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <PageShell width="constrained">
            <EmptyState
              title="Purchase not found"
              description="The requested purchase could not be loaded."
              action={
                <Button
                  variant="ghost"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => router.push("/purchases")}
                >
                  Back to Purchases
                </Button>
              }
            />
          </PageShell>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header
          title="Purchase Details"
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push("/purchases")}
            >
              Purchases
            </Button>
          }
        />

        <PageShell width="constrained">
          <RecordLayout
            main={
              <WorkspaceSurface>
                {/* Table header */}
                <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-700/50 flex items-center gap-2 bg-neutral-50/50 dark:bg-transparent">
                  <CheckCircle2 className="w-5 h-5 text-primary-500 dark:text-emerald-500" />
                  <h3 className="font-semibold text-neutral-900 dark:text-slate-200">
                    Items Added to Stock
                  </h3>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 dark:bg-slate-900/50 text-neutral-500 dark:text-slate-400 text-sm border-b border-neutral-200 dark:border-transparent">
                        <th className="px-6 py-4 font-medium">Item Name</th>
                        <th className="px-6 py-4 font-medium text-right">
                          Quantity
                        </th>
                        <th className="px-6 py-4 font-medium text-right">
                          Unit Price
                        </th>
                        <th className="px-6 py-4 font-medium text-right">
                          Total Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-slate-700/50 text-neutral-700 dark:text-slate-300 bg-white dark:bg-transparent">
                      {purchase.items?.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-8 text-center text-neutral-500 dark:text-slate-500"
                          >
                            No items found in this purchase.
                          </td>
                        </tr>
                      ) : (
                        purchase.items?.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-neutral-50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <p className="font-medium text-neutral-900 dark:text-slate-200">
                                {item.item_name}
                              </p>
                              {item.sku && (
                                <p className="text-xs text-neutral-500 dark:text-slate-500 mt-1">
                                  SKU: {item.sku}
                                </p>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center justify-center px-2.5 py-1 text-sm font-medium bg-primary-50 dark:bg-emerald-500/10 text-primary-700 dark:text-emerald-400 rounded-full border border-primary-100 dark:border-emerald-500/20">
                                +{item.quantity}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {formatCurrency(item.unit_price)}
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-neutral-900 dark:text-slate-200">
                              {formatCurrency(item.total_price)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </WorkspaceSurface>
            }
            sidebar={
              <WorkspaceSurface>
                <div className="px-4 py-3 border-b border-neutral-100 dark:border-slate-700/50">
                  <CardTitle>Purchase Info</CardTitle>
                </div>
                <div className="px-4 py-3">
                  <DetailRow label="Vendor" value={purchase.vendor_name} />
                  <DetailRow
                    label="Invoice #"
                    value={purchase.invoice_number || "—"}
                  />
                  <DetailRow
                    label="Date"
                    value={new Date(purchase.purchase_date).toLocaleDateString(
                      "en-IN",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  />
                  <DetailRow
                    label="Total Amount"
                    value={
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(purchase.total_amount)}
                      </span>
                    }
                  />
                  <DetailRow
                    label="Status"
                    value={<PurchaseStatusChip status={purchase.status} />}
                  />
                </div>
              </WorkspaceSurface>
            }
          />
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
