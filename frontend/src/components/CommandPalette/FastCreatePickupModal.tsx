"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Select, Card } from "@/components/ui";
import { pickupsApi, customersApi } from "@/lib/api";
import { Search, User } from "lucide-react";

interface FastCreatePickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

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

export function FastCreatePickupModal({
  isOpen,
  onClose,
  branchId,
}: FastCreatePickupModalProps) {
  const queryClient = useQueryClient();
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

  const { data: customerResults } = useQuery({
    queryKey: ["customer-search-modal", customerSearch],
    queryFn: () => customersApi.list({ search: customerSearch, page: 1 }),
    enabled: customerSearch.length >= 2 && isOpen,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: Parameters<typeof pickupsApi.create>[0]) =>
      pickupsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      setSelectedCustomer(null);
      setForm({
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
      onClose();
    },
    onError: (err: any) => {
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

    if (!selectedCustomer) return setError("Please select a customer");
    if (!form.customer_complaint.trim()) return setError("Please describe the customer complaint");
    if (!form.pickup_address.trim()) return setError("Pickup address is required");
    if (!form.pickup_date) return setError("Pickup date is required");
    if (!form.contact_number.trim()) return setError("Contact number is required");

    mutate({
      branch: branchId,
      customer_id: selectedCustomer.id,
      ...form,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Request Pickup"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending} type="submit">
            Create Pickup
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="relative">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg border border-primary-200">
              <div>
                <p className="font-medium text-neutral-900 text-sm">{selectedCustomer.name}</p>
                <p className="text-xs text-neutral-600">{selectedCustomer.mobile}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCustomer(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
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
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {showCustomerDropdown && customerResults?.results && customerResults.results.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerResults.results.map((c: any) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer({
                          id: c.id,
                          name: `${c.first_name} ${c.last_name}`,
                          mobile: c.mobile,
                          address: c.address_line1,
                        });
                        setCustomerSearch("");
                        setShowCustomerDropdown(false);
                        setForm((f) => ({
                          ...f,
                          contact_number: f.contact_number || c.mobile,
                          pickup_address: f.pickup_address || c.address_line1 || "",
                        }));
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                    >
                      <p className="font-medium text-neutral-900 text-sm">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-neutral-500">{c.mobile}</p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Device Type"
            options={DEVICE_TYPES}
            value={form.device_type}
            onChange={(e) => setForm({ ...form, device_type: e.target.value })}
            required
          />
          <Input
            label="Brand"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            required
          />
        </div>
        
        <Input
          label="Customer Complaint / Issue"
          value={form.customer_complaint}
          onChange={(e) => setForm({ ...form, customer_complaint: e.target.value })}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Pickup Date"
            type="date"
            min={new Date().toISOString().split("T")[0]}
            value={form.pickup_date}
            onChange={(e) => setForm({ ...form, pickup_date: e.target.value })}
            required
          />
          <Select
            label="Preferred Time Slot"
            options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
            value={form.pickup_time_slot}
            onChange={(e) => setForm({ ...form, pickup_time_slot: e.target.value })}
          />
        </div>
        
        <Input
          label="Pickup Address"
          value={form.pickup_address}
          onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
          required
        />
        <Input
          label="Contact Number at Location"
          value={form.contact_number}
          onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
          required
        />
      </form>
    </Modal>
  );
}
