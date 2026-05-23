"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { PageShell, RegisterToolbar, WorkspaceSurface } from "@/components/shell";
import { customersApi } from "@/lib/api";
import { CustomerCreateForm } from "./CustomerCreateForm";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import type { Customer } from "@/types";
import { formatPhone } from "@/lib/formatters";

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
          <h3 className="font-medium text-neutral-900 truncate flex items-center gap-2">
            {customer.first_name} {customer.last_name}
            {!customer.branch_name && (
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-600 text-white rounded-full">
                🌍 Universal
              </span>
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
        <div className="text-right">
          {customer.pending_jobs_count && customer.pending_jobs_count > 0 && (
            <Badge variant="warning">
              {customer.pending_jobs_count} pending
            </Badge>
          )}
          <p className="text-xs text-neutral-400 mt-2">
            {customer.created_at
              ? `Since ${new Date(customer.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`
              : "Recently joined"}
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

export default function CustomersPage() {
  const { currentBranch } = useAuth();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customers", currentBranch?.id, search],
    queryFn: () =>
      customersApi.list({
        branch: currentBranch?.id,
        search: search || undefined,
      }),
    enabled: !!currentBranch,
  });

  const customers = data?.results || [];

  return (
    <ProtectedRoute requiredRoles={["OWNER", "MANAGER", "RECEPTIONIST"]}>
      <AppLayout>
        <Header
          title="Customers"
          subtitle={`${data?.count || 0} total customers`}
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
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search customers"
                className="py-3 text-sm"
              />
            }
          />

          <WorkspaceSurface>
            {isLoading ? (
              <div className="p-8">
                <LoadingState />
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
              <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-6">
                {customers.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} />
                ))}
              </div>
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
