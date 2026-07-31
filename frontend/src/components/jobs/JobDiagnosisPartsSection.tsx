"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Input } from "@/components/ui";
import { Plus, Trash2, Package, ChevronDown, Check } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import type { InventoryItem } from "@/types";

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

interface InventoryPartComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectInventoryItem: (item: InventoryItem) => void;
  inventoryItems: InventoryItem[];
  isLoading?: boolean;
}

function InventoryPartCombobox({
  value,
  onChange,
  onSelectInventoryItem,
  inventoryItems,
  isLoading,
}: InventoryPartComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
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

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Input
          placeholder="Search inventory or enter part name..."
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
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-2xl py-1 dark:bg-slate-900 dark:border-slate-700">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-neutral-400 border-b border-neutral-100 flex items-center justify-between dark:border-slate-800 bg-neutral-50/50 dark:bg-slate-800/50">
            <span className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300">
              <Package className="w-3.5 h-3.5 text-primary-500" />
              Select Part from Inventory
            </span>
            {isLoading ? (
              <span className="text-[10px] text-neutral-400 animate-pulse">Loading items...</span>
            ) : (
              <span className="text-[10px] text-neutral-400">{inventoryItems.length} items available</span>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-3.5 text-xs text-neutral-500 text-center">
              {value
                ? `No inventory item matches "${value}". Typing custom part name.`
                : "No items in inventory."}
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
                      ₹{parseFloat(String(item.selling_price || 0)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                    <span className="truncate">
                      {item.category_name ? `${item.category_name} · ` : ""}
                      SKU: {item.sku || "N/A"}
                      {item.warranty_period_months ? ` · ${item.warranty_period_months}m warranty` : ""}
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
        </div>
      )}
    </div>
  );
}

export function JobDiagnosisPartsSection({
  parts,
  totalPartsPrice,
  onAddPart,
  onRemovePart,
  onPartChange,
}: JobDiagnosisPartsSectionProps) {
  // Fetch inventory items for selection
  const { data: inventoryData, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory-items-diagnosis"],
    queryFn: () => inventoryApi.list({ limit: 200 }),
  });

  const inventoryItems: InventoryItem[] = useMemo(
    () => inventoryData?.results || [],
    [inventoryData],
  );

  const handleSelectInventoryItem = (index: number, item: InventoryItem) => {
    onPartChange(index, "name", item.name);
    onPartChange(index, "price", String(item.selling_price || 0));
    onPartChange(
      index,
      "warranty_months",
      String(item.warranty_period_months || 0),
    );
    if (!parts[index]?.quantity || parts[index]?.quantity === "0") {
      onPartChange(index, "quantity", "1");
    }
  };

  const handleQuickAddInventoryItem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const item = inventoryItems.find((i) => i.id === selectedId);
    if (item) {
      onAddPart();
      const nextIndex = parts.length;
      setTimeout(() => {
        onPartChange(nextIndex, "name", item.name);
        onPartChange(nextIndex, "price", String(item.selling_price || 0));
        onPartChange(
          nextIndex,
          "warranty_months",
          String(item.warranty_period_months || 0),
        );
        onPartChange(nextIndex, "quantity", "1");
      }, 0);
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-4 pt-4 border-t border-neutral-100 dark:border-slate-800">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-primary-500" />
            Spare Parts
          </h4>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Select parts from inventory or enter custom spare parts required.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {inventoryItems.length > 0 && (
            <div className="relative">
              <select
                onChange={handleQuickAddInventoryItem}
                className="h-9 pl-3 pr-8 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-slate-800 dark:text-primary-300 dark:hover:bg-slate-700 border border-primary-200 dark:border-slate-700 rounded-lg cursor-pointer transition-colors appearance-none"
                defaultValue=""
              >
                <option value="" disabled>
                  + Add from Inventory...
                </option>
                {inventoryItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — ₹{item.selling_price} (Stock: {item.quantity})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-primary-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddPart}
            type="button"
          >
            Add Custom Part
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {parts.length > 0 && (
          <div className="grid grid-cols-[minmax(240px,1fr)_7.5rem_4.5rem_7rem_2.5rem] gap-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-1">
            <div>Part Name (Inventory / Custom)</div>
            <div>Price (₹)</div>
            <div>Qty</div>
            <div>Warranty (Mo)</div>
            <div />
          </div>
        )}

        {parts.map((part, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(240px,1fr)_7.5rem_4.5rem_7rem_2.5rem] gap-3 items-center bg-neutral-50/50 dark:bg-slate-800/40 p-2 rounded-xl border border-neutral-100 dark:border-slate-800"
          >
            <div>
              <InventoryPartCombobox
                value={part.name}
                onChange={(val) => onPartChange(index, "name", val)}
                onSelectInventoryItem={(item) =>
                  handleSelectInventoryItem(index, item)
                }
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
                onChange={(e) =>
                  onPartChange(index, "warranty_months", e.target.value)
                }
                className="h-10 text-sm text-center font-medium"
              />
            </div>
            <div className="flex justify-center">
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
              Select parts directly from your inventory or add custom items.
            </p>
          </div>
        )}

        {parts.length > 0 && (
          <div className="flex justify-between items-center pt-3 px-1 border-t border-neutral-100 dark:border-slate-800">
            <span className="text-xs text-neutral-500 font-medium">
              Total {parts.length} part{parts.length > 1 ? "s" : ""} included
            </span>
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Total Parts Cost:{" "}
              <span className="text-emerald-600 dark:text-emerald-400 text-base ml-1">
                ₹{totalPartsPrice.toFixed(2)}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
