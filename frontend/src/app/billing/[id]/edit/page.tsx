"use client";

import React, { useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { Card, Button, Input, LoadingState, Select } from "@/components/ui";
import { billingApi, branchesApi, inventoryApi } from "@/lib/api";
import {
  ArrowLeft,
  Printer,
  Plus,
  Trash2,
  FileText,
  Save,
  Package,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { Invoice } from "@/types";

// =====================================================
// Schemas & Types
// =====================================================

const invoiceLineItemSchema = z.object({
  id: z.string().optional(),
  item_type: z.enum(["SERVICE", "PART", "LABOUR", "OTHER"]),
  description: z.string().min(1, "Description is required"),
  hsn_sac_code: z.string().optional(),
  quantity: z.number().min(1, "Minimum quantity is 1"),
  unit_price: z.number().min(0, "Price cannot be negative"),
  gst_rate: z.number().min(0, "GST rate cannot be negative"),
  inventory_item: z.string().uuid().optional(),
});

const updateInvoiceSchema = z.object({
  branch: z.string().optional(),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  line_items: z.array(invoiceLineItemSchema).min(1, "Add at least one item"),
});

type UpdateInvoiceFormData = z.infer<typeof updateInvoiceSchema>;

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
// Invoice Template Component (Shared for Screen & Print)
// =====================================================

interface InvoiceTemplateProps {
  formData: UpdateInvoiceFormData;
  invoice: Invoice;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
}

function InvoiceTemplate({
  formData,
  invoice,
  subtotal,
  totalTax,
  grandTotal,
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
          <p className="font-bold text-lg">{invoice.customer_name}</p>
          <p className="text-neutral-600">{invoice.customer_mobile}</p>
          <p className="text-neutral-600 max-w-xs">
            {invoice.customer_address}
          </p>
          {invoice.customer_gstin && (
            <p className="text-sm font-mono mt-2">
              GSTIN: {invoice.customer_gstin}
            </p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-light text-primary-600 mb-2">INVOICE</h2>
          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="font-medium mr-2">Invoice #:</span>
              {invoice.invoice_number}
            </p>
            <p>
              <span className="font-medium mr-2">Date:</span>
              {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
            </p>
            {invoice.job_number && (
              <p>
                <span className="font-medium mr-2">Job Ref:</span>
                {invoice.job_number}
              </p>
            )}
            <p>
              <span className="font-medium mr-2">Status:</span>
              {invoice.status}
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
                <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded print:hidden">
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
  );
}

// =====================================================
// Print Portal Util
// =====================================================

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root">{children}</div>,
    document.body,
  );
};

// =====================================================
// Invoice Preview Modal
// =====================================================

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  formData: UpdateInvoiceFormData;
  invoice: Invoice;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
}

function InvoicePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  formData,
  invoice,
  subtotal,
  totalTax,
  grandTotal,
}: InvoicePreviewModalProps) {
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
                Review details before saving.
              </p>
            </div>

            {/* Template Rendered for Screen */}
            <div className="p-0">
              <InvoiceTemplate
                formData={formData}
                invoice={invoice}
                subtotal={subtotal}
                totalTax={totalTax}
                grandTotal={grandTotal}
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
                Confirm & Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Area */}
      <PrintPortal>
        <InvoiceTemplate
          formData={formData}
          invoice={invoice}
          subtotal={subtotal}
          totalTax={totalTax}
          grandTotal={grandTotal}
        />
      </PrintPortal>
    </>
  );
}

// =====================================================
// Main Page Component
// =====================================================

function EditInvoiceContent() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { currentBranch, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  // Inventory state
  interface RowInventoryState {
    categoryId: string;
    itemId: string;
  }

  const [rowInventory, setRowInventory] = useState<
    Record<number, RowInventoryState>
  >({});

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<UpdateInvoiceFormData>({
    resolver: zodResolver(updateInvoiceSchema),
    defaultValues: {
      line_items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items",
  });

  // Default the selector to current branch
  useEffect(() => {
    if (currentBranch && !selectedBranchId) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch, selectedBranchId]);

  // Fetch inventory data
  const { data: categoriesData } = useQuery({
    queryKey: ["inventory-categories", selectedBranchId || currentBranch?.id],
    queryFn: () =>
      inventoryApi.listCategories(selectedBranchId || currentBranch?.id || ""),
    enabled: !!(selectedBranchId || currentBranch?.id),
  });
  const { data: itemsData } = useQuery({
    queryKey: ["inventory-items", selectedBranchId || currentBranch?.id],
    queryFn: () =>
      inventoryApi.list({
        branch: selectedBranchId || currentBranch?.id || "",
      }),
    enabled: !!(selectedBranchId || currentBranch?.id),
  });

  const categories = categoriesData || [];
  const allItems = itemsData?.results || [];

  const getItemsForCategory = (categoryId: string) => {
    if (!categoryId) return allItems;
    return allItems.filter((i) => i.category === categoryId);
  };

  // Handle category change for a row
  const handleCategoryChange = (index: number, categoryId: string) => {
    setRowInventory((prev) => ({
      ...prev,
      [index]: { categoryId, itemId: "" },
    }));
  };

  // Handle item selection for a row
  const handleItemSelect = (index: number, itemId: string) => {
    const item = allItems.find((i) => i.id === itemId);
    if (!item) return;

    setRowInventory((prev) => ({
      ...prev,
      [index]: { ...prev[index], itemId },
    }));

    const categoryObj = categories.find((c: any) => c.id === item.category);
    const categoryName = categoryObj?.name || "";
    const richDescription = categoryName
      ? `${categoryName} - ${item.name}`
      : item.name;

    setValue(`line_items.${index}.description`, richDescription, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.unit_price`, Number(item.selling_price), {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.gst_rate`, Number(item.gst_rate) || 18, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.inventory_item`, item.id, {
      shouldValidate: true,
    });
    setValue(`line_items.${index}.item_type`, "PART", { shouldValidate: true });
  };

  // Fetch Branches
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });
  const branches = branchesData?.results || [];

  // Fetch invoice details
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => billingApi.getInvoice(id),
    enabled: !!id,
  });

  // Pre-fill form when invoice loads
  useEffect(() => {
    if (invoice) {
      // Set initial branch
      if (invoice.branch) {
        setSelectedBranchId(
          typeof invoice.branch === "string"
            ? invoice.branch
            : (invoice.branch as { id: string })?.id || "",
        );
      } else {
        setSelectedBranchId("universal");
      }

      const nextRowInventory: Record<number, RowInventoryState> = {};
      reset({
        due_date: invoice.due_date
          ? new Date(invoice.due_date).toISOString().split("T")[0]
          : "",
        notes: invoice.notes,
        line_items: (invoice.line_items || []).map((item, idx) => {
<<<<<<< HEAD
          // Initialize row inventory state if it's an inventory item
          if (item.inventory_item) {
            setRowInventory((prev) => ({
              ...prev,
              [idx]: { categoryId: "", itemId: item.inventory_item ?? "" },
            }));
=======
          const invItemId = item.inventory_item;
          if (invItemId) {
            nextRowInventory[idx] = { categoryId: "", itemId: invItemId };
>>>>>>> e3392abbfcd5703f60077fd3a6f34feaff405385
          }
          return {
            id: item.id,
            item_type: item.item_type,
            description: item.description,
            hsn_sac_code: item.hsn_sac_code || "",
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            gst_rate: Number(item.gst_rate),
            inventory_item: item.inventory_item || undefined,
          };
        }),
      });
      setRowInventory(nextRowInventory);
    }
  }, [invoice, reset, router, id]);

  const { mutate, isPending } = useMutation({
    mutationFn: (data: UpdateInvoiceFormData) =>
      billingApi.updateInvoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/billing/${id}`);
    },
    onError: (error: Error) => {
      console.error(error);
      alert("Failed to update invoice");
    },
  });

  const onSubmit = (data: UpdateInvoiceFormData) => {
    const payload = {
      ...data,
      due_date: data.due_date || null,
      branch: selectedBranchId === "universal" ? null : selectedBranchId,
    };
    // Cast is safe because schema is flexible but backend expects null for empty string
    mutate(payload as unknown as UpdateInvoiceFormData);
  };

  // Calculations
  const lineItems = watch("line_items");
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );
  const totalTax = lineItems.reduce((sum, item) => {
    const amount = item.quantity * item.unit_price;
    return sum + (amount * (item.gst_rate || 0)) / 100;
  }, 0);
  const grandTotal = subtotal + totalTax;

  const handlePreview = () => {
    setShowPreview(true);
  };

  if (isLoading || !invoice) {
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canCreateInvoices">
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6">
          <Header
            title={`Edit Invoice ${invoice.invoice_number}`}
            subtitle={format(new Date(invoice.invoice_date), "MMMM dd, yyyy")}
            actions={
              <Link href={`/billing/${id}`}>
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Cancel
                </Button>
              </Link>
            }
          />

          <form onSubmit={handleSubmit(handlePreview)} className="space-y-6">
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
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    options={[
                      {
                        value: "universal",
                        label: "🌍 Universal / All Branches",
                      },
                      ...(Array.isArray(branches)
                        ? branches
                        : Object.hasOwn(branches, "results")
                          ? (
                              branches as {
                                results: Array<{ id: string; name: string }>;
                              }
                            ).results
                          : []
                      ).map((b) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <p className="text-sm text-neutral-500 mt-1 col-span-full">
                    Universal invoices are visible across all branches.
                  </p>
                </div>
              </Card>
            )}

            {/* Customer Summary (Read Only) */}
            <Card>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-neutral-900">
                    Bill To: {invoice.customer_name}
                  </h3>
                  <p className="text-neutral-500">
                    {invoice.customer_mobile} • {invoice.customer_email}
                  </p>
                  <p className="text-sm text-neutral-400 mt-1">
                    {invoice.customer_address}
                  </p>
                </div>
              </div>
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
                  <div className="text-right">Price</div>
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
                          onChange={(e) =>
                            handleCategoryChange(index, e.target.value)
                          }
                          options={categories.map((cat: any) => ({
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
                          onChange={(e) =>
                            handleItemSelect(index, e.target.value)
                          }
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
                          placeholder="Item description"
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
                        {...register(
                          `line_items.${index}.unit_price` as const,
                          {
                            valueAsNumber: true,
                          },
                        )}
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
              <Link href={`/billing/${id}`}>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" leftIcon={<FileText className="w-4 h-4" />}>
                Preview & Save
              </Button>
            </div>
          </form>

          {/* Preview Modal */}
          {showPreview && (
            <InvoicePreviewModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              onConfirm={handleSubmit(onSubmit)}
              isSubmitting={isPending}
              formData={watch()}
              invoice={invoice}
              subtotal={subtotal}
              totalTax={totalTax}
              grandTotal={grandTotal}
            />
          )}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function EditInvoicePage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <LoadingState />
        </AppLayout>
      }
    >
      <EditInvoiceContent />
    </Suspense>
  );
}
