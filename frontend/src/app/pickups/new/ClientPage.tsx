"use client";

// Focused interactive island below the server route boundary.

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, Select, Input, Textarea, Checkbox } from "@/components/ui";
import { PageShell } from "@/components/shell";
import { pickupsApi, customersApi } from "@/lib/api";
import { NewCustomerModal } from "@/components/customers/NewCustomerModal";
import type { Customer } from "@/types";
import { formatPhone } from "@/lib/formatters";
import {
  ArrowLeft,
  Save,
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  AlertTriangle,
  Truck,
  Plus,
} from "lucide-react";
// =====================================================
// Device Types
// =====================================================

const DEVICE_TYPES = [
  { value: "LAPTOP", label: "Laptop" },
  { value: "DESKTOP", label: "Desktop" },
  { value: "ALL_IN_ONE", label: "All-in-One" },
  { value: "MONITOR", label: "Monitor" },
  { value: "PRINTER", label: "Printer" },
  { value: "UPS", label: "UPS" },
  { value: "OTHER", label: "Other" },
];

const TIME_SLOTS = [
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
];

// =====================================================
// Main Page
// =====================================================

export default function NewPickupPage() {
  const router = useRouter();
  const { currentBranch } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    device_type: "LAPTOP",
    brand: "",
    model_name: "",
    customer_complaint: "",
    pickup_address: "",
    pickup_date: "",
    pickup_time_slot: "",
    contact_number: "",
    notes: "",
    is_urgent: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof pickupsApi.create>[0]) =>
      pickupsApi.create(data),
    onSuccess: (result) => {
      router.push(`/pickups/${result.id}`);
    },
    onError: (
      err: Error & { response?: { data?: Record<string, string[]> } },
    ) => {
      const detail = err?.response?.data;
      if (detail) {
        const messages = Object.entries(detail)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
          .join("; ");
        setError(messages);
      } else {
        setError(err.message || "Failed to create pickup request");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedCustomer) {
      setError("Please select a customer");
      return;
    }
    if (!form.customer_complaint.trim()) {
      setError("Please describe the customer complaint");
      return;
    }
    if (!form.pickup_address.trim()) {
      setError("Pickup address is required");
      return;
    }
    if (!form.pickup_date) {
      setError("Pickup date is required");
      return;
    }
    if (!form.contact_number.trim()) {
      setError("Contact number is required");
      return;
    }

    createMutation.mutate({
      branch: currentBranch?.id || "",
      customer_id: selectedCustomer.id,
      ...form,
    });
  };

  const handleSelectCustomer = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      if (customer.mobile && !form.contact_number) {
        setForm((f) => ({ ...f, contact_number: customer.mobile }));
      }
      const fullAddress = [customer.address_line1, customer.address_line2]
        .filter(Boolean)
        .join(", ");
      if (fullAddress && !form.pickup_address) {
        setForm((f) => ({ ...f, pickup_address: fullAddress }));
      }
    }
  };

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title="New Pickup Request"
          subtitle="Create a pickup request from a customer call"
          breadcrumbs={[
            { label: "Pickups", href: "/pickups" },
            { label: "New Request" },
          ]}
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push("/pickups")}
            >
              Back
            </Button>
          }
        />

        <PageShell width="wizard">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Customer Selection */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-500" />
                Customer Details
              </h3>

              <CustomerSearch
                selectedCustomer={selectedCustomer}
                onSelect={handleSelectCustomer}
                branchId={currentBranch?.id || ""}
              />
            </Card>

            {/* Device Info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-500" />
                Device Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Select
                    label="Device Type"
                    value={form.device_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, device_type: e.target.value }))
                    }
                    options={DEVICE_TYPES}
                  />
                </div>

                <Input
                  label="Brand"
                    type="text"
                    value={form.brand}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, brand: e.target.value }))
                    }
                    placeholder="e.g. Dell, HP, Lenovo"
                />

                <Input
                  label="Model"
                    type="text"
                    value={form.model_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, model_name: e.target.value }))
                    }
                    placeholder="e.g. Inspiron 15"
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Customer Complaint / Issue"
                  value={form.customer_complaint}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customer_complaint: e.target.value,
                    }))
                  }
                  placeholder="Describe the issue reported by the customer on the call..."
                  required
                />
              </div>
            </Card>

            {/* Pickup Details */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                Pickup Details
              </h3>

              <div className="space-y-4">
                <Textarea
                  label="Pickup Address"
                    value={form.pickup_address}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pickup_address: e.target.value,
                      }))
                    }
                    placeholder="Full pickup address..."
                    required
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Pickup Date"
                    leftIcon={<Calendar className="h-4 w-4" />}
                      type="date"
                      value={form.pickup_date}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pickup_date: e.target.value,
                        }))
                      }
                      required
                  />

                  <div>
                    <Select
                      value={form.pickup_time_slot}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pickup_time_slot: e.target.value,
                        }))
                      }
                      options={TIME_SLOTS.map((ts) => ({ value: ts, label: ts }))}
                      placeholder="Select time slot"
                    />
                  </div>

                  <Input
                    label="Contact Number"
                    leftIcon={<Phone className="h-4 w-4" />}
                      type="tel"
                      value={form.contact_number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contact_number: e.target.value,
                        }))
                      }
                      placeholder="Phone number for pickup"
                      required
                  />
                </div>
              </div>
            </Card>

            {/* Notes & Priority */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Additional Details
              </h3>

              <div className="space-y-4">
                <Textarea
                  label="Internal Notes"
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Any additional notes..."
                />

                <Checkbox
                  checked={form.is_urgent}
                  onChange={(e) => setForm((f) => ({ ...f, is_urgent: e.target.checked }))}
                  label={<span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" />Mark as Urgent / Priority Pickup</span>}
                />
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => router.push("/pickups")}>
                Cancel
              </Button>
              <Button
                type="submit"
                leftIcon={<Save className="w-4 h-4" />}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending
                  ? "Creating..."
                  : "Create Pickup Request"}
              </Button>
            </div>
          </form>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}


// =====================================================
// Customer Search Helper Component (shared with job form)
// =====================================================

interface CustomerSearchProps {
  onSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
  branchId: string;
}

function CustomerSearch({
  onSelect,
  selectedCustomer,
  branchId,
}: CustomerSearchProps) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-search-pickup", search, branchId],
    queryFn: () =>
      customersApi.list({ search, branch: branchId }).then((res) => res.results || []),
    enabled: search.trim().length >= 2,
  });

  const customers = data || [];

  if (selectedCustomer) {
    return (
      <div className="p-4 border border-primary-200 bg-primary-50 rounded-xl transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-medium shrink-0 shadow-sm">
              {selectedCustomer.first_name[0]}
              {selectedCustomer.last_name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-neutral-900">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </p>
              <p className="text-sm text-neutral-600 flex items-center gap-1 font-medium">
                <Phone className="w-3.5 h-3.5" />
                {formatPhone(selectedCustomer.mobile)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Input
          placeholder="Search by name or mobile..."
          leftIcon={<Search className="w-5 h-5 text-neutral-400" />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="bg-white"
        />

        {showResults && search.trim().length >= 2 && (
          <div className="customer-search-dropdown absolute z-50 w-full bg-white mt-1 border border-neutral-200 rounded-lg shadow-xl max-h-60 overflow-y-auto ring-1 ring-black/5">
            {isLoading ? (
              <div className="p-4 text-center text-neutral-500 text-sm">
                Searching...
              </div>
            ) : customers.length > 0 ? (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 text-left transition-colors border-b border-neutral-100 last:border-0 group"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(customer);
                    setShowResults(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 group-hover:bg-primary-100 group-hover:text-primary-700 flex items-center justify-center text-sm font-semibold shrink-0 transition-colors">
                    {customer.first_name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900 text-sm">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {formatPhone(customer.mobile)} · {customer.city || "—"}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-neutral-500 mb-2">No customer found for &quot;{search}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-neutral-500 pl-1">
        Type at least 2 characters to search existing clients
      </p>

      <button
        type="button"
        onClick={() => setShowNewCustomerModal(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border-2 border-dashed border-primary-200 text-primary-600 hover:bg-primary-50 hover:border-primary-400 transition-all text-sm font-semibold bg-white"
      >
        <Plus className="w-4 h-4" />
        Register New Customer
      </button>

      <NewCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onCustomerCreated={(customer) => {
          onSelect(customer);
          setShowNewCustomerModal(false);
        }}
        branchId={branchId}
        initialMobile={search}
      />
    </div>
  );
}
