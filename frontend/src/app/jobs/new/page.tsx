"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
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
import { jobsApi, customersApi, branchesApi, dropdownOptionsApi } from "@/lib/api";
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
  Printer,
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
  physical_condition: z.object({
    selected: z.array(z.string()),
    other_text: z.string().optional(),
  }).optional(),
  engineer_diagnosis: z.object({
    selected: z.array(z.string()),
    other_text: z.string().optional(),
  }).optional(),
  device_password: z.string().optional(),
  is_urgent: z.boolean().optional(),
  is_warranty_repair: z.boolean().optional(),
  warranty_details: z.string().optional(),
  diagnosis_notes: z.string().optional(),
  additional_comments: z.string().optional(),
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
    >,
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
// ===========================================================================================

export default function CreateJobCardPage() {
  const router = useRouter();
  const { currentBranch, hasPermission } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});
  // New State for Service Charge
  const [serviceCharge, setServiceCharge] = useState("");
  // New State for Accessory Manual Details
  const [accessoryManualDetails, setAccessoryManualDetails] = useState("");

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
      is_warranty_repair: false,
      physical_condition: { selected: [], other_text: "" },
      engineer_diagnosis: { selected: [], other_text: "" },
    },
  });

  // Dropdown options state
  const [selectedPhysicalConditions, setSelectedPhysicalConditions] = useState<string[]>([]);
  const [physicalConditionOtherText, setPhysicalConditionOtherText] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [diagnosisOtherText, setDiagnosisOtherText] = useState("");

  // Fetch dropdown options
  const { data: physicalConditionOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "PHYSICAL_CONDITION"],
    queryFn: () => dropdownOptionsApi.list({ category: "PHYSICAL_CONDITION" }),
  });

  const watchDeviceType = watch("device_type");

  const { data: diagnosisOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "ENGINEER_DIAGNOSIS", watchDeviceType],
    queryFn: () => dropdownOptionsApi.list({ category: "ENGINEER_DIAGNOSIS", device_type: watchDeviceType }),
    enabled: !!watchDeviceType,
  });

  // Reset diagnosis selections when device type changes
  useEffect(() => {
    setSelectedDiagnoses([]);
    setDiagnosisOtherText("");
  }, [watchDeviceType]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });

  // Default the selector to current branch
  useEffect(() => {
    if (currentBranch?.id && !selectedBranchId) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch, selectedBranchId]);

  // Auto-populate accessory details when checklist changes
  useEffect(() => {
    const presentAccessories = Object.entries(accessories)
      .filter(([, v]) => v.present)
      .map(([k]) => {
        // Get label from predefined list or format it
        const labels: Record<string, string> = {
          CHARGER: "Charger/Adapter",
          BATTERY: "Battery",
          BAG: "Laptop Bag",
          MOUSE: "Mouse",
          KEYBOARD: "Keyboard",
          POWER_CABLE: "Power Cable",
          USB_CABLE: "USB Cable",
          HDMI_CABLE: "HDMI Cable",
          RAM: "RAM Module",
          HDD: "Hard Drive",
          SSD: "SSD",
          OTHER: "Other",
        };
        return labels[k] || k;
      });

    if (presentAccessories.length > 0) {
      setAccessoryManualDetails((prev) => {
        // Only append if not already in text to avoid duplicates
        const lines = prev.split("\n");
        let newText = prev;

        presentAccessories.forEach((label) => {
          const hasLabel = lines.some((line) =>
            line.toLowerCase().includes(label.toLowerCase()),
          );
          if (!hasLabel) {
            newText += (newText ? "\n" : "") + `${label}: `;
          }
        });
        return newText;
      });
    }
  }, [accessories]);

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
        branch: selectedBranchId === "universal" ? null : selectedBranchId,
        device_type: data.device_type as DeviceType,
        estimated_cost: serviceCharge ? parseFloat(serviceCharge) : undefined,
        physical_condition: {
          selected: selectedPhysicalConditions,
          other_text: physicalConditionOtherText,
        },
        engineer_diagnosis: {
          selected: selectedDiagnoses,
          other_text: diagnosisOtherText,
        },
        accessories: Object.entries(accessories)
          .filter(([, v]) => v.present)
          .map(([type, v]) => {
            const label =
              type === "CHARGER"
                ? "Charger/Adapter"
                : type === "BATTERY"
                  ? "Battery"
                  : type === "BAG"
                    ? "Laptop Bag"
                    : type === "SSD"
                      ? "SSD"
                      : type === "HDD"
                        ? "Hard Drive"
                        : type === "RAM"
                          ? "RAM Module"
                          : type;

            const lines = accessoryManualDetails.split("\n");
            const matchingLine = lines.find((line) =>
              line.toLowerCase().includes(label.toLowerCase()),
            );
            const description = matchingLine
              ? matchingLine.replace(new RegExp(`^.*?${label}:?\\s*`, "i"), "")
              : v.condition;

            return {
              accessory_type: type as AccessoryType,
              is_present: true,
              condition: v.condition,
              description: description || v.condition,
            };
          }),
        diagnosis_notes: data.diagnosis_notes || accessoryManualDetails,
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

        <div className="p-6 max-w-4xl mx-auto">
          {error && (
            <Alert variant="error" className="mb-6" title="Error">
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
            {/* Branch Selection (Owners Only) */}
            {hasPermission("canManageBranches") && (
              <Card className="border border-neutral-300 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary-500" />
                  Branch Assignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Assign to Branch"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    options={[
                      {
                        value: "universal",
                        label: "🌍 Universal / All Branches",
                      },
                      ...(Array.isArray(branches)
                        ? branches
                        : Object.hasOwn(branches, "results")
                          ? (branches as { results: { id: string; name: string }[] }).results
                          : []
                      ).map((b: { id: string; name: string }) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <p className="text-sm text-neutral-500 mt-1 col-span-full">
                    Universal jobs are visible across all branches.
                  </p>
                </div>
              </Card>
            )}
            {/* Customer Section */}
            <Card className="border border-neutral-300 shadow-sm">
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
            <Card className="border border-neutral-300 shadow-sm">
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

              <div className="mt-6 pt-6 border-t border-neutral-100">
                <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                  Warranty Information
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-700 mb-3">
                      Is this a warranty repair?
                    </p>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="true"
                          checked={watch("is_warranty_repair") === true}
                          onChange={() => setValue("is_warranty_repair", true)}
                          className="w-5 h-5 text-primary-500 border-neutral-300 focus:ring-primary-500"
                        />
                        <span className="font-medium text-neutral-900">
                          Yes
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="false"
                          checked={
                            watch("is_warranty_repair") === false ||
                            watch("is_warranty_repair") === undefined
                          }
                          onChange={() => setValue("is_warranty_repair", false)}
                          className="w-5 h-5 text-primary-500 border-neutral-300 focus:ring-primary-500"
                        />
                        <span className="font-medium text-neutral-900">No</span>
                      </label>
                    </div>
                  </div>
                  {watch("is_warranty_repair") && (
                    <Textarea
                      label="Warranty Details"
                      placeholder="Enter warranty claim details, warranty card number, etc."
                      {...register("warranty_details")}
                      rows={2}
                    />
                  )}
                </div>
              </div>
            </Card>

            {/* Accessories & Condition */}
            <Card className="border border-neutral-300 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Accessories & Condition
              </h3>

              <div className="space-y-6">
                {/* Accessories Subsection */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                    Accessories Received
                  </h4>
                  <p className="text-sm text-neutral-500 mb-3">
                    Check all accessories received with the device
                  </p>
                  <AccessoriesChecklist
                    value={accessories}
                    onChange={setAccessories}
                  />
                  <div className="mt-3">
                    <Textarea
                      label="Accessories Details"
                      placeholder="Details will auto-populate here. Add Serial Numbers etc."
                      value={accessoryManualDetails}
                      onChange={(e) =>
                        setAccessoryManualDetails(e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-200"></div>

                {/* Physical Condition - Multi-select Checkboxes */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                    Physical Condition
                  </h4>
                  <p className="text-sm text-neutral-500 mb-3">
                    Select all that apply
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {physicalConditionOptions.map((option) => {
                      const isChecked = selectedPhysicalConditions.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setSelectedPhysicalConditions(prev =>
                              isChecked
                                ? prev.filter(id => id !== option.id)
                                : [...prev, option.id]
                            );
                          }}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                            isChecked
                              ? "bg-orange-50 border-orange-300 text-orange-700"
                              : "bg-neutral-50 border-neutral-200 text-neutral-600"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center ${
                              isChecked
                                ? "bg-orange-500 border-orange-500"
                                : "border-neutral-300"
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-medium">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Show text input for 'Others' */}
                  {selectedPhysicalConditions.some(id =>
                    physicalConditionOptions.find(o => o.id === id && o.has_text_input)
                  ) && (
                    <div className="mt-3">
                      <Input
                        label="Specify Other Condition"
                        placeholder="Please describe..."
                        value={physicalConditionOtherText}
                        onChange={(e) => setPhysicalConditionOtherText(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Problem Description */}
            <Card className="border border-neutral-300 shadow-sm">
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

                {/* Engineer Diagnosis - Multi-select Checkboxes */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                    Engineer Diagnosis
                  </h4>
                  <p className="text-sm text-neutral-500 mb-3">
                    Select applicable diagnosis based on device type ({watchDeviceType || 'select device type'})
                  </p>
                  {diagnosisOptions.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {diagnosisOptions.map((option) => {
                          const isChecked = selectedDiagnoses.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedDiagnoses(prev =>
                                  isChecked
                                    ? prev.filter(id => id !== option.id)
                                    : [...prev, option.id]
                                );
                              }}
                              className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                                isChecked
                                  ? "bg-blue-50 border-blue-300 text-blue-700"
                                  : "bg-neutral-50 border-neutral-200 text-neutral-600"
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded border flex items-center justify-center ${
                                  isChecked
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-neutral-300"
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-sm font-medium">{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Show text input for 'Others' */}
                      {selectedDiagnoses.some(id =>
                        diagnosisOptions.find(o => o.id === id && o.has_text_input)
                      ) && (
                        <div className="mt-3">
                          <Input
                            label="Specify Other Diagnosis"
                            placeholder="Please describe..."
                            value={diagnosisOtherText}
                            onChange={(e) => setDiagnosisOtherText(e.target.value)}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-neutral-400 italic">Select a device type to see diagnosis options</p>
                  )}
                </div>

                <Textarea
                  label="Additional Comments"
                  placeholder="Any other details or comments..."
                  {...register("additional_comments")}
                  rows={2}
                />
              </div>
            </Card>

            {/* Service Charge & Priority */}
            <Card className="border border-neutral-300 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Prioritize this job
                  </span>
                </div>

                <div>
                  <Input
                    label="Service Charge (Estimate)"
                    placeholder="0.00"
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(e.target.value)}
                    leftIcon={
                      <span className="text-neutral-500 font-bold px-1">₹</span>
                    }
                  />
                </div>
              </div>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-3 mt-6">
              <Link href="/jobs">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                isLoading={isPending}
              >
                Create Job Card
              </Button>
            </div>
          </form>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
