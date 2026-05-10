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
import { formatPhone } from "@/lib/formatters";

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
// ===========================================================================================

export default function CreateJobCardPage() {
  const router = useRouter();
  const { currentBranch, hasPermission } = useAuth();
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});
  
  const [serviceCharge, setServiceCharge] = useState("");
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

  const [selectedPhysicalConditions, setSelectedPhysicalConditions] = useState<string[]>([]);
  const [physicalConditionOtherText, setPhysicalConditionOtherText] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [diagnosisOtherText, setDiagnosisOtherText] = useState("");

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

  useEffect(() => {
    setSelectedDiagnoses([]);
    setDiagnosisOtherText("");
  }, [watchDeviceType]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });

  useEffect(() => {
    if (currentBranch?.id && !selectedBranchId) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch, selectedBranchId]);

  useEffect(() => {
    const presentAccessories = Object.entries(accessories)
      .filter(([, v]) => v.present)
      .map(([k]) => {
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
        const lines = prev.split("\n");
        let newText = prev;

        presentAccessories.forEach((label) => {
          const hasLabel = lines.some((line) =>
            line.toLowerCase().includes(label.toLowerCase())
          );
          if (!hasLabel) {
            newText += (newText ? "\n" : "") + `${label}: `;
          }
        });
        return newText;
      });
    }
  }, [accessories]);

  React.useEffect(() => {
    if (selectedCustomer) {
      setValue("customer_id", selectedCustomer.id, { shouldValidate: true });
    } else {
      setValue("customer_id", "");
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
              line.toLowerCase().includes(label.toLowerCase())
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
                 variant="ghost"
                 leftIcon={<ArrowLeft className="w-4 h-4" />}
               >
                 Go Back
               </Button>
             </Link>
          }
        />

        <div className="p-6 w-full max-w-[1920px] mx-auto">
          {error && (
            <Alert variant="error" className="mb-6" title="Error">
              {error.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))}>
            {/* 2-Column Extra Wide Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">
              
              {/* LEFT COLUMN */}
              <div className="space-y-6">
                
                {hasPermission("canManageBranches") && (
                  <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                    <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <Printer className="w-5 h-5 text-primary-500" />
                      Branch Assignment
                    </h3>
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
                  </Card>
                )}

                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                  <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-500" />
                    Customer Details
                  </h3>
                  <CustomerSearch
                    onSelect={setSelectedCustomer}
                    selectedCustomer={selectedCustomer}
                    branchId={currentBranch.id}
                  />
                  {errors.customer_id && (
                    <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errors.customer_id.message}
                    </p>
                  )}
                </Card>

                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors flex-1">
                    <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                      <Laptop className="w-5 h-5 text-primary-500" />
                      Device Specifications
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
                      <Select
                        label="Device Type"
                        options={deviceTypes}
                        {...register("device_type")}
                        error={errors.device_type?.message}
                        required
                      />
                      <Input
                        label="Brand"
                        placeholder="e.g., Dell, Apple"
                        {...register("brand")}
                        error={errors.brand?.message}
                        required
                      />
                      <Input
                        label="Model"
                        placeholder="e.g., XPS 15"
                        {...register("model")}
                        error={errors.model?.message}
                        required
                      />
                      <Input
                        label="Serial Number"
                        placeholder="(Optional)"
                        {...register("serial_number")}
                      />
                      <div className="sm:col-span-2">
                        <Input
                          label="Device Password"
                          type="text"
                          placeholder="Login passcode (if applicable)"
                          {...register("device_password")}
                          helperText="Stored securely and only visible to authorized personnel."
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-neutral-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-neutral-800">Is this a warranty repair?</span>
                          <div className="flex bg-neutral-100/80 rounded-lg p-1 border border-neutral-200/50">
                            <button
                              type="button"
                              className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
                                watch("is_warranty_repair") === true
                                  ? "bg-white text-primary-700 shadow-sm ring-1 ring-black/5"
                                  : "text-neutral-500 hover:text-neutral-700"
                              }`}
                              onClick={() => setValue("is_warranty_repair", true)}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
                                !watch("is_warranty_repair")
                                  ? "bg-white text-neutral-800 shadow-sm ring-1 ring-black/5"
                                  : "text-neutral-500 hover:text-neutral-700"
                              }`}
                              onClick={() => setValue("is_warranty_repair", false)}
                            >
                              No
                            </button>
                          </div>
                      </div>
                      {watch("is_warranty_repair") && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                            <Input
                              placeholder="Enter warranty card #, dates, coverage details..."
                              {...register("warranty_details")}
                            />
                        </div>
                      )}
                    </div>
                </Card>

              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">
                
                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                  <h3 className="text-base font-bold text-neutral-900 mb-4">
                    Items & Condition
                  </h3>

                  <div className="space-y-6">
                    {/* Accessories */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Included Accessories
                      </h4>
                      <AccessoriesChecklist
                        value={accessories}
                        onChange={setAccessories}
                      />
                      {Object.values(accessories).some(a => a?.present) && (
                        <div className="mt-3 animate-in fade-in">
                          <Textarea
                            placeholder="Add Serial Numbers or specific notes for accessories..."
                            value={accessoryManualDetails}
                            onChange={(e) => setAccessoryManualDetails(e.target.value)}
                            rows={2}
                            className="text-sm bg-neutral-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="border-t border-neutral-100"></div>

                    {/* Physical Condition Chips */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Physical Condition
                      </h4>
                      <div className="flex flex-wrap gap-2">
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
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                isChecked
                                  ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                                  : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedPhysicalConditions.some(id =>
                        physicalConditionOptions.find(o => o.id === id && o.has_text_input)
                      ) && (
                        <div className="mt-3 animate-in fade-in">
                          <Input
                            placeholder="Please describe 'Other' physical condition..."
                            value={physicalConditionOtherText}
                            onChange={(e) => setPhysicalConditionOtherText(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors flex-1">
                  <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary-500" />
                      Diagnosis & Remarks
                  </h3>
                  
                  <div className="space-y-5">
                    <Textarea
                      label="Customer Complaint"
                      placeholder="Describe the issue reported by the customer..."
                      {...register("customer_complaint")}
                      error={errors.customer_complaint?.message}
                      required
                      rows={3}
                      className="text-sm shadow-inner bg-white"
                    />

                    {/* Engineer Diagnosis Chips */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Initial Diagnosis ({watchDeviceType})
                      </h4>
                      {diagnosisOptions.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2">
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
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                    isChecked
                                      ? "bg-blue-50 border-blue-300 text-blue-800 shadow-sm"
                                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  <span>{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {selectedDiagnoses.some(id =>
                            diagnosisOptions.find(o => o.id === id && o.has_text_input)
                          ) && (
                            <div className="mt-3 animate-in fade-in">
                              <Input
                                placeholder="Specify other diagnosis..."
                                value={diagnosisOtherText}
                                onChange={(e) => setDiagnosisOtherText(e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-neutral-500 font-medium bg-neutral-100 p-3 rounded-lg border border-neutral-200">
                          No quick-select presets available for {watchDeviceType.toLowerCase()}.
                        </p>
                      )}
                    </div>

                    <Textarea
                      label="Internal Notes"
                      placeholder="Additional comments (optional)..."
                      {...register("additional_comments")}
                      rows={2}
                      className="text-sm bg-neutral-50"
                    />
                  </div>
                </Card>

              </div>
            </div>

            {/* Sticky Bottom Footer for Submission */}
            <div className="mt-8 bg-white border border-neutral-200 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 sticky bottom-6 z-10 ring-4 ring-neutral-50/50">
                <div className="flex items-center gap-6 w-full sm:w-auto">
                  <label className="relative inline-flex items-center cursor-pointer group">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        {...register("is_urgent")}
                      />
                      <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 group-hover:after:shadow-sm"></div>
                      <span className="ml-3 text-sm font-bold text-neutral-700 group-hover:text-red-600 transition-colors uppercase tracking-wider">Emergency / Urgent</span>
                  </label>

                  <div className="w-[200px]">
                    <Input
                      placeholder="Cost Estimate"
                      value={serviceCharge}
                      onChange={(e) => setServiceCharge(e.target.value)}
                      leftIcon={<span className="text-neutral-500 font-bold px-1">₹</span>}
                      className="bg-neutral-50 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <Link href="/jobs" className="w-full sm:w-auto">
                    <Button variant="secondary" type="button" className="w-full font-semibold">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" isLoading={isPending} className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 shadow-md font-bold px-8 text-base">
                    Save Job Card
                  </Button>
                </div>
            </div>

          </form>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
