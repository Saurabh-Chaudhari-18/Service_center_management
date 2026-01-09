"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Printer,
  Eye,
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
  is_warranty_repair: z.boolean().optional(),
  warranty_details: z.string().optional(),
  diagnosis_notes: z.string().optional(),
});

type CreateJobFormData = z.infer<typeof createJobSchema>;

// =====================================================
// Print Portal Component
// =====================================================

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div id="print-portal-root">{children}</div>,
    document.body
  );
};

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
// Job Card Preview Modal (Printable Consent Form)
// =====================================================

interface JobCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  formData: CreateJobFormData;
  customer: Customer | null;
  accessories: Partial<
    Record<AccessoryType, { present: boolean; condition: string }>
  >;
  branchName: string;
  serviceCharge: string;
  predictedJobNumber: string;
  accessoryManualDetails: string;
}

function JobCardPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  formData,
  customer,
  accessories,
  branchName,
  serviceCharge,
  predictedJobNumber,
  accessoryManualDetails,
}: JobCardPreviewModalProps) {
  const handlePrint = () => {
    window.print();
  };

  // Helper to get accessory display list with details
  const getAccessoryDisplayList = () => {
    return Object.entries(accessories)
      .filter(([_, v]) => v.present)
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

        // Simple parsing logic derived from main page
        const lines = accessoryManualDetails.split("\n");
        const matchingLine = lines.find((line) =>
          line.toLowerCase().includes(label.toLowerCase())
        );
        const description = matchingLine
          ? matchingLine.replace(new RegExp(`^.*?${label}:?\\s*`, "i"), "")
          : "";

        return description && description.trim() !== ""
          ? `${label} (${description})`
          : label;
      });
  };

  const selectedAccessories = getAccessoryDisplayList();
  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - hidden on print */}
      <div className="fixed inset-0 bg-black/50 no-print" onClick={onClose} />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 no-print">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          {/* Screen Header */}
          <div className="px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-neutral-900">
              Job Card Preview - Consent Form
            </h2>
            <p className="text-sm text-neutral-500">
              Review the details below, print for customer signature, then
              confirm to create.
            </p>
          </div>

          {/* Printable Content Preview (shown on screen inside scrollable area) */}
          <div className="p-6 space-y-4 text-sm">
            {/* Enhanced Shop Header with Brand Logos */}
            <div className="border-2 border-neutral-900 p-3 bg-neutral-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2 text-xs">
                  <span className="font-bold border border-neutral-800 px-2 py-0.5 rounded">
                    HP
                  </span>
                  <span className="font-bold border border-neutral-800 px-2 py-0.5 rounded">
                    DELL
                  </span>
                  <span className="font-bold border border-neutral-800 px-2 py-0.5 rounded">
                    ASUS
                  </span>
                  <span className="font-bold border border-neutral-800 px-2 py-0.5 rounded">
                    LENOVO
                  </span>
                </div>
                <div className="text-right">
                  <h1 className="text-xl font-bold text-neutral-900">
                    SHIVANGI INFOTECH
                  </h1>
                  <p className="text-xs text-neutral-600">
                    HP | DELL | ASUS Authorised Partner
                  </p>
                </div>
              </div>
              <div className="text-center pt-2 border-t border-neutral-300 text-xs text-neutral-600">
                <p>
                  Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa Showroom,
                  Pune-411038
                </p>
                <p>Mobile: 9890888295, 9850292673</p>
              </div>
              <div className="text-center pt-2 mt-2 border-t border-neutral-300">
                <p className="font-bold text-neutral-900">
                  SERVICE INWARD FORM / JOB CARD
                </p>
                <p className="text-xs text-neutral-500">Date: {currentDate}</p>
              </div>
            </div>

            {/* Customer & Device Info - Side by Side */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-neutral-300 p-2">
                <h3 className="font-bold border-b mb-1 pb-1">
                  CUSTOMER DETAILS
                </h3>
                <p>
                  <b>Name:</b> {customer?.first_name} {customer?.last_name}
                </p>
                <p>
                  <b>Mobile:</b> {customer?.mobile}
                </p>
                {customer?.email && (
                  <p>
                    <b>Email:</b> {customer.email}
                  </p>
                )}
                {customer?.city && (
                  <p>
                    <b>Address:</b> {customer.city}, {customer?.state}
                  </p>
                )}
              </div>
              <div className="border border-neutral-300 p-2">
                <h3 className="font-bold border-b mb-1 pb-1">DEVICE DETAILS</h3>
                <p>
                  <b>Type:</b> {formData.device_type}
                </p>
                <p>
                  <b>Brand/Model:</b> {formData.brand} {formData.model}
                </p>
                {formData.serial_number && (
                  <p>
                    <b>Serial:</b> {formData.serial_number}
                  </p>
                )}
                <p>
                  <b>Warranty:</b> {formData.is_warranty_repair ? "YES" : "NO"}
                </p>
                {formData.is_urgent && (
                  <p className="text-red-600 font-bold">⚠ URGENT</p>
                )}
              </div>
            </div>

            {/* Issue Details */}
            <div className="border border-neutral-300 p-2 text-xs">
              <h3 className="font-bold border-b mb-1 pb-1">ISSUE DETAILS</h3>
              <p>
                <b>Customer Complaint:</b> {formData.customer_complaint}
              </p>
              <p className="mt-1">
                <b>Physical Condition:</b> {formData.physical_condition}
              </p>
              {selectedAccessories.length > 0 && (
                <p className="mt-1">
                  <b>Accessories:</b> {selectedAccessories.join(", ")}
                </p>
              )}
              {formData.is_warranty_repair && formData.warranty_details && (
                <p className="mt-1">
                  <b>Warranty Info:</b> {formData.warranty_details}
                </p>
              )}
            </div>

            {/* Terms & Conditions - Compact */}
            <div className="border border-neutral-300 p-2 text-[10px] bg-neutral-50">
              <h3 className="font-bold mb-1">TERMS & CONDITIONS</h3>
              <p>
                <b>Condition:</b> In case of hard disk failure, formatting may
                be required which may lead to data loss. Customers are advised
                to backup important data. Only recommended OS with drivers will
                be installed. Physical/water/burn damage not covered under
                warranty. For warranty claims, provide purchase invoice.
                Defective parts not returned. Product may become non-functional
                during repair - we will not be responsible.
              </p>
              <p className="mt-1">
                <b>Note:</b> Customer must confirm repair within 48 hours of
                estimate, else repair will proceed automatically. Defective
                parts not returned. Complaints must be reported within 24 hours
                of delivery. Collect product within 45 days or it will be
                scrapped. After 45 days, ₹500/month handling charge applies.
              </p>
            </div>

            {/* Authorization & Charges */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="border border-neutral-300 p-2">
                <h3 className="font-bold border-b mb-1 pb-1">
                  CUSTOMER AUTHORIZATION
                </h3>
                <p className="text-[10px] mb-6">
                  I authorize Shivangi Infotech for repair & service. I have
                  backed up all important data.
                </p>
                <div className="mt-4 pt-2 border-t border-dashed border-black">
                  <p className="font-bold mb-2">
                    {customer?.first_name} {customer?.last_name}
                  </p>
                  <p className="font-bold">
                    Customer Signature: _________________
                  </p>
                </div>
              </div>
              <div className="border border-neutral-300 p-2">
                <h3 className="font-bold border-b mb-1 pb-1">
                  CHARGES (Approx)
                </h3>
                <div className="space-y-1">
                  <p className="flex justify-between">
                    <span>Service:</span>
                    <span>₹ _______</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Parts:</span>
                    <span>₹ _______</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Discount:</span>
                    <span>₹ _______</span>
                  </p>
                  <p className="flex justify-between font-bold border-t pt-1">
                    <span>Total:</span>
                    <span>₹ _______</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <p className="text-[9px] text-center text-neutral-500">
              All estimates without taxes. GST extra. Diagnosis: Laptop ₹750,
              Mobile/Tablet ₹500, Desktop ₹350-550. NON-WARRANTY PRODUCTS HAVE
              NO WARRANTY ON REPAIRING.
            </p>
          </div>

          {/* Action Buttons - Screen only */}
          <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 sticky bottom-0 bg-white">
            <Button variant="secondary" onClick={onClose}>
              Back to Edit
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Printer className="w-4 h-4" />}
              onClick={handlePrint}
            >
              Print Form
            </Button>
            <Button onClick={onConfirm} isLoading={isSubmitting}>
              Confirm & Create Job Card
            </Button>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY CONTENT - Uses ID for CSS targeting */}
      <PrintPortal>
        <div className="bg-white p-6 text-[10pt] leading-[1.3] text-black h-screen flex flex-col justify-between">
          <div className="space-y-3">
            {/* Enhanced Shop Header with Brand Logos */}
            <div className="print-section border-2 border-black p-2 mb-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-3 text-[10pt]">
                  <span className="font-bold border-2 border-black px-2 py-0.5">
                    HP
                  </span>
                  <span className="font-bold border-2 border-black px-2 py-0.5">
                    DELL
                  </span>
                  <span className="font-bold border-2 border-black px-2 py-0.5">
                    ASUS
                  </span>
                  <span className="font-bold border-2 border-black px-2 py-0.5">
                    LENOVO
                  </span>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-bold uppercase tracking-wider">
                    SHIVANGI INFOTECH
                  </h1>
                  <p className="text-[10pt] font-semibold">
                    HP | DELL | ASUS Authorised Partner
                  </p>
                </div>
              </div>
              <div className="text-center mt-2 pt-2 border-t-2 border-black">
                <p className="text-[10pt] font-medium">
                  Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa Showroom,
                  Pune-411038
                </p>
                <p className="text-[10pt] font-bold mt-1">
                  Mobile: 9890888295, 9850292673
                </p>
              </div>
              <div className="text-center mt-2 pt-2 border-t-2 border-black">
                <p className="font-bold text-lg uppercase tracking-wide">
                  JOB CARD: {predictedJobNumber}
                </p>
                <p className="text-[11pt] font-medium">Date: {currentDate}</p>
              </div>
            </div>

            {/* Customer & Device */}
            <div className="print-grid print-section grid grid-cols-2 gap-4 mb-2">
              <div className="border border-black p-2">
                <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                  CUSTOMER DETAILS
                </p>
                <div className="space-y-1">
                  <p>
                    <b>Name:</b> {customer?.first_name} {customer?.last_name}
                  </p>
                  <p>
                    <b>Mobile:</b> {customer?.mobile}
                  </p>
                  {customer?.email && (
                    <p>
                      <b>Email:</b> {customer.email}
                    </p>
                  )}
                  {customer?.city && (
                    <p>
                      <b>Address:</b> {customer.city}, {customer?.state}
                    </p>
                  )}
                </div>
              </div>
              <div className="border border-black p-2">
                <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                  DEVICE DETAILS
                </p>
                <div className="space-y-1">
                  <p>
                    <b>Type:</b> {formData.device_type}
                  </p>
                  <p>
                    <b>Brand/Model:</b> {formData.brand} {formData.model}
                  </p>
                  {formData.serial_number && (
                    <p>
                      <b>Serial:</b> {formData.serial_number}
                    </p>
                  )}
                  <p>
                    <b>Warranty:</b>{" "}
                    {formData.is_warranty_repair ? "YES" : "NO"}
                  </p>
                  {formData.is_urgent && (
                    <p className="text-red-600 font-bold text-[11pt] mt-1">
                      ⚠ URGENT REPAIR
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Issue Details */}
            <div className="print-section border border-black p-2 mb-2">
              <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                ISSUE DETAILS
              </p>
              <div className="space-y-2">
                <p>
                  <b>Customer Complaint:</b> {formData.customer_complaint}
                </p>
                <p>
                  <b>Physical Condition:</b> {formData.physical_condition}
                </p>
                {selectedAccessories.length > 0 && (
                  <p>
                    <b>Accessories:</b> {selectedAccessories.join(", ")}
                  </p>
                )}
                {formData.is_warranty_repair && formData.warranty_details && (
                  <p>
                    <b>Warranty Info:</b> {formData.warranty_details}
                  </p>
                )}
                {formData.diagnosis_notes && (
                  <p>
                    <b>Initial Observations:</b> {formData.diagnosis_notes}
                  </p>
                )}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="print-section border border-black p-2 terms-text mb-2">
              <p className="font-bold text-[10pt] mb-1 uppercase underline">
                TERMS & CONDITIONS
              </p>
              <div className="space-y-2 text-[9pt] leading-[1.4] text-justify">
                <p>
                  <b>1. Condition:</b> In case of hard disk failure, formatting
                  may be required which may lead to data loss. Customers are
                  advised to backup important data. Only recommended OS with
                  drivers will be installed. Physical/water/burn damage not
                  covered under warranty. For warranty claims, provide purchase
                  invoice. Defective parts not returned. Product may become
                  non-functional during repair - we will not be responsible.
                </p>
                <p>
                  <b>2. Note:</b> Customer must confirm repair within 48 hours
                  of estimate, else repair will proceed automatically. Defective
                  parts not returned. Complaints must be reported within 24
                  hours of delivery. Collect product within 45 days or it will
                  be scrapped. After 45 days, ₹500/month handling charge
                  applies.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {/* Authorization & Charges */}
            <div className="print-grid print-section grid grid-cols-2 gap-4">
              <div className="border border-black p-2 h-full flex flex-col justify-between">
                <div>
                  <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                    CUSTOMER AUTHORIZATION
                  </p>
                  <p className="text-[10pt] mb-4 italic">
                    I hereby authorize Shivangi Infotech to provide necessary
                    repair & service. I have taken backup of all important data.
                  </p>
                </div>
                <div className="mt-8 pt-2 border-t border-dashed border-black">
                  <p className="font-bold mb-2">
                    {customer?.first_name} {customer?.last_name}
                  </p>
                  <p className="font-bold">
                    Customer Signature: _________________
                  </p>
                </div>
              </div>
              <div className="border border-black p-2">
                <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                  APPROX REPAIR CHARGES
                </p>
                <div className="space-y-3 text-[11pt]">
                  <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                    <span>Service Charges:</span>
                    <span className="w-24 border-b border-black text-right px-1">
                      {serviceCharge ? `₹ ${serviceCharge}` : "₹"}
                    </span>
                  </p>
                  <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                    <span>Parts/Spares:</span>
                    <span className="w-24 border-b border-black">₹</span>
                  </p>
                  <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                    <span>Discount:</span>
                    <span className="w-24 border-b border-black">₹</span>
                  </p>
                  <p className="flex justify-between font-bold text-lg pt-1">
                    <span>FINAL COST:</span>
                    <span className="w-24 border-b-2 border-black">₹</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="footer-text text-center mt-2 pt-2 border-t-2 border-black text-[9pt]">
              <p>
                All estimates without taxes. GST are Extra as applicable.
                Diagnosis: Laptop ₹750, Mobile/Tablet ₹500, Desktop ₹350-550
              </p>
              <p className="font-bold text-[10pt] mt-1">
                NON-WARRANTY PRODUCTS HAVE NO WARRANTY ON REPAIRING
              </p>
            </div>
          </div>
        </div>
      </PrintPortal>
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
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormData, setPreviewFormData] =
    useState<CreateJobFormData | null>(null);

  // New State for Service Charge
  const [serviceCharge, setServiceCharge] = useState("");
  // New State for Accessory Manual Details
  const [accessoryManualDetails, setAccessoryManualDetails] = useState("");

  // Auto-populate accessory details when checklist changes
  useEffect(() => {
    const presentAccessories = Object.entries(accessories)
      .filter(([_, v]) => v.present)
      .map(([k, _]) => {
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

  // Helper to predict job number
  const getPredictedJobNumber = () => {
    if (!currentBranch) return "NEW";
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const fyStartYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fyShort = (fyStartYear + 1).toString().slice(-2);
    const fy = `${fyStartYear}-${fyShort}`;

    // Safety check for branch properties
    const currentNum = currentBranch.jobcard_current_number || 0;
    const nextNum = currentNum + 1;
    const sequence = nextNum.toString().padStart(5, "0");
    return `${currentBranch.jobcard_prefix || "JC"}/${fy}/${
      currentBranch.code
    }/${sequence}`;
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<CreateJobFormData>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      device_type: "LAPTOP",
      is_urgent: false,
      is_warranty_repair: false,
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
          .map(([type, v]) => {
            // Parse description from manual details
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

            // Simple extraction: find line starting with label
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
              description: description || v.condition, // Use parsed description or fallback
            };
          }),
        diagnosis_notes: data.diagnosis_notes || accessoryManualDetails,
      }),
    onSuccess: (job) => {
      router.push(`/jobs/${job.id}`);
    },
  });

  // Handle preview - validate form first, then show preview
  const handleShowPreview = handleSubmit((data) => {
    setPreviewFormData(data);
    setShowPreview(true);
  });

  // Handle confirm from preview - actually submit the job
  const handleConfirmCreate = () => {
    if (previewFormData) {
      mutate(previewFormData);
    }
  };

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
                <Textarea
                  label="Engineer Diagnosis (Initial Observations)"
                  placeholder="Enter any initial technical observations..."
                  {...register("diagnosis_notes")}
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
              <div className="mt-4">
                <Textarea
                  label="Accessories Details"
                  placeholder="Details will auto-populate here. Add Serial Numbers etc."
                  value={accessoryManualDetails}
                  onChange={(e) => setAccessoryManualDetails(e.target.value)}
                  rows={4}
                />
              </div>
            </Card>

            {/* Warranty */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Warranty Information
              </h3>
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
                      <span className="font-medium text-neutral-900">Yes</span>
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
            </Card>

            {/* Service Charge & Priority */}
            <Card>
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
            <div className="flex justify-end gap-3">
              <Link href="/jobs">
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button
                type="button"
                onClick={handleShowPreview}
                leftIcon={<Eye className="w-4 h-4" />}
              >
                Preview & Print
              </Button>
            </div>
          </form>

          {/* Preview Modal */}
          <JobCardPreviewModal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            onConfirm={handleConfirmCreate}
            isSubmitting={isPending}
            formData={previewFormData || getValues()}
            customer={selectedCustomer}
            accessories={accessories}
            branchName={currentBranch?.name || ""}
            serviceCharge={serviceCharge}
            predictedJobNumber={getPredictedJobNumber()}
            accessoryManualDetails={accessoryManualDetails}
          />
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
