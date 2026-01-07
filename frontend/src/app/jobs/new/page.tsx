"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Alert,
  Modal,
} from "@/components/ui";
import { jobsApi, customersApi } from "@/lib/api";
import {
  ArrowLeft,
  Search,
  User,
  Plus,
  Laptop,
  HelpCircle,
  Check,
  AlertCircle,
  Phone,
} from "lucide-react";
import Link from "next/link";
import type { Customer, DeviceType, AccessoryType } from "@/types";

// =====================================================
// Validation Schema
// =====================================================

const createJobSchema = z.object({
  customer_id: z.string().min(1, "Please select a customer"),
  device_type: z.string().min(1, "Device type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serial_number: z.string().optional(),
  customer_complaint: z.string().min(10, "Please describe the issue in detail"),
  physical_condition: z
    .string()
    .min(5, "Please describe the physical condition"),
  device_password: z.string().optional(),
  is_urgent: z.boolean().optional(),
});

type CreateJobFormData = z.infer<typeof createJobSchema>;

// =====================================================
// Customer Search Component
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
    queryKey: ["customer-search", search, branchId],
    queryFn: () => customersApi.searchByMobile(search),
    enabled: search.length >= 5,
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
          placeholder="Search by mobile number..."
          leftIcon={<Search className="w-5 h-5" />}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
        />

        {showResults && search.length >= 5 && (
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
        Enter at least 5 digits of the mobile number to search
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

// =====================================================
// New Customer Modal
// =====================================================

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  branchId: string;
  initialMobile: string;
}

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

function NewCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
  branchId,
  initialMobile,
}: NewCustomerModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { mobile: initialMobile.replace(/\D/g, "").slice(-10) },
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CustomerFormData) =>
      customersApi.create({ ...data, branch: branchId }),
    onSuccess: (customer) => {
      onCustomerCreated(customer);
      reset();
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit((d) => mutate(d))}
            isLoading={isPending}
          >
            Add Customer
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error.message}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          {...register("first_name")}
          error={errors.first_name?.message}
          required
        />
        <Input
          label="Last Name"
          {...register("last_name")}
          error={errors.last_name?.message}
        />
        <Input
          label="Mobile Number"
          {...register("mobile")}
          error={errors.mobile?.message}
          required
          placeholder="10-digit mobile number"
        />
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
      </div>
    </Modal>
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
    >
  ) => void;
}

function AccessoriesChecklist({ value, onChange }: AccessoriesChecklistProps) {
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {accessories.map((acc) => {
        const isChecked = value[acc]?.present || false;
        const label = acc.toLowerCase().replace("_", " ");

        return (
          <button
            key={acc}
            type="button"
            onClick={() => toggleAccessory(acc)}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
              isChecked
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center ${
                isChecked
                  ? "bg-green-500 border-green-500"
                  : "border-neutral-300"
              }`}
            >
              {isChecked && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// Main Create Job Card Page
// =====================================================

export default function CreateJobCardPage() {
  const router = useRouter();
  const { currentBranch } = useAuth();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateJobFormData>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      device_type: "LAPTOP",
      is_urgent: false,
    },
  });

  // Update form when customer is selected
  React.useEffect(() => {
    if (selectedCustomer) {
      setValue("customer_id", selectedCustomer.id);
    }
  }, [selectedCustomer, setValue]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateJobFormData) =>
      jobsApi.create({
        ...data,
        branch: currentBranch!.id,
        device_type: data.device_type as DeviceType,
        accessories: Object.entries(accessories)
          .filter(([_, v]) => v.present)
          .map(([type, v]) => ({
            accessory_type: type as AccessoryType,
            is_present: true,
            condition: v.condition,
          })),
      }),
    onSuccess: (job) => {
      router.push(`/jobs/${job.id}`);
    },
  });

  const deviceTypes = [
    { value: "LAPTOP", label: "Laptop" },
    { value: "DESKTOP", label: "Desktop" },
    { value: "ALL_IN_ONE", label: "All-in-One" },
    { value: "MONITOR", label: "Monitor" },
    { value: "PRINTER", label: "Printer" },
    { value: "UPS", label: "UPS" },
    { value: "OTHER", label: "Other" },
  ];

  if (!currentBranch) {
    return (
      <ProtectedRoute requiredPermission="canCreateJobCards">
        <AppLayout>
          <div className="p-6">
            <Alert variant="error">
              Please select a branch to create a job card.
            </Alert>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canCreateJobCards">
      <AppLayout>
        <Header
          title="Create Job Card"
          subtitle="Register a new device for service"
          actions={
            <Link href="/jobs">
              <Button
                variant="secondary"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Cancel
              </Button>
            </Link>
          }
        />

        <div className="p-6 max-w-4xl">
          {error && (
            <Alert variant="error" className="mb-6" title="Error">
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
            {/* Customer Section */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-500" />
                Customer Information
              </h3>
              <CustomerSearch
                onSelect={setSelectedCustomer}
                selectedCustomer={selectedCustomer}
                branchId={currentBranch.id}
              />
              {errors.customer_id && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.customer_id.message}
                </p>
              )}
            </Card>

            {/* Device Section */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Laptop className="w-5 h-5 text-primary-500" />
                Device Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Device Type"
                  options={deviceTypes}
                  {...register("device_type")}
                  error={errors.device_type?.message}
                  required
                />
                <Input
                  label="Brand"
                  placeholder="e.g., Dell, HP, Lenovo"
                  {...register("brand")}
                  error={errors.brand?.message}
                  required
                />
                <Input
                  label="Model"
                  placeholder="e.g., Inspiron 15 3520"
                  {...register("model")}
                  error={errors.model?.message}
                  required
                />
                <Input
                  label="Serial Number"
                  placeholder="Device serial number (optional)"
                  {...register("serial_number")}
                />
                <Input
                  label="Device Password"
                  type="password"
                  placeholder="Login password (if applicable)"
                  {...register("device_password")}
                  helperText="Stored securely and only visible to authorized technicians"
                />
              </div>
            </Card>

            {/* Problem Description */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary-500" />
                Problem Description
              </h3>
              <div className="space-y-4">
                <Textarea
                  label="Customer Complaint"
                  placeholder="Describe the issue reported by the customer..."
                  {...register("customer_complaint")}
                  error={errors.customer_complaint?.message}
                  required
                  rows={3}
                />
                <Textarea
                  label="Physical Condition"
                  placeholder="Describe the physical condition of the device (scratches, dents, etc.)..."
                  {...register("physical_condition")}
                  error={errors.physical_condition?.message}
                  required
                  rows={2}
                />
              </div>
            </Card>

            {/* Accessories */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Accessories Received
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Check all accessories received with the device
              </p>
              <AccessoriesChecklist
                value={accessories}
                onChange={setAccessories}
              />
            </Card>

            {/* Priority */}
            <Card>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("is_urgent")}
                    className="w-5 h-5 rounded border-neutral-300 text-red-500 focus:ring-red-500"
                  />
                  <span className="font-medium text-neutral-900">
                    Mark as Urgent
                  </span>
                </label>
                <span className="text-sm text-neutral-500">
                  Urgent jobs are highlighted and prioritized
                </span>
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Link href="/jobs">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" isLoading={isPending}>
                Create Job Card
              </Button>
            </div>
          </form>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
