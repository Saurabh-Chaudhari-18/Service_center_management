"use client";

import React, {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Alert, Modal, Select } from "@/components/ui";
import {
  jobsApi,
  billingApi,
  inventoryApi,
  customersApi,
  branchesApi,
} from "@/lib/api";
import {
  ArrowLeft,
  Printer,
  Plus,
  Trash2,
  FileText,
  Save,
  Loader2,
  Package,
  ChevronDown,
  Search,
  User,
  Phone,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobCard, Customer, InventoryItem } from "@/types";

// =====================================================
// Schemas & Types
// =====================================================

const invoiceLineItemSchema = z.object({
  item_type: z.enum(["SERVICE", "PART", "LABOUR", "OTHER"]),
  description: z.string().min(1, "Description is required"),
  hsn_sac_code: z.string().optional(),
  quantity: z.number().min(1, "Minimum quantity is 1"),
  unit_price: z.number().min(0, "Price cannot be negative"),
  gst_rate: z.number().min(0, "GST rate cannot be negative"),
  inventory_item: z.string().uuid().optional(),
});

const createInvoiceSchema = z
  .object({
    job_id: z.string().optional(),
    customer_id: z.string().optional(),
    branch: z.string().min(1, "Invalid Branch ID"),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    line_items: z.array(invoiceLineItemSchema).min(1, "Add at least one item"),
  })
  .refine((data) => data.job_id || data.customer_id, {
    message: "Please select a customer or a job",
    path: ["customer_id"],
  });

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

// Per-row inventory selection state
interface RowInventoryState {
  categoryId: string;
  itemId: string;
}

// =====================================================
// Customer Search Component (for billing without job)
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

// =====================================================
// New Customer Modal
// =====================================================

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  branchId: string;
  initialMobile: string;
}

function NewCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
  branchId,
  initialMobile,
}: NewCustomerModalProps) {
  const {
    register: registerCustomer,
    handleSubmit: handleCustomerSubmit,
    formState: { errors: customerErrors },
    reset: resetCustomer,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { mobile: initialMobile.replace(/\D/g, "").slice(-10) },
  });

  const {
    mutate: createCustomer,
    isPending: isCreating,
    error: createError,
  } = useMutation({
    mutationFn: (data: CustomerFormData) =>
      customersApi.create({ ...data, branch: branchId }),
    onSuccess: (customer) => {
      onCustomerCreated(customer);
      resetCustomer();
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
            onClick={handleCustomerSubmit((d) => createCustomer(d))}
            isLoading={isCreating}
          >
            Add Customer
          </Button>
        </>
      }
    >
      {createError && (
        <Alert variant="error" className="mb-4">
          {(createError as Error).message}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          {...registerCustomer("first_name")}
          error={customerErrors.first_name?.message}
          required
        />
        <Input
          label="Last Name"
          {...registerCustomer("last_name")}
          error={customerErrors.last_name?.message}
        />
        <Input
          label="Mobile Number"
          {...registerCustomer("mobile")}
          error={customerErrors.mobile?.message}
          required
          placeholder="10-digit mobile number"
        />
        <Input
          label="Email"
          type="email"
          {...registerCustomer("email")}
          error={customerErrors.email?.message}
        />
        <Input label="City" {...registerCustomer("city")} />
        <Input label="State" {...registerCustomer("state")} />
      </div>
    </Modal>
  );
}

// =====================================================
// Brand Logo Component (Reused)
// =====================================================
function BrandLogo({ brand }: { brand: "HP" | "DELL" | "ASUS" | "LENOVO" }) {
  switch (brand) {
    case "HP":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle cx="50" cy="50" r="45" fill="#0096D6" />
          <text
            x="50"
            y="65"
            fontSize="40"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            style={{ fontStyle: "italic", fontFamily: "serif" }}
          >
            hp
          </text>
        </svg>
      );
    case "DELL":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="#007DB8"
            strokeWidth="4"
          />
          <text
            x="50"
            y="60"
            fontSize="24"
            fontWeight="bold"
            fill="#007DB8"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            DELL
          </text>
        </svg>
      );
    case "ASUS":
      return (
        <svg viewBox="0 0 100 30" className="w-12 h-6">
          <text
            x="50"
            y="22"
            fontSize="24"
            fontWeight="bold"
            fill="#00539B"
            textAnchor="middle"
            style={{ letterSpacing: "2px" }}
          >
            ASUS
          </text>
          <line
            x1="10"
            y1="12"
            x2="90"
            y2="12"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      );
    case "LENOVO":
      return (
        <svg viewBox="0 0 100 40" className="w-16 h-8">
          <rect width="100" height="40" fill="#E2231A" />
          <text
            x="50"
            y="28"
            fontSize="20"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            Lenovo
          </text>
        </svg>
      );
  }
}

// =====================================================
// Invoice Preview Modal
// =====================================================

// =====================================================
// Invoice Template Component (Shared for Screen & Print)
// =====================================================

interface InvoiceTemplateProps {
  formData: CreateInvoiceFormData;
  jobDetails: JobCard | null | undefined;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  customer: Customer | null | undefined;
}

function InvoiceTemplate({
  formData,
  jobDetails,
  subtotal,
  totalTax,
  grandTotal,
  customer,
}: InvoiceTemplateProps) {
  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-2 border-black p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4 items-center">
            <BrandLogo brand="HP" />
            <BrandLogo brand="DELL" />
            <BrandLogo brand="ASUS" />
            <BrandLogo brand="LENOVO" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              SHIVANGI INFOTECH
            </h1>
            <p className="text-sm font-semibold">
              HP | DELL | ASUS Authorised Partner
            </p>
          </div>
        </div>
        <div className="text-center border-t border-black pt-2 text-xs">
          <p>
            Shop No. 3, Ground Floor, Sai Complex, Pune-Nashik Highway, Pune
            411039
          </p>
          <p>Phone: +91 99999 88888 | Email: support@shivangiinfo.com</p>
          <p className="mt-1 font-bold">GSTIN: 27ABCDE1234F1Z5</p>
        </div>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-neutral-500 text-sm uppercase tracking-wider mb-1">
            Bill To
          </h3>
          <p className="font-bold text-lg">
            {customer?.first_name} {customer?.last_name}
          </p>
          <p className="text-neutral-600">{customer?.mobile}</p>
          <p className="text-neutral-600">{customer?.email}</p>
          {customer?.address_line1 && (
            <p className="text-neutral-600 text-sm max-w-xs mt-1">
              {customer.address_line1}, {customer.city}
            </p>
          )}
          {customer?.gstin && (
            <p className="text-sm font-mono mt-2">GSTIN: {customer.gstin}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-light text-primary-600 mb-2">INVOICE</h2>
          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="font-medium mr-2">Date:</span>
              {format(new Date(), "dd MMM yyyy")}
            </p>
            <p>
              <span className="font-medium mr-2">Job Ref:</span>
              {jobDetails?.job_number}
            </p>
            <p>
              <span className="font-medium mr-2">Status:</span>
              Unpaid
            </p>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-neutral-100 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-600 font-semibold text-left">
            <th className="px-4 py-3 border-b">#</th>
            <th className="px-4 py-3 border-b">Item & Description</th>
            <th className="px-4 py-3 text-right border-b">Qty</th>
            <th className="px-4 py-3 text-right border-b">Rate</th>
            <th className="px-4 py-3 text-right border-b">Tax %</th>
            <th className="px-4 py-3 text-right border-b">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {formData.line_items.map((item, idx) => (
            <tr key={idx} className="text-sm">
              <td className="px-4 py-3 text-neutral-400">{idx + 1}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">
                  {item.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                    {item.item_type}
                  </span>
                  {item.hsn_sac_code && (
                    <span className="text-xs text-neutral-400">
                      HSN: {item.hsn_sac_code}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">{item.quantity}</td>
              <td className="px-4 py-3 text-right">
                ₹{item.unit_price.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-neutral-500">
                {item.gst_rate}%
              </td>
              <td className="px-4 py-3 text-right font-medium">
                ₹
                {(
                  item.quantity *
                  item.unit_price *
                  (1 + item.gst_rate / 100)
                ).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Tax (GST)</span>
            <span>₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="border-t border-neutral-200 pt-2 mt-2 flex justify-between items-center font-bold text-lg text-neutral-900">
            <span>Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms and Signatures */}
      <div className="grid grid-cols-2 gap-8 border-t border-neutral-200 pt-8 text-xs text-neutral-500">
        <div>
          <h4 className="font-bold text-neutral-700 mb-2">
            Terms & Conditions
          </h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>Payment is due upon receipt.</li>
            <li>Warranty as per manufacturer policy for parts.</li>
            <li>Service warranty valid for 7 days only on same issue.</li>
            <li>Subject to Pune Jurisdiction.</li>
          </ul>
        </div>
        <div className="text-center pt-8">
          <div className="border-b border-neutral-300 w-32 mx-auto mb-2"></div>
          <p>Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Invoice Preview Modal
// =====================================================

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  formData: CreateInvoiceFormData;
  jobDetails: JobCard | null | undefined;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  customer: Customer | null | undefined;
}

function InvoicePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  formData,
  jobDetails,
  subtotal,
  totalTax,
  grandTotal,
  customer,
}: InvoicePreviewModalProps) {
  // Portal for print content - MUST match globals.css #print-portal-root
  const PrintPortal = ({ children }: { children: React.ReactNode }) => {
    // Client-side only rendering for portal
    if (typeof window === "undefined") return null;

    // Create portal to document.body with specific ID that is exempted from print hiding in globals.css
    return createPortal(
      <div id="print-portal-root">{children}</div>,
      document.body,
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto print:hidden">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />

        {/* Modal Container */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Screen Header */}
            <div className="px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold text-neutral-900">
                Invoice Preview
              </h2>
              <p className="text-sm text-neutral-500">
                Review details before creating the invoice.
              </p>
            </div>

            {/* Template Rendered for Screen */}
            <div className="p-0">
              <InvoiceTemplate
                formData={formData}
                jobDetails={jobDetails}
                subtotal={subtotal}
                totalTax={totalTax}
                grandTotal={grandTotal}
                customer={customer}
              />
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4 flex justify-end gap-3 rounded-b-xl">
              <Button variant="secondary" onClick={onClose}>
                Back to Edit
              </Button>
              <Button
                onClick={() => window.print()}
                variant="secondary"
                leftIcon={<Printer className="w-4 h-4" />}
                disabled={isSubmitting}
              >
                Print
              </Button>
              <Button
                onClick={onConfirm}
                isLoading={isSubmitting}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Confirm & Create Invoice
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Area - Rendered via Portal to escape main layout hiding */}
      <PrintPortal>
        <InvoiceTemplate
          formData={formData}
          jobDetails={jobDetails}
          subtotal={subtotal}
          totalTax={totalTax}
          grandTotal={grandTotal}
          customer={customer}
        />
      </PrintPortal>
    </>
  );
}

// =====================================================
// Main Page Component
// =====================================================

function CreateInvoiceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { currentBranch, hasPermission } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  // Per-row inventory selection state
  const [rowInventory, setRowInventory] = useState<
    Record<number, RowInventoryState>
  >({});

  // Fetch Branches
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

  // Fetch job details to pre-fill
  const { data: job, isLoading: isLoadingJob } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
  });

  // Fetch inventory categories for current branch
  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories", currentBranch?.id],
    queryFn: () => inventoryApi.listCategories(currentBranch!.id),
    enabled: !!currentBranch?.id,
  });

  // Fetch all inventory items for current branch
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-all", currentBranch?.id],
    queryFn: () => inventoryApi.list({ branch: currentBranch!.id }),
    enabled: !!currentBranch?.id,
  });

  const allItems: InventoryItem[] = useMemo(
    () => inventoryData?.results || [],
    [inventoryData],
  );

  // Get items filtered by category
  const getItemsForCategory = useCallback(
    (categoryId: string): InventoryItem[] => {
      if (!categoryId) return allItems;
      return allItems.filter((item) => item.category === categoryId);
    },
    [allItems],
  );

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateInvoiceFormData>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      job_id: jobId || undefined,
      customer_id: undefined,
      branch: currentBranch?.id || "",
      line_items: [
        {
          item_type: "SERVICE",
          description: "",
          quantity: 1,
          unit_price: 0,
          gst_rate: 18,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  // Effect to pre-populate form when job loads
  useEffect(() => {
    if (currentBranch && !selectedBranchId) {
      setValue("branch", currentBranch.id);
    }
    if (job && currentBranch) {
      setValue("job_id", job.id);
      // Set customer from job
      if (job.customer) {
        setSelectedCustomer(job.customer);
        setValue("customer_id", job.customer.id, { shouldValidate: true });
      }

      const items: Array<{
        item_type: "SERVICE" | "PART" | "LABOUR" | "OTHER";
        description: string;
        quantity: number;
        unit_price: number;
        gst_rate: number;
      }> = [];

      // 1. Service Charge (Estimate)
      if (job.estimated_cost && Number(job.estimated_cost) > 0) {
        items.push({
          item_type: "SERVICE",
          description: "Service Charge / Repair Cost",
          quantity: 1,
          unit_price: Number(job.estimated_cost),
          gst_rate: 18,
        });
      }

      // 2. Spare Parts
      if (job.diagnosis_parts && job.diagnosis_parts.length > 0) {
        job.diagnosis_parts.forEach((part) => {
          items.push({
            item_type: "PART",
            description: part.name,
            quantity: part.quantity || 1,
            unit_price: Number(part.price),
            gst_rate: 18,
          });
        });
      }

      if (items.length > 0) {
        setValue("line_items", items);
      }
    }
  }, [job, currentBranch, setValue]);

  // Handle direct customer selection (no job)
  const handleCustomerSelect = (customer: Customer | null) => {
    setSelectedCustomer(customer);
    if (customer) {
      setValue("customer_id", customer.id, { shouldValidate: true });
    } else {
      setValue("customer_id", undefined);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateInvoiceFormData) => {
      // Clean up: send null instead of empty strings for optional UUID fields
      const payload = {
        ...data,
        job_id: data.job_id || null,
        customer_id: data.customer_id || null,
        branch: selectedBranchId === "universal" ? null : selectedBranchId,
      };
      return billingApi.createInvoice(payload);
    },
    onSuccess: () => {
      router.push(`/billing`);
    },
    onError: (error: Error) => {
      console.error(error);
    },
  });

  // Calculations
  const lineItems = watch("line_items");
  const subtotal = lineItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0,
  );
  const totalTax = lineItems.reduce((sum, item) => {
    const amount =
      (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    return sum + (amount * (Number(item.gst_rate) || 0)) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax;

  const handlePreview = () => {
    setShowPreview(true);
  };

  // Handle category change for a row
  const handleCategoryChange = (index: number, categoryId: string) => {
    setRowInventory((prev) => ({
      ...prev,
      [index]: { categoryId, itemId: "" },
    }));
  };

  // Handle item selection for a row — auto-fill fields
  const handleItemSelect = (index: number, itemId: string) => {
    const item = allItems.find((i) => i.id === itemId);
    if (!item) return;

    setRowInventory((prev) => ({
      ...prev,
      [index]: { ...prev[index], itemId },
    }));

    // Build rich description: "Category - Item Name"
    const categoryObj = categories.find((c) => c.id === item.category);
    const categoryName = categoryObj?.name || "";
    const richDescription = categoryName
      ? `${categoryName} - ${item.name}`
      : item.name;

    // Auto-fill form fields with validation trigger
    setValue(`line_items.${index}.description`, richDescription, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.unit_price`, item.selling_price, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.gst_rate`, item.gst_rate || 18, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.hsn_sac_code`, item.hsn_code || "", {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.inventory_item`, item.id, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.item_type`, "PART", { shouldValidate: true });
  };

  // Handle row removal — clean up inventory state
  const handleRemoveRow = (index: number) => {
    remove(index);
    setRowInventory((prev) => {
      const next: Record<number, RowInventoryState> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k < index) next[k] = val;
        else if (k > index) next[k - 1] = val;
      });
      return next;
    });
  };

  if (isLoadingJob) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          <span className="ml-3 text-neutral-600">Loading Job Details...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canCreateInvoices">
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6">
          <Header
            title="Create Invoice"
            subtitle={job ? `For Job: ${job.job_number}` : "New Invoice"}
            actions={
              <Link href={jobId ? `/jobs/${jobId}` : "/billing"}>
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
              </Link>
            }
          />

          <form
            onSubmit={handleSubmit(handlePreview, (err) =>
              console.log("Form Validation Errors:", err),
            )}
            className="space-y-6"
          >
            {/* Hidden inputs for validation */}
            <input type="hidden" {...register("job_id")} />
            <input type="hidden" {...register("customer_id")} />
            <input type="hidden" {...register("branch")} />

            {/* Branch Selection (Owners Only) */}
            {hasPermission("canManageBranches") && (
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary-500" />
                  Branch Assignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Assign to Branch"
                    value={selectedBranchId}
                    onChange={(e) => {
                      setSelectedBranchId(e.target.value);
                      setValue("branch", e.target.value);
                    }}
                    options={[
                      {
                        value: "universal",
                        label: "🌍 Universal / All Branches",
                      },
                      ...(Array.isArray(branches)
                        ? branches
                        : Object.hasOwn(branches, "results")
                          ? (branches as any).results
                          : []
                      ).map((b: any) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <p className="text-sm text-neutral-500 mt-1 col-span-full">
                    Universal invoices are visible across all branches.
                  </p>
                </div>
              </Card>
            )}

            {/* Customer Section */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-600" />
                Bill To
              </h3>

              {/* Path 1: Job exists — show customer from job (read-only) */}
              {job && job.customer ? (
                <div className="space-y-3">
                  <div className="p-4 border border-primary-200 bg-primary-50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-medium">
                        {job.customer.first_name[0]}
                        {job.customer.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">
                          {job.customer.first_name} {job.customer.last_name}
                        </p>
                        <p className="text-sm text-neutral-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {job.customer.mobile} • {job.customer.email}
                        </p>
                        <p className="text-sm text-neutral-400 mt-1">
                          Job: {job.job_number} • {job.brand} {job.model} (
                          {job.device_type})
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Path 2: No job — show customer search */
                <CustomerSearch
                  onSelect={handleCustomerSelect}
                  selectedCustomer={selectedCustomer}
                  branchId={currentBranch?.id || ""}
                />
              )}

              {/* Validation error for customer */}
              {errors.customer_id && (
                <p className="text-sm text-red-600 mt-2">
                  {errors.customer_id.message}
                </p>
              )}
            </Card>

            {/* Line Items Editor */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Invoice Items
              </h3>
              <div className="space-y-4">
                {/* Header Row */}
                <div className="grid grid-cols-[9rem_9rem_1fr_4.5rem_6rem_4.5rem_2rem] gap-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider px-1">
                  <div>Category</div>
                  <div>Item</div>
                  <div>Description</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Price (₹)</div>
                  <div className="text-right">GST %</div>
                  <div></div>
                </div>

                {fields.map((field, index) => {
                  const rowState = rowInventory[index] || {
                    categoryId: "",
                    itemId: "",
                  };
                  const filteredItems = getItemsForCategory(
                    rowState.categoryId,
                  );

                  return (
                    <div
                      key={field.id}
                      className="grid grid-cols-[9rem_9rem_1fr_4.5rem_6rem_4.5rem_2rem] gap-3 items-start p-3 rounded-lg border border-neutral-100 bg-neutral-50/40 hover:border-neutral-200 transition-colors"
                    >
                      {/* Category Dropdown */}
                      <div>
                        <Select
                          value={rowState.categoryId}
                          onChange={(e) => handleCategoryChange(index, e.target.value)}
                          options={categories.map((cat) => ({
                            value: cat.id,
                            label: cat.name,
                          }))}
                          placeholder="All Categories"
                        />
                      </div>

                      {/* Item Dropdown */}
                      <div>
                        <Select
                          value={rowState.itemId}
                          onChange={(e) => handleItemSelect(index, e.target.value)}
                          options={filteredItems.map((item) => ({
                            value: item.id,
                            label: `${item.name} ${item.quantity > 0 ? `(${item.quantity})` : "(Out)"}`,
                          }))}
                          placeholder="— Select Item —"
                        />
                      </div>

                      {/* Description + Type */}
                      <div className="space-y-1">
                        <Input
                          {...register(
                            `line_items.${index}.description` as const,
                          )}
                          placeholder="Item description / specifications"
                          error={
                            errors.line_items?.[index]?.description?.message
                          }
                        />
                        <div className="flex gap-2 items-center">
                          <Select
                            {...register(
                              `line_items.${index}.item_type` as const,
                            )}
                            options={[
                              { value: "SERVICE", label: "Service" },
                              { value: "PART", label: "Part" },
                              { value: "LABOUR", label: "Labour" },
                              { value: "OTHER", label: "Other" },
                            ]}
                          />
                          {rowState.itemId && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Linked
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Qty */}
                      <div className="space-y-1">
                        <Input
                          type="number"
                          {...register(
                            `line_items.${index}.quantity` as const,
                            {
                              valueAsNumber: true,
                            },
                          )}
                          className="text-center"
                          min={1}
                          error={errors.line_items?.[index]?.quantity?.message}
                        />
                      </div>

                      {/* Price */}
                      <div className="space-y-1">
                        <Input
                          type="number"
                          {...register(
                            `line_items.${index}.unit_price` as const,
                            {
                              valueAsNumber: true,
                            },
                          )}
                          className="text-right"
                          min={0}
                          step="0.01"
                          error={
                            errors.line_items?.[index]?.unit_price?.message
                          }
                        />
                      </div>

                      {/* GST */}
                      <div className="space-y-1">
                        <Input
                          type="number"
                          {...register(
                            `line_items.${index}.gst_rate` as const,
                            {
                              valueAsNumber: true,
                            },
                          )}
                          className="text-right"
                          min={0}
                          error={errors.line_items?.[index]?.gst_rate?.message}
                        />
                      </div>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        className="mt-2 text-red-400 hover:text-red-600 disabled:opacity-30 transition-colors"
                        disabled={fields.length === 1}
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() =>
                    append({
                      item_type: "PART",
                      description: "",
                      quantity: 1,
                      unit_price: 0,
                      gst_rate: 18,
                      inventory_item: undefined,
                    })
                  }
                >
                  Add Item
                </Button>
              </div>

              {/* Summary Calculations */}
              <div className="flex justify-end pt-6 mt-6 border-t border-neutral-100">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Tax (GST)</span>
                    <span>₹{totalTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-neutral-900 border-t pt-2">
                    <span>Total</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-4">
              <Link href={jobId ? `/jobs/${jobId}` : "/billing"}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" leftIcon={<FileText className="w-4 h-4" />}>
                Preview Invoice
              </Button>
            </div>
          </form>

          {/* Preview Modal */}
          {showPreview && (
            <InvoicePreviewModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              onConfirm={handleSubmit((data) => mutate(data))}
              isSubmitting={isPending}
              formData={watch()}
              jobDetails={job ?? null}
              subtotal={subtotal}
              totalTax={totalTax}
              grandTotal={grandTotal}
              customer={job?.customer}
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function CreateInvoicePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            <span className="ml-3 text-neutral-600">Loading...</span>
          </div>
        </AppLayout>
      }
    >
      <CreateInvoiceContent />
    </Suspense>
  );
}
