"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, Select } from "@/components/ui";
import { pickupsApi, customersApi } from "@/lib/api";
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
} from "lucide-react";
import Link from "next/link";

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
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<{
    id: string;
    name: string;
    mobile: string;
    address?: string;
  } | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
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

  // Search customers
  const { data: customerResults } = useQuery({
    queryKey: ["customer-search", customerSearch],
    queryFn: () => customersApi.list({ search: customerSearch, page: 1 }),
    enabled: customerSearch.length >= 2,
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

  const selectCustomer = (customer: {
    id: string;
    first_name: string;
    last_name: string;
    mobile: string;
    address?: string;
  }) => {
    setSelectedCustomer({
      id: customer.id,
      name: `${customer.first_name} ${customer.last_name}`,
      mobile: customer.mobile,
      address: customer.address,
    });
    setCustomerSearch("");
    setShowCustomerDropdown(false);
    if (customer.mobile && !form.contact_number) {
      setForm((f) => ({ ...f, contact_number: customer.mobile }));
    }
    if (customer.address && !form.pickup_address) {
      setForm((f) => ({ ...f, pickup_address: customer.address || "" }));
    }
  };

  const inputClasses =
    "w-full px-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all";
  const labelClasses = "block text-sm font-medium text-neutral-700 mb-1.5";

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title="New Pickup Request"
          subtitle="Create a pickup request from a customer call"
          actions={
            <Link href="/pickups">
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            </Link>
          }
        />

        <div className="p-6 max-w-4xl mx-auto">
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

              {selectedCustomer ? (
                <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg border border-primary-200">
                  <div>
                    <p className="font-medium text-neutral-900">
                      {selectedCustomer.name}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {selectedCustomer.mobile}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search customer by name or mobile..."
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  {showCustomerDropdown &&
                    customerResults?.results &&
                    customerResults.results.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {customerResults.results.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className="w-full text-left px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                          >
                            <p className="font-medium text-neutral-900 text-sm">
                              {c.first_name} {c.last_name}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {c.mobile}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
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

                <div>
                  <label className={labelClasses}>Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, brand: e.target.value }))
                    }
                    placeholder="e.g. Dell, HP, Lenovo"
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className={labelClasses}>Model</label>
                  <input
                    type="text"
                    value={form.model_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, model_name: e.target.value }))
                    }
                    placeholder="e.g. Inspiron 15"
                    className={inputClasses}
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className={labelClasses}>
                  Customer Complaint / Issue *
                </label>
                <textarea
                  value={form.customer_complaint}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      customer_complaint: e.target.value,
                    }))
                  }
                  placeholder="Describe the issue reported by the customer on the call..."
                  className={`${inputClasses} min-h-[100px] resize-y`}
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
                <div>
                  <label className={labelClasses}>Pickup Address *</label>
                  <textarea
                    value={form.pickup_address}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        pickup_address: e.target.value,
                      }))
                    }
                    placeholder="Full pickup address..."
                    className={`${inputClasses} min-h-[80px] resize-y`}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClasses}>
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Pickup Date *
                    </label>
                    <input
                      type="date"
                      value={form.pickup_date}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          pickup_date: e.target.value,
                        }))
                      }
                      className={inputClasses}
                      required
                    />
                  </div>

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

                  <div>
                    <label className={labelClasses}>
                      <Phone className="w-4 h-4 inline mr-1" />
                      Contact Number *
                    </label>
                    <input
                      type="tel"
                      value={form.contact_number}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          contact_number: e.target.value,
                        }))
                      }
                      placeholder="Phone number for pickup"
                      className={inputClasses}
                      required
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Notes & Priority */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Additional Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className={labelClasses}>Internal Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value }))
                    }
                    placeholder="Any additional notes..."
                    className={`${inputClasses} min-h-[80px] resize-y`}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_urgent}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          is_urgent: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-red-500 border-neutral-300 rounded focus:ring-red-500"
                    />
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-medium text-neutral-700">
                      Mark as Urgent / Priority Pickup
                    </span>
                  </label>
                </div>
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Link href="/pickups">
                <Button variant="ghost">Cancel</Button>
              </Link>
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
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
