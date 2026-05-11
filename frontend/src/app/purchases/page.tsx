"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, FileText, ChevronRight, Calculator } from "lucide-react";
import { purchasesApi } from "@/lib/api/services";
import { formatDateLong } from "@/lib/formatters";
import { useAuth, ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useToast } from "@/context/ToastContext";
import { Button, EmptyState, Input, LoadingState } from "@/components/ui";
import { EntityTable, PageShell, RegisterToolbar } from "@/components/shell";
import type { Purchase } from "@/types";

export default function PurchasesPage() {
  const router = useRouter();
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");

  const searchParam = useMemo(
    () => (search.length > 2 ? search : undefined),
    [search],
  );

  const errorToastRef = React.useRef(false);

  const {
    data: purchases = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["purchases", "register", currentBranch?.id, searchParam ?? ""],
    queryFn: async () => {
      const response = await purchasesApi.list({
        branch: currentBranch!.id,
        search: searchParam,
      });
      return response.results;
    },
    enabled: !!currentBranch,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (isError && !errorToastRef.current) {
      errorToastRef.current = true;
      toast.error("Failed to load purchases. Please try again.");
    }
    if (!isError) errorToastRef.current = false;
  }, [isError, toast]);

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(amount));
  };

  const showInitialLoading = !currentBranch || (isLoading && purchases.length === 0);

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header
          title="Purchase History"
          subtitle="Track inbound inventory, vendor bills, and historical costs."
          actions={
            <Button
              type="button"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => router.push("/purchases/new")}
            >
              Add New Purchase
            </Button>
          }
        />

        <PageShell width="fluid" className="font-sans">
          <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/40">
            <RegisterToolbar
              search={
                <Input
                  type="text"
                  placeholder="Search by vendor name or invoice number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  leftIcon={<Search className="h-5 w-5" />}
                  aria-label="Search purchases"
                  className="text-sm dark:bg-slate-900/60"
                />
              }
              secondaryActions={
                isFetching && !isLoading ? (
                  <span className="text-xs text-neutral-500 dark:text-slate-400">Updating…</span>
                ) : null
              }
            />
          </div>

          <EntityTable
            loading={showInitialLoading}
            loadingSlot={<LoadingState />}
            empty={!showInitialLoading && !isError && purchases.length === 0}
            emptySlot={
              <EmptyState
                icon={<FileText className="h-8 w-8 text-neutral-400" />}
                title="No purchases found"
                description={
                  search
                    ? "Try adjusting your search terms."
                    : "You haven't added any vendor purchases yet."
                }
              />
            }
          >
            {isError ? (
              <div className="rounded-xl border border-neutral-200 p-8 dark:border-slate-800">
                <EmptyState
                  icon={<FileText className="h-8 w-8 text-neutral-400" />}
                  title="Couldn’t load purchases"
                  description="Check your connection and try again."
                  action={
                    <Button type="button" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  }
                />
              </div>
            ) : showInitialLoading || purchases.length === 0 ? null : (
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                    <th scope="col" className="px-3 py-2">Vendor</th>
                    <th scope="col" className="hidden px-3 py-2 sm:table-cell">Invoice</th>
                    <th scope="col" className="px-3 py-2">Date</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                    <th scope="col" className="px-3 py-2 text-right">Total</th>
                    <th scope="col" className="hidden px-3 py-2 text-right md:table-cell">Balance</th>
                    <th scope="col" className="w-10 px-2 py-2" aria-label="Open" />
                  </tr>
                </thead>
                <tbody className="text-neutral-800 dark:text-slate-200">
                  {purchases.map((purchase: Purchase) => {
                    const balance = parseFloat(String(purchase.balance_due));
                    const statusCls =
                      purchase.status === "PAID"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : purchase.status === "PARTIAL"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                          : purchase.status === "CANCELLED"
                            ? "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300";
                    const go = () => router.push(`/purchases/${purchase.id}`);
                    return (
                      <tr
                        key={purchase.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                        onClick={go}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            go();
                          }
                        }}
                      >
                        <td className="max-w-[200px] px-3 py-2 align-middle">
                          <span className="block truncate font-medium text-neutral-900 dark:text-white">
                            {purchase.vendor_name}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500 sm:hidden dark:text-slate-400">
                            <Calculator className="h-3 w-3 shrink-0 opacity-70" />
                            {purchase.invoice_number || "—"}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 align-middle text-neutral-600 dark:text-slate-400 sm:table-cell">
                          {purchase.invoice_number || "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-middle tabular-nums text-neutral-600 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Calculator className="hidden h-3.5 w-3.5 opacity-60 sm:inline" aria-hidden />
                            {formatDateLong(purchase.purchase_date)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusCls}`}>
                            {purchase.status || "UNPAID"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-middle font-semibold tabular-nums">
                          {formatCurrency(purchase.total_amount)}
                        </td>
                        <td className="hidden px-3 py-2 text-right align-middle md:table-cell">
                          {balance > 0 ? (
                            <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                              {formatCurrency(purchase.balance_due || 0)}
                            </span>
                          ) : (
                            <span className="text-neutral-400 dark:text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 align-middle text-neutral-400 dark:text-slate-500">
                          <ChevronRight className="mx-auto h-4 w-4" aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </EntityTable>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
