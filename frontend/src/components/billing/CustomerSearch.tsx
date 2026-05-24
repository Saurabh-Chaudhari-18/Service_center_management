"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customersApi } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { NewCustomerModal } from "@/components/customers/NewCustomerModal";
import { Search, Phone, Plus } from "lucide-react";
import type { Customer } from "@/types";

export interface CustomerSearchProps {
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

  const { data, isLoading } = useQuery({
    queryKey: ["customer-search-billing", search, branchId],
    queryFn: () => customersApi.searchByMobile(search),
    enabled: search.length >= 2,
  });

  const customers = data || [];

  if (selectedCustomer) {
    return (
      <div className="p-4 border border-primary-200 bg-primary-50 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-medium">
              {selectedCustomer.first_name[0]}
              {selectedCustomer.last_name?.[0]}
            </div>
            <div>
              <p className="font-medium text-neutral-900">
                {selectedCustomer.first_name} {selectedCustomer.last_name}
              </p>
              <p className="text-sm text-neutral-500 flex items-center gap-1">
                <Phone className="w-3 h-3" />
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
          placeholder="Search by name or mobile number..."
          leftIcon={<Search className="w-5 h-5" />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
        />

        {showResults && search.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-neutral-500">
                Searching...
              </div>
            ) : customers.length > 0 ? (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 text-left transition-colors"
                  onClick={() => {
                    onSelect(customer);
                    setShowResults(false);
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-sm font-medium">
                    {customer.first_name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {customer.first_name} {customer.last_name}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {customer.mobile}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center">
                <p className="text-neutral-500 mb-2">No customer found</p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setShowNewCustomerModal(true)}
                >
                  Add New Customer
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-neutral-500">
        Enter name or mobile number to search
      </p>

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
