"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Button,
  Input,
  Modal,
  LoadingState,
  EmptyState,
  Badge,
} from "@/components/ui";
import { PageShell, RegisterToolbar, WorkspaceSurface, PaginationFooter } from "@/components/shell";
import { customersApi } from "@/lib/api";
import { CustomerCreateForm } from "./CustomerCreateForm";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { Customer } from "@/types";
import { formatDateLong, formatPhone } from "@/lib/formatters";

// =====================================================
// Customer Card Component
// =====================================================

interface CustomerCardProps {
  customer: Customer;
}

function CustomerCard({ customer }: CustomerCardProps) {
  return (
    <Link
      href={`/customers/${customer.id}`}
      className="block p-5 bg-white dark:bg-slate-800 border border-neutral-100 dark:border-slate-700 rounded-xl hover:border-primary-200 dark:hover:border-primary-700 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center text-lg font-medium flex-shrink-0 dark:text-white">
          {customer.first_name?.[0] || "?"}
          {customer.last_name?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-2">
            {customer.first_name} {customer.last_name}
            {!customer.branch_name && (
              <Badge size="sm" variant="default" className="bg-purple-600 text-white font-semibold">
                Universal
              </Badge>
            )}
          </h3>
          <div className="mt-1 space-y-1">
            <p className="text-sm text-neutral-500 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5" />
              {formatPhone(customer.mobile)}
            </p>
            {customer.email && (
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {customer.email}
              </p>
            )}
            {customer.city && (
              <p className="text-sm text-neutral-500 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                {customer.city}, {customer.state}
              </p>
            )}
          </div>
        </div>
        <div className="text-left sm:text-right sm:ml-auto shrink-0">
          {customer.pending_jobs_count && customer.pending_jobs_count > 0 && (
            <Badge variant="warning">
              {customer.pending_jobs_count} pending
            </Badge>
          )}
          <p className="text-xs text-neutral-400 mt-2 whitespace-nowrap">
            {customer.created_at ? `Since ${formatDateLong(customer.created_at)}` : "Recently joined"}
          </p>
        </div>
      </div>
    </Link>
  );
}

// =====================================================
// Add Customer Modal
// =====================================================

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

function AddCustomerModal({
  isOpen,
  onClose,
  branchId,
}: AddCustomerModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Customer" size="lg">
      <CustomerCreateForm
        initialBranchId={branchId}
        onSuccess={onClose}
        actionsMode="modal"
        onCancel={onClose}
      />
    </Modal>
  );
}

// =====================================================
// Main Customers Page
// =====================================================

const PAGE_SIZE = 25;

export default function CustomersPage() {
  const { currentBranch } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["customers", currentBranch?.id, search, page],
    queryFn: () =>
      customersApi.list({
        branch: currentBranch?.id,
        search: search || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: !!currentBranch,
  });

  const customers = data?.results || [];
  const totalCount = data?.count ?? 0;

  return (
    <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
      <AppLayout>
        <Header
          title="Customers"
          subtitle={totalCount > 0 ? `${totalCount.toLocaleString()} customers` : "No customers yet"}
          actions={
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Add Customer
            </Button>
          }
        />

        <PageShell width="fluid">
          <RegisterToolbar
            search={
              <Input
                placeholder="Search by name or mobile number..."
                leftIcon={<Search className="h-5 w-5" />}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search customers"
                className="py-3 text-sm"
              />
            }
          />

          <WorkspaceSurface>
            {isLoading ? (
              <div className="p-8">
                <LoadingState message="Loading customers…" />
              </div>
            ) : customers.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Users className="h-8 w-8 text-neutral-400" />}
                  title="No customers found"
                  description={
                    search
                      ? "Try a different search term"
                      : "Add your first customer to get started"
                  }
                  action={
                    !search && (
                      <Button
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => setShowAddModal(true)}
                      >
                        Add Customer
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <>
                {/* Desktop table — lg+ */}
                <div className="hidden lg:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                        <th scope="col" className="px-4 py-3">Customer</th>
                        <th scope="col" className="px-4 py-3">Mobile</th>
                        <th scope="col" className="px-4 py-3">Email</th>
                        <th scope="col" className="px-4 py-3">Location</th>
                        <th scope="col" className="px-4 py-3">Member Since</th>
                        <th scope="col" className="px-4 py-3 text-center">Pending</th>
                        <th scope="col" className="w-8 px-2 py-3" aria-label="Open" />
                      </tr>
                    </thead>
                    <tbody className="text-neutral-800 dark:text-slate-200">
                      {customers.map((customer) => (
                        <tr
                          key={customer.id}
                          className="cursor-pointer border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50 dark:border-slate-800/80 dark:hover:bg-slate-800/40"
                          onClick={() => router.push(`/customers/${customer.id}`)}
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-xs font-semibold text-white">
                                {customer.first_name?.[0]}{customer.last_name?.[0]}
                              </div>
                              <span className="font-medium text-neutral-900 dark:text-white">
                                {customer.first_name} {customer.last_name}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 align-middle tabular-nums text-neutral-600 dark:text-slate-400">
                            {formatPhone(customer.mobile)}
                          </td>
                          <td className="max-w-[180px] truncate px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">
                            {customer.email || "—"}
                          </td>
                          <td className="px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">
                            {[customer.city, customer.state].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-500 dark:text-slate-500">
                            {customer.created_at
                              ? new Date(customer.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-center align-middle">
                            {customer.pending_jobs_count && customer.pending_jobs_count > 0 ? (
                              <span className="inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                {customer.pending_jobs_count}
                              </span>
                            ) : (
                              <span className="text-neutral-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-2 py-3 align-middle">
                            <ChevronRight className="h-4 w-4 text-neutral-300 dark:text-slate-600" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards — below lg */}
                <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:hidden">
                  {customers.map((customer) => (
                    <CustomerCard key={customer.id} customer={customer} />
                  ))}
                </div>

                {/* Pagination */}
                {totalCount > PAGE_SIZE && (
                  <PaginationFooter
                    page={page}
                    pageSize={PAGE_SIZE}
                    totalCount={totalCount}
                    onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => p + 1)}
                  />
                )}
              </>
            )}
          </WorkspaceSurface>
        </PageShell>

        {/* Modals */}
        {currentBranch && (
          <AddCustomerModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            branchId={currentBranch.id}
          />
        )}

      </AppLayout>
    </ProtectedRoute>
  );
}
