"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Select, Alert } from "@/components/ui";
import { jobsApi, billingApi } from "@/lib/api";
import {
  ArrowLeft,
  Printer,
  Plus,
  Trash2,
  FileText,
  Save,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { Invoice } from "@/types";

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
});

const createInvoiceSchema = z.object({
  job_id: z.string().uuid("Invalid Job ID"),
  branch: z.string().uuid("Invalid Branch ID"),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  line_items: z.array(invoiceLineItemSchema).min(1, "Add at least one item"),
});

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

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

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  formData: CreateInvoiceFormData;
  jobDetails: any; // Using any to simplify prop drilling for read-only display
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  customer: any;
  branchName: string;
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
  branchName,
}: InvoicePreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop - hidden on print */}
      <div className="fixed inset-0 bg-black/50 no-print" onClick={onClose} />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4 no-print">
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

          <div className="p-8 space-y-6">
            {/* Same Header Style as Job Card */}
            <div className="border-2 border-neutral-900 p-4 bg-neutral-50 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4 items-center">
                  <BrandLogo brand="HP" />
                  <BrandLogo brand="DELL" />
                  <BrandLogo brand="ASUS" />
                  <BrandLogo brand="LENOVO" />
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-bold text-neutral-900">
                    SHIVANGI INFOTECH
                  </h1>
                  <p className="text-sm text-neutral-600">
                    HP | DELL | ASUS Authorised Partner
                  </p>
                </div>
              </div>
              <div className="text-center border-t border-neutral-300 pt-2 text-xs text-neutral-500">
                <p>
                  Shop No. 3, Ground Floor, Sai Complex, Pune-Nashik Highway,
                  Pune 411039
                </p>
                <p>Phone: +91 99999 88888 | Email: support@shivangiinfo.com</p>
                <p className="mt-1 font-semibold">GSTIN: 27ABCDE1234F1Z5</p>
              </div>
            </div>

            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-neutral-500 text-sm uppercase tracking-wider mb-1">
                  Bill To
                </h3>
                <p className="font-bold text-lg text-neutral-900">
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
                  <p className="text-sm font-mono mt-2">
                    GSTIN: {customer.gstin}
                  </p>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-3xl font-light text-primary-600 mb-2">
                  INVOICE
                </h2>
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
            <table className="w-full mb-8">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-600 font-semibold text-left">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Item & Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Rate</th>
                  <th className="px-4 py-3 text-right">Tax %</th>
                  <th className="px-4 py-3 text-right">Amount</th>
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
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">
                      ₹{item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {item.gst_rate}%
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      ₹{(item.quantity * item.unit_price).toFixed(2)}
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

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 p-4 flex justify-end gap-3 rounded-b-xl">
            <Button variant="secondary" onClick={onClose}>
              Back to Edit
            </Button>
            <Button
              onClick={() => window.print()}
              variant="outline"
              leftIcon={<Printer className="w-4 h-4" />}
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

      {/* Printable Area (Hidden from Screen) */}
      <div className="hidden print:block print:p-8">
        {/* Same structure as above for plain HTML print if needed, but the modal content itself is printable via window.print() if CSS allows. 
                 The standard way is to hide everything else and show only the invoice container. 
                 We'll assume globals.css handles @media print to hide non-print elements. 
             */}
        {/* We rely on the user printing the modal content by hiding the backdrop/buttons via CSS if possible, but simplest is to have a dedicated print view. 
                 For now, we'll let the user print the page and hope the modal layout is printer-friendly enough or relies on hiding sidebar/headers. 
              */}
      </div>
    </div>
  );
}

// =====================================================
// Main Page Component
// =====================================================

export default function CreateInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { currentBranch } = useAuth();
  const [showPreview, setShowPreview] = useState(false);

  // Fetch job details to pre-fill
  const { data: job, isLoading: isLoadingJob } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
  });

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
    if (job && currentBranch) {
      setValue("job_id", job.id);
      setValue("branch", currentBranch.id);

      const items: any[] = [];

      // 1. Service Charge (Estimate)
      if (job.estimated_cost && Number(job.estimated_cost) > 0) {
        items.push({
          item_type: "SERVICE",
          description: "Service Charge / Repair Cost",
          quantity: 1,
          unit_price: Number(job.estimated_cost),
          gst_rate: 18, // Default service tax
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
            gst_rate: 18, // Default goods tax
          });
        });
      }

      // If we found items, set them; else keep default
      if (items.length > 0) {
        setValue("line_items", items);
      }
    }
  }, [job, currentBranch, setValue]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateInvoiceFormData) => billingApi.createInvoice(data),
    onSuccess: (invoice) => {
      router.push(`/billing`); // Or show success and redirect
    },
    onError: (error: any) => {
      console.error(error);
    },
  });

  // Calculations
  const lineItems = watch("line_items");
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );
  const totalTax = lineItems.reduce((sum, item) => {
    const amount = item.quantity * item.unit_price;
    return sum + (amount * (item.gst_rate || 0)) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax;

  const handlePreview = (data: CreateInvoiceFormData) => {
    setShowPreview(true);
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
        <div className="max-w-4xl mx-auto p-6">
          <Header
            title="Create Invoice"
            subtitle={job ? `For Job: ${job.job_number}` : "New Invoice"}
            showBack
            backUrl={jobId ? `/jobs/${jobId}` : "/billing"}
          />

          <form onSubmit={handleSubmit(handlePreview)} className="space-y-6">
            {/* Customer Summary (Read Only) */}
            {job && (
              <Card>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-neutral-900">
                      Bill To: {job.customer?.first_name}{" "}
                      {job.customer?.last_name}
                    </h3>
                    <p className="text-neutral-500">
                      {job.customer?.mobile} • {job.customer?.email}
                    </p>
                    <p className="text-sm text-neutral-400 mt-1">
                      Device: {job.brand} {job.model} ({job.device_type})
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Line Items Editor */}
            <Card title="Invoice Items">
              <div className="space-y-4">
                {/* Header Row */}
                <div className="grid grid-cols-[1fr_5rem_7rem_5rem_2rem] gap-4 text-sm font-medium text-neutral-500 px-2">
                  <div>Description</div>
                  <div className="text-center">Qty</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">GST %</div>
                  <div></div>
                </div>

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[1fr_5rem_7rem_5rem_2rem] gap-4 items-start"
                  >
                    <div className="space-y-1">
                      <Input
                        {...register(
                          `line_items.${index}.description` as const
                        )}
                        placeholder="Item description"
                        error={errors.line_items?.[index]?.description?.message}
                      />
                      <div className="flex gap-2">
                        <select
                          {...register(
                            `line_items.${index}.item_type` as const
                          )}
                          className="text-xs bg-neutral-50 border-none rounded py-1 px-2 text-neutral-600 focus:ring-1"
                        >
                          <option value="SERVICE">Service</option>
                          <option value="PART">Part</option>
                          <option value="LABOUR">Labour</option>
                        </select>
                      </div>
                    </div>

                    <Input
                      type="number"
                      {...register(`line_items.${index}.quantity` as const, {
                        valueAsNumber: true,
                      })}
                      className="text-center"
                      min={1}
                    />

                    <Input
                      type="number"
                      {...register(`line_items.${index}.unit_price` as const, {
                        valueAsNumber: true,
                      })}
                      className="text-right"
                      min={0}
                      step="0.01"
                    />

                    <Input
                      type="number"
                      {...register(`line_items.${index}.gst_rate` as const, {
                        valueAsNumber: true,
                      })}
                      className="text-right"
                      min={0}
                    />

                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mt-2 text-red-500 hover:text-red-700 disabled:opacity-50"
                      disabled={fields.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

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
              jobDetails={job}
              subtotal={subtotal}
              totalTax={totalTax}
              grandTotal={grandTotal}
              customer={job?.customer}
              branchName={currentBranch?.name || ""}
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
