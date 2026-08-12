"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Select, Modal } from "@/components/ui";
import { Plus, Trash2, Package, ChevronDown, Check, PlusCircle } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { InventoryItem } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosisPartFormRow = {
  name: string;
  price: string;
  warranty_months: string;
  quantity: string;
};

interface JobDiagnosisPartsSectionProps {
  parts: DiagnosisPartFormRow[];
  totalPartsPrice: number;
  onAddPart: () => void;
  onRemovePart: (index: number) => void;
  onPartChange: (
    index: number,
    field: keyof DiagnosisPartFormRow,
    value: string,
  ) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick-Add Inventory Item Schema
// ─────────────────────────────────────────────────────────────────────────────

const quickItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  category: z.string().optional(),
  cost_price: z.number().min(0, "Must be >= 0"),
  selling_price: z.number().min(0, "Must be >= 0"),
  gst_rate: z.number().min(0).max(100),
  unit: z.string().min(1),
  warranty_period_months: z.number().min(0),
});
type QuickItemFormData = z.infer<typeof quickItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Quick-Add Inventory Modal
// ─────────────────────────────────────────────────────────────────────────────

interface QuickAddInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  branchId: string;
  onCreated: (item: InventoryItem) => void;
}

function QuickAddInventoryModal({
  isOpen,
  onClose,
  initialName = "",
  branchId,
  onCreated,
}: QuickAddInventoryModalProps) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories", branchId],
    queryFn: () => inventoryApi.listCategories(branchId),
    enabled: isOpen && !!branchId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<QuickItemFormData>({
    resolver: zodResolver(quickItemSchema),
    defaultValues: {
      name: initialName,
      gst_rate: 18,
      unit: "PCS",
      warranty_period_months: 0,
      cost_price: 0 as unknown as number,
      selling_price: 0 as unknown as number,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: initialName,
        sku: "",
        category: "",
        cost_price: 0 as unknown as number,
        selling_price: 0 as unknown as number,
        gst_rate: 18,
        unit: "PCS",
        warranty_period_months: 0,
      });
    }
  }, [isOpen, initialName, reset]);

  const { mutate, isPending, error: mutationError } = useMutation({
    mutationFn: (data: QuickItemFormData) => {
      const cleaned = {
        ...data,
        category: data.category || undefined,
      };
      return inventoryApi.create({ ...cleaned, branch: branchId });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items-diagnosis"] });
      reset();
      onCreated(created);
      onClose();
    },
  });

  const categoryOptions = [
    { value: "", label: "— No Category —" },
    ...(Array.isArray(categories)
      ? categories.map((c: { id: string; name: string }) => ({
          value: c.id,
          label: c.name,
        }))
      : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Add Inventory Item"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((d) => mutate(d))} isLoading={isPending}>
            Add to Inventory
          </Button>
        </>
      }
    >
      {mutationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>Error:</strong> {(mutationError as Error).message}
        </div>
      )}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Item Name"
            {...register("name")}
            error={errors.name?.message}
            required
          />
          <Input label="SKU (Optional)" {...register("sku")} placeholder="e.g. LCD-IP13-BLK" />
          <Select
            label="Category"
            options={categoryOptions}
            {...register("category")}
          />
          <Input label="Unit" {...register("unit")} placeholder="PCS, NOS, SET" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Cost Price (Rs.)"
            type="number"
            step="0.01"
            {...register("cost_price", { valueAsNumber: true })}
            error={errors.cost_price?.message}
            required
          />
          <Input
            label="Selling Price (Rs.)"
            type="number"
            step="0.01"
            {...register("selling_price", { valueAsNumber: true })}
            error={errors.selling_price?.message}
            required
          />
          <Input
            label="Warranty (Months)"
            type="number"
            {...register("warranty_period_months", { valueAsNumber: true })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="GST Rate (%)"
            type="number"
            step="0.01"
            {...register("gst_rate", { valueAsNumber: true })}
          />
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Part Combobox
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryPartComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectInventoryItem: (item: InventoryItem) => void;
  onNewItem: (typedValue: string) => void;
  inventoryItems: InventoryItem[];
  isLoading?: boolean;
}

function InventoryPartCombobox({
  value,
  onChange,
  onSelectInventoryItem,
  onNewItem,
  inventoryItems,
  isLoading,
}: InventoryPartComboboxProps) {
  const [isOpen, setIsOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredItems = useMemo(() => {
    if (!value || !value.trim()) return inventoryItems.slice(0, 15);
    const q = value.toLowerCase();
    return inventoryItems
      .filter(
        (item) =>
          item.name?.toLowerCase().includes(q) ||
          item.sku?.toLowerCase().includes(q) ||
          item.category_name?.toLowerCase().includes(q),
      )
      .slice(0, 15);
  }, [inventoryItems, value]);

  const hasExactMatch = filteredItems.some(
    (item) => item.name.toLowerCase() === value.trim().toLowerCase(),
  );

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          placeholder="Search inventory or type part name..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="h-10 pr-9 text-sm font-medium focus:ring-2 focus:ring-primary-500/20"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 text-neutral-400 hover:text-neutral-600 p-1 transition-colors"
          title="Toggle inventory list"
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary-500" : ""
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl py-1 dark:bg-slate-900 dark:border-slate-700">
          {/* Header */}
          <div className="px-3 py-1.5 text-[11px] font-semibold border-b border-neutral-100 flex items-center justify-between dark:border-slate-800 bg-neutral-50/50 dark:bg-slate-800/50">
            <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
              <Package className="w-3.5 h-3.5 text-primary-500" />
              Select from Inventory
            </span>
            {isLoading ? (
              <span className="text-[10px] text-neutral-400 animate-pulse">Loading...</span>
            ) : (
              <span className="text-[10px] text-neutral-400">{inventoryItems.length} items</span>
            )}
          </div>

          {/* Items list */}
          {filteredItems.length === 0 ? (
            <div className="px-3.5 py-3 text-xs text-neutral-500 text-center">
              {value ? `No match for "${value}"` : "No items in inventory."}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = item.name.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex flex-col gap-1 transition-colors border-b border-neutral-50 dark:border-slate-800/50 last:border-0 ${
                    isSelected
                      ? "bg-primary-50/80 dark:bg-primary-950/40"
                      : "hover:bg-neutral-50 dark:hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    onSelectInventoryItem(item);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between font-semibold text-neutral-900 dark:text-neutral-100">
                    <span className="truncate pr-2 flex items-center gap-1.5">
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
                      {item.name}
                    </span>
                    <span className="text-primary-600 dark:text-primary-400 shrink-0 font-bold">
                      Rs.{parseFloat(String(item.selling_price || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="truncate">
                      {item.category_name ? `${item.category_name} · ` : ""}
                      SKU: {item.sku || "N/A"}
                      {item.warranty_period_months
                        ? ` · ${item.warranty_period_months}m warranty`
                        : ""}
                    </span>
                    <span
                      className={`shrink-0 ml-2 font-medium ${
                        item.quantity > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500"
                      }`}
                    >
                      Stock: {item.quantity} {item.unit || "pcs"}
                    </span>
                  </div>
                </button>
              );
            })
          )}

          {/* New Item button — shown when no exact match */}
          {!hasExactMatch && (
            <button
              type="button"
              onClick={() => {
                onNewItem(value);
                setIsOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-2 border-t border-neutral-100 dark:border-slate-800 bg-primary-50/40 dark:bg-primary-950/20 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              {value.trim()
                ? `Add "${value}" as new inventory item`
                : "Create new inventory item..."}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Section
// ─────────────────────────────────────────────────────────────────────────────

export function JobDiagnosisPartsSection({
  parts,
  totalPartsPrice,
  onAddPart,
  onRemovePart,
  onPartChange,
}: JobDiagnosisPartsSectionProps) {
  const { currentBranch } = useAuth();
  const branchId = currentBranch?.id ?? "";

  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory-items-diagnosis"],
    queryFn: () => inventoryApi.list({ limit: 200 }),
  });

  const inventoryItems: InventoryItem[] = useMemo(
    () => inventoryData?.results || [],
    [inventoryData],
  );

  // Quick-add modal state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddForIndex, setQuickAddForIndex] = useState<number | null>(null);
  const [quickAddInitialName, setQuickAddInitialName] = useState("");

  const handleSelectInventoryItem = (index: number, item: InventoryItem) => {
    onPartChange(index, "name", item.name);
    onPartChange(index, "price", String(item.selling_price || 0));
    onPartChange(index, "warranty_months", String(item.warranty_period_months || 0));
    if (!parts[index]?.quantity || parts[index]?.quantity === "0") {
      onPartChange(index, "quantity", "1");
    }
  };

  const handleOpenNewItem = (index: number, typedValue: string) => {
    setQuickAddForIndex(index);
    setQuickAddInitialName(typedValue);
    setQuickAddOpen(true);
  };

  const handleNewItemCreated = (item: InventoryItem) => {
    if (quickAddForIndex !== null) {
      onPartChange(quickAddForIndex, "name", item.name);
      onPartChange(quickAddForIndex, "price", String(item.selling_price || 0));
      onPartChange(quickAddForIndex, "warranty_months", String(item.warranty_period_months || 0));
      onPartChange(quickAddForIndex, "quantity", "1");
    }
    setQuickAddForIndex(null);
    setQuickAddInitialName("");
  };

  return (
    <>
      <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-slate-800">
        {/* Section header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 text-base">
              <Package className="w-4 h-4 text-primary-500" />
              Spare Parts
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Search inventory — price &amp; warranty auto-fill on selection. Use &ldquo;New Item&rdquo; to add to inventory.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddPart}
            type="button"
          >
            Add Part Row
          </Button>
        </div>

        {/* Parts rows */}
        <div className="space-y-3">
          {parts.length > 0 && (
            <div className="grid grid-cols-[minmax(220px,1fr)_7.5rem_4.5rem_7rem_2.5rem] gap-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-1">
              <div>Part Name (Inventory / Custom)</div>
              <div>Price (Rs.)</div>
              <div>Qty</div>
              <div>Warranty (Mo)</div>
              <div />
            </div>
          )}

          {parts.map((part, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(220px,1fr)_7.5rem_4.5rem_7rem_2.5rem] gap-3 items-start bg-neutral-50/50 dark:bg-slate-800/40 p-2 rounded-xl border border-neutral-100 dark:border-slate-800"
            >
              <div>
                <InventoryPartCombobox
                  value={part.name}
                  onChange={(val) => onPartChange(index, "name", val)}
                  onSelectInventoryItem={(item) => handleSelectInventoryItem(index, item)}
                  onNewItem={(typedValue) => handleOpenNewItem(index, typedValue)}
                  inventoryItems={inventoryItems}
                  isLoading={isLoadingInventory}
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Price"
                  value={part.price}
                  onChange={(e) => onPartChange(index, "price", e.target.value)}
                  className="h-10 text-sm font-medium"
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={part.quantity}
                  onChange={(e) => onPartChange(index, "quantity", e.target.value)}
                  className="h-10 text-sm text-center font-medium"
                />
              </div>
              <div>
                <Input
                  type="number"
                  placeholder="0"
                  value={part.warranty_months}
                  onChange={(e) => onPartChange(index, "warranty_months", e.target.value)}
                  className="h-10 text-sm text-center font-medium"
                />
              </div>
              <div className="flex justify-center pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                  type="button"
                  onClick={() => onRemovePart(index)}
                  title="Remove part"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          {parts.length === 0 && (
            <div className="text-center py-6 px-4 bg-neutral-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-neutral-200 dark:border-slate-700">
              <Package className="w-8 h-8 mx-auto text-neutral-400 dark:text-neutral-500 mb-2" />
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                No spare parts added yet
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Click &ldquo;Add Part Row&rdquo; above to search inventory or add a custom part.
              </p>
            </div>
          )}

          {parts.length > 0 && (
            <div className="flex justify-between items-center pt-3 px-1 border-t border-neutral-100 dark:border-slate-800">
              <span className="text-xs text-neutral-500 font-medium">
                {parts.length} part{parts.length > 1 ? "s" : ""} included
              </span>
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Total Parts Cost:{" "}
                <span className="text-emerald-600 dark:text-emerald-400 text-base ml-1">
                  Rs.{totalPartsPrice.toFixed(2)}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick-Add Inventory Modal */}
      <QuickAddInventoryModal
        isOpen={quickAddOpen}
        onClose={() => {
          setQuickAddOpen(false);
          setQuickAddForIndex(null);
          setQuickAddInitialName("");
        }}
        initialName={quickAddInitialName}
        branchId={branchId}
        onCreated={handleNewItemCreated}
      />
    </>
  );
}