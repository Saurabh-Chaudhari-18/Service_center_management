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
  Modal,
  LoadingState,
  EmptyState,
  Badge,
} from "@/components/ui";
import { customersApi } from "@/lib/api";
import { CustomerCreateForm } from "./CustomerCreateForm";
import {
  Plus,
  Search,
  Users,
  Phone,
  Mail,
  MapPin,
  FileText,
} from "lucide-react";
import Link from "next/link";
import type { Customer } from "@/types";
import { formatPhone } from "@/lib/formatters";

// =====================================================
// Customer Card Component
// =====================================================

interface CustomerCardProps {
  customer: Customer;
  onViewDetails: (customer: Customer) => void;
}

function CustomerCard({ customer, onViewDetails }: CustomerCardProps) {
  return (
    <div
      onClick={() => onViewDetails(customer)}
      className="p-5 bg-white border border-neutral-100 rounded-xl hover:border-primary-200 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center text-lg font-medium flex-shrink-0">
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
    </div>
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
// Customer Details Modal
// =====================================================

interface CustomerDetailsModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

function CustomerDetailsModal({
  customer,
  isOpen,
  onClose,
}: CustomerDetailsModalProps) {
  const { data: serviceHistory } = useQuery({
    queryKey: ["customer-history", customer?.id],
    queryFn: () => customersApi.getServiceHistory(customer!.id),
    enabled: !!customer?.id && isOpen,
  });

  if (!customer) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customer Details" size="xl">
      <div className="space-y-6">
        {/* Customer Info */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center text-2xl font-medium">
            {customer.first_name?.[0] || "?"}
            {customer.last_name?.[0]}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-neutral-900">
              {customer.first_name} {customer.last_name}
            </h2>
            <div className="mt-2 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-neutral-500">Mobile</p>
                <p className="font-medium">{formatPhone(customer.mobile)}</p>
              </div>
              {customer.email && (
                <div>
                  <p className="text-sm text-neutral-500">Email</p>
                  <p className="font-medium">{customer.email}</p>
                </div>
              )}
              {customer.city && (
                <div>
                  <p className="text-sm text-neutral-500">Location</p>
                  <p className="font-medium">
                    {customer.city}, {customer.state} - {customer.pincode}
                  </p>
                </div>
              )}
              {customer.total_spent && (
                <div>
                  <p className="text-sm text-neutral-500">Total Spent</p>
                  <p className="font-medium text-green-600">
                    ₹{customer.total_spent.toLocaleString("en-IN")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service History */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            Service History
          </h3>
          {serviceHistory && serviceHistory.length > 0 ? (
            <div className="space-y-2">
              {serviceHistory.slice(0, 5).map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="block p-3 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm font-medium">
                        {job.job_number}
                      </span>
                      <span className="text-neutral-500 mx-2">•</span>
                      <span className="text-sm text-neutral-600">
                        {job.brand} {job.model}
                      </span>
                    </div>
                    <Badge
                      variant={
                        job.status === "DELIVERED"
                          ? "success"
                          : job.status === "CANCELLED"
                            ? "danger"
                            : "default"
                      }
                      size="sm"
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-neutral-500 mt-1 line-clamp-1">
                    {job.customer_complaint}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-neutral-500 text-center py-4">
              No service history found
            </p>
          )}
        </div>
      </div>
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

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

        <div className="p-6 space-y-6">
          {/* Search */}
          <Card padding="md">
            <Input
              placeholder="Search by name or mobile number..."
              leftIcon={<Search className="w-5 h-5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Card>

          {/* Customer List */}
          {isLoading ? (
            <LoadingState />
          ) : customers.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users className="w-8 h-8 text-neutral-400" />}
                title="No customers found"
                description={
                  search
                    ? "Try a different search term"
                    : "Add your first customer to get started"
                }
                action={
                  !search && (
                    <Button
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => setShowAddModal(true)}
                    >
                      Add Customer
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onViewDetails={setSelectedCustomer}
                />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {currentBranch && (
          <AddCustomerModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            branchId={currentBranch.id}
          />
        )}

        <CustomerDetailsModal
          customer={selectedCustomer}
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
