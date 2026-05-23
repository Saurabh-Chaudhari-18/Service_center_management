"use client";

import React, {
  useState,
  useEffect,
  Suspense,
  useCallback,
  useMemo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { Card, Button, Input, Select, CardTitle } from "@/components/ui";
import {
  jobsApi,
  billingApi,
  inventoryApi,
  branchesApi,
} from "@/lib/api";
import {
  ArrowLeft,
  Printer,
  Plus,
  Trash2,
  FileText,
  Loader2,
  Package,
  Phone,
  User,
} from "lucide-react";
import Link from "next/link";
import type { InventoryItem } from "@/types";
import { CustomerSearch } from "@/components/billing/CustomerSearch";
import {
  createInvoiceSchema,
  type CreateInvoiceFormData,
} from "@/components/billing/InvoiceFormTemplate";
import { InvoicePreviewModal } from "@/components/billing/InvoicePreviewModal";
import type { Customer } from "@/types";

// =====================================================
// Schemas & Types
// =====================================================

// Per-row inventory selection state
interface RowInventoryState {
  categoryId: string;
  itemId: string;
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
  }, [job, currentBranch, selectedBranchId, setValue]);

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
      return billingApi.createInvoice(payload as any);
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
                <CardTitle icon={<Printer className="w-4 h-4 text-neutral-400" />} className="mb-4">
                  Branch Assignment
                </CardTitle>
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
              <CardTitle icon={<User className="w-4 h-4 text-neutral-400" />} className="mb-3">
                Bill To
              </CardTitle>

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
              <CardTitle className="mb-4">Invoice Items</CardTitle>
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
                          onChange={(e) =>
                            handleCategoryChange(index, e.target.value)
                          }
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
              customer={job?.customer ?? selectedCustomer}
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
