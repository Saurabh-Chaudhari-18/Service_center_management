"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input } from "@/components/ui";
import { NewCustomerModal } from "@/components/customers/NewCustomerModal";
import { customersApi } from "@/lib/api";
import { Check, AlertCircle, Search, Phone, Plus } from "lucide-react";
import type { Customer, AccessoryType } from "@/types";
import { formatPhone } from "@/lib/formatters";

export function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= 1 ? "bg-primary-500 text-white" : "bg-neutral-200 text-neutral-500"}`}>
          {step > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
        </div>
        <span className={`text-sm font-semibold ${step === 1 ? "text-neutral-900" : "text-neutral-400"}`}>
          Intake
        </span>
      </div>
      <div className={`flex-1 h-0.5 rounded-full transition-colors ${step === 2 ? "bg-primary-500" : "bg-neutral-200"}`} />
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step === 2 ? "bg-primary-500 text-white" : "bg-neutral-200 text-neutral-500"}`}>
          2
        </div>
        <span className={`text-sm font-semibold ${step === 2 ? "text-neutral-900" : "text-neutral-400"}`}>
          Diagnosis
        </span>
      </div>
    </div>
  );
}

// =====================================================
// Step 2 — Intake summary strip
// =====================================================

export function IntakeSummary({
  customer,
  brand,
  model,
  complaint,
  isUrgent,
  onEdit,
}: {
  customer: Customer | null;
  brand: string;
  model: string;
  complaint: string;
  isUrgent: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-800/40 p-4 flex flex-wrap items-start gap-4">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">Customer</p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {customer ? `${customer.first_name} ${customer.last_name}` : "—"}
          </p>
          {customer?.mobile && (
            <p className="text-xs text-neutral-500">{formatPhone(customer.mobile)}</p>
          )}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">Device</p>
          <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {brand} {model}
          </p>
          {isUrgent && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full mt-0.5">
              <AlertCircle className="w-2.5 h-2.5" /> Urgent
            </span>
          )}
        </div>
        <div className="sm:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-0.5">Complaint</p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 line-clamp-2">{complaint || "—"}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400 underline underline-offset-2 shrink-0"
      >
        Edit
      </button>
    </div>
  );
}

// =====================================================
// Customer Search Component
// =====================================================

interface CustomerSearchProps {
  onSelect: (customer: Customer | null) => void;
  selectedCustomer: Customer | null;
  branchId: string;
}

export function CustomerSearch({
  onSelect,
  selectedCustomer,
  branchId,
}: CustomerSearchProps) {
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);

  // Search by name OR mobile — uses the general list endpoint with a search param
  const { data, isLoading } = useQuery({
    queryKey: ["customer-search", search, branchId],
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
                {selectedCustomer.mobile}
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
                    e.preventDefault(); // prevent blur firing before click
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

      {/* Always visible Add New Customer button */}
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

// =====================================================
// Accessories Checklist
// =====================================================

interface AccessoriesChecklistProps {
  value: Partial<
    Record<AccessoryType, { present: boolean; condition: string }>
  >;
  onChange: (
    value: Partial<
      Record<AccessoryType, { present: boolean; condition: string }>
    >,
  ) => void;
}

export function AccessoriesChecklist({ value, onChange }: AccessoriesChecklistProps) {
  const accessories: AccessoryType[] = [
    "CHARGER",
    "BATTERY",
    "BAG",
    "MOUSE",
    "KEYBOARD",
    "POWER_CABLE",
    "USB_CABLE",
    "RAM",
    "HDD",
    "SSD",
  ];

  const toggleAccessory = (acc: AccessoryType) => {
    onChange({
      ...value,
      [acc]: {
        present: !value[acc]?.present,
        condition: value[acc]?.condition || "",
      },
    });
  };

  return (
    <div className="flex flex-wrap gap-2.5">
      {accessories.map((acc) => {
        const isChecked = value[acc]?.present || false;
        const label = acc.toLowerCase().replace("_", " ");

        return (
          <button
            key={acc}
            type="button"
            onClick={() => toggleAccessory(acc)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
              isChecked
                ? "bg-green-50 border-green-400 text-green-800 shadow-sm"
                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
            }`}
          >
            {isChecked && <Check className="w-3h-3 text-green-600" />}
            <span className="capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// Main Create Job Card Page
// =====================================================
