"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Button,
  Input,
  Textarea,
  Select,
  Modal,
  LoadingState,
  EmptyState,
  Alert,
} from "@/components/ui";
import { inventoryApi } from "@/lib/api";
import {
  Plus,
  Search,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Edit2,
  X,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Monitor,
  Battery,
  Keyboard,
  Plug,
  Fan,
  Mouse,
  Speaker,
  Camera,
  CircuitBoard,
  Box,
  Wrench,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  History,
  Info,
} from "lucide-react";
import type { InventoryItem, StockAdjustment } from "@/types";

// =====================================================
// Category Icon & Color Maps
// =====================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  RAM: <Cpu className="w-5 h-5" />,
  SSD: <HardDrive className="w-5 h-5" />,
  HDD: <HardDrive className="w-5 h-5" />,
  Screen: <Monitor className="w-5 h-5" />,
  Battery: <Battery className="w-5 h-5" />,
  Keyboard: <Keyboard className="w-5 h-5" />,
  Charger: <Plug className="w-5 h-5" />,
  Motherboard: <CircuitBoard className="w-5 h-5" />,
  Fan: <Fan className="w-5 h-5" />,
  Trackpad: <Mouse className="w-5 h-5" />,
  Speaker: <Speaker className="w-5 h-5" />,
  Camera: <Camera className="w-5 h-5" />,
  Other: <Box className="w-5 h-5" />,
};

const CATEGORY_COLORS: Record<
  string,
  { bg: string; text: string; gradient: string }
> = {
  RAM: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    gradient: "from-blue-500 to-blue-600",
  },
  SSD: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    gradient: "from-purple-500 to-purple-600",
  },
  HDD: {
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    gradient: "from-indigo-500 to-indigo-600",
  },
  Screen: {
    bg: "bg-cyan-50",
    text: "text-cyan-600",
    gradient: "from-cyan-500 to-cyan-600",
  },
  Battery: {
    bg: "bg-green-50",
    text: "text-green-600",
    gradient: "from-green-500 to-green-600",
  },
  Keyboard: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    gradient: "from-amber-500 to-amber-600",
  },
  Charger: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    gradient: "from-orange-500 to-orange-600",
  },
  Motherboard: {
    bg: "bg-red-50",
    text: "text-red-600",
    gradient: "from-red-500 to-red-600",
  },
  Fan: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    gradient: "from-teal-500 to-teal-600",
  },
  Trackpad: {
    bg: "bg-pink-50",
    text: "text-pink-600",
    gradient: "from-pink-500 to-pink-600",
  },
  Speaker: {
    bg: "bg-violet-50",
    text: "text-violet-600",
    gradient: "from-violet-500 to-violet-600",
  },
  Camera: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    gradient: "from-rose-500 to-rose-600",
  },
  Other: {
    bg: "bg-gray-50",
    text: "text-gray-600",
    gradient: "from-gray-500 to-gray-600",
  },
};

// =====================================================
// Stock Status Badge
// =====================================================

function StockBadge({ item }: { item: InventoryItem }) {
  if (item.quantity === 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-700 ring-1 ring-red-200">
        Out of Stock
      </span>
    );
  }
  if (item.is_low_stock) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200">
        Low Stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      In Stock
    </span>
  );
}

// =====================================================
// Category Chip (compact horizontal design)
// =====================================================

interface CategoryChipProps {
  category: {
    id: string;
    name: string;
    item_count: number;
    total_quantity: number;
  };
  isActive: boolean;
  onClick: () => void;
}

function CategoryChip({ category, isActive, onClick }: CategoryChipProps) {
  const icon = CATEGORY_ICONS[category.name] || <Package className="w-5 h-5" />;
  const colors = CATEGORY_COLORS[category.name] || {
    bg: "bg-gray-50",
    text: "text-gray-600",
    gradient: "from-gray-500 to-gray-600",
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-150 whitespace-nowrap text-sm ${
        isActive
          ? "border-primary-400 bg-primary-50 text-primary-700 shadow-sm font-semibold"
          : "border-neutral-150 bg-white text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
      }`}
    >
      <span className={`${isActive ? "text-primary-600" : colors.text}`}>
        {icon}
      </span>
      <span>{category.name}</span>
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500"}`}
      >
        {category.item_count}
      </span>
    </button>
  );
}

// =====================================================
// Slide-In Detail Panel (Zoho-style)
// =====================================================

interface DetailPanelProps {
  item: InventoryItem;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}

function DetailPanel({ item, onClose, onEdit, onAdjust }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "history">(
    "overview",
  );

  // Fetch stock adjustments
  const { data: adjustments } = useQuery({
    queryKey: ["adjustments", item.id],
    queryFn: () => inventoryApi.getAdjustments(item.id),
    enabled: activeTab === "history",
  });

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Info },
    { id: "history" as const, label: "Stock History", icon: History },
  ];

  return (
    <div className="w-full lg:w-[480px] shrink-0 border-l border-neutral-200 bg-white flex flex-col h-full overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900 truncate">
            {item.name}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            SKU: {item.sku || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => onEdit(item)}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-700 transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stock Summary Bar */}
      <div className="grid grid-cols-3 gap-0 border-b border-neutral-100">
        <div className="p-3 text-center border-r border-neutral-100">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">
            Quantity
          </p>
          <p
            className={`text-xl font-bold mt-1 ${item.quantity === 0 ? "text-red-600" : item.is_low_stock ? "text-amber-600" : "text-neutral-900"}`}
          >
            {item.quantity}
          </p>
        </div>
        <div className="p-3 text-center border-r border-neutral-100">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">
            Cost
          </p>
          <p className="text-lg font-semibold mt-1 text-neutral-700">
            ₹{(item.cost_price || 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-neutral-400 uppercase tracking-wide">
            Selling
          </p>
          <p className="text-lg font-semibold mt-1 text-green-600">
            ₹{(item.selling_price || 0).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Adjust Stock Button */}
      <div className="px-5 py-3 border-b border-neutral-100">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => onAdjust(item)}
          leftIcon={<ArrowUpDown className="w-4 h-4" />}
        >
          Adjust Stock
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "overview" && (
          <div className="p-5 space-y-5">
            {/* Status */}
            <div className="flex items-center gap-2">
              <StockBadge item={item} />
              {item.category_name && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${CATEGORY_COLORS[item.category_name]?.bg || "bg-gray-50"} ${CATEGORY_COLORS[item.category_name]?.text || "text-gray-600"}`}
                >
                  {CATEGORY_ICONS[item.category_name] && (
                    <span className="[&>svg]:w-3 [&>svg]:h-3">
                      {CATEGORY_ICONS[item.category_name]}
                    </span>
                  )}
                  {item.category_name}
                </span>
              )}
            </div>

            {/* Details Grid */}
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Item Details
              </h3>
              <DetailRow label="Unit" value={item.unit} />
              <DetailRow
                label="Low Stock Threshold"
                value={String(item.low_stock_threshold || 5)}
              />
              <DetailRow label="GST Rate" value={`${item.gst_rate || 18}%`} />
              <DetailRow label="HSN Code" value={item.hsn_code || "—"} />
            </div>

            {/* Pricing */}
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Pricing
              </h3>
              <DetailRow
                label="Cost Price"
                value={`₹${(item.cost_price || 0).toLocaleString("en-IN")}`}
              />
              <DetailRow
                label="Selling Price"
                value={`₹${(item.selling_price || 0).toLocaleString("en-IN")}`}
                highlight
              />
              <DetailRow
                label="Margin"
                value={
                  item.cost_price > 0
                    ? `${(((item.selling_price - item.cost_price) / item.cost_price) * 100).toFixed(1)}%`
                    : "—"
                }
              />
            </div>

            {/* Vendor */}
            {(item.vendor_name || item.vendor_contact) && (
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Vendor Info
                </h3>
                <DetailRow label="Vendor" value={item.vendor_name || "—"} />
                <DetailRow label="Contact" value={item.vendor_contact || "—"} />
              </div>
            )}

            {/* Stock Value */}
            <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-100">
              <div className="flex justify-between items-center">
                <span className="text-sm text-neutral-500">
                  Total Stock Value
                </span>
                <span className="text-lg font-bold text-neutral-900">
                  ₹
                  {((item.cost_price || 0) * item.quantity).toLocaleString(
                    "en-IN",
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="p-5">
            {!adjustments || adjustments.length === 0 ? (
              <div className="text-center py-10">
                <History className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                <p className="text-sm text-neutral-500">
                  No stock adjustments yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {adjustments.map((adj: StockAdjustment) => (
                  <div
                    key={adj.id}
                    className="p-3 rounded-lg border border-neutral-100 hover:border-neutral-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {adj.adjustment_type === "ADD" ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : adj.adjustment_type === "DEDUCT" ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="text-sm font-medium">
                          {adj.adjustment_type}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-semibold ${adj.adjustment_type === "ADD" ? "text-green-600" : adj.adjustment_type === "DEDUCT" ? "text-red-600" : "text-blue-600"}`}
                      >
                        {adj.adjustment_type === "ADD"
                          ? "+"
                          : adj.adjustment_type === "DEDUCT"
                            ? "-"
                            : ""}
                        {adj.quantity ??
                          Math.abs(
                            (adj.new_quantity || 0) -
                              (adj.previous_quantity || 0),
                          )}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">
                      {adj.reason}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-neutral-400">
                      <span>{adj.adjusted_by_name || "System"}</span>
                      <span>
                        {adj.created_at
                          ? new Date(adj.created_at).toLocaleDateString("en-IN")
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-neutral-50">
      <span className="text-sm text-neutral-500">{label}</span>
      <span
        className={`text-sm font-medium ${highlight ? "text-green-600" : "text-neutral-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

// =====================================================
// Add/Edit Item Modal
// =====================================================

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  cost_price: z.number().min(0, "Must be positive"),
  selling_price: z.number().min(0, "Must be positive"),
  gst_rate: z.number().min(0).max(100),
  hsn_code: z.string().optional(),
  low_stock_threshold: z.number().min(0),
  unit: z.string().min(1),
  vendor_name: z.string().optional(),
  vendor_contact: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  branchId: string;
  categories: Array<{ id: string; name: string; description: string }>;
  defaultCategoryId?: string;
}

function ItemModal({
  isOpen,
  onClose,
  item,
  branchId,
  categories,
  defaultCategoryId,
}: ItemModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      gst_rate: 18,
      low_stock_threshold: 5,
      unit: "PCS",
      category: defaultCategoryId || "",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (item) {
        reset({
          name: item.name,
          sku: item.sku || "",
          description: item.description || "",
          category: item.category || "",
          cost_price: Number(item.cost_price) || 0,
          selling_price: Number(item.selling_price) || 0,
          gst_rate: Number(item.gst_rate) || 18,
          hsn_code: item.hsn_code || "",
          low_stock_threshold: Number(item.low_stock_threshold) || 0,
          unit: item.unit || "PCS",
          vendor_name: item.vendor_name || "",
          vendor_contact: item.vendor_contact || "",
        });
      } else {
        reset({
          name: "",
          sku: "",
          description: "",
          category: defaultCategoryId || "",
          cost_price: 0 as unknown as number,
          selling_price: 0 as unknown as number,
          gst_rate: 18,
          hsn_code: "",
          low_stock_threshold: 5,
          unit: "PCS",
          vendor_name: "",
          vendor_contact: "",
        });
      }
    }
  }, [isOpen, item, reset, defaultCategoryId]);

  const {
    mutate,
    isPending,
    error: mutationError,
  } = useMutation({
    mutationFn: (data: ItemFormData) => {
      const cleaned: Partial<InventoryItem> = {
        ...data,
        category: data.category ? data.category : undefined,
      };
      return isEdit
        ? inventoryApi.update(item.id, cleaned)
        : inventoryApi.create({ ...cleaned, branch: branchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["category-stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      reset();
      onClose();
    },
  });

  const categoryOptions = [
    { value: "", label: "— No Category —" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Item" : "Add New Item"}
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
            {isEdit ? "Save Changes" : "Add Item"}
          </Button>
        </>
      }
    >
      {mutationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>Error:</strong> {(mutationError as Error).message}
        </div>
      )}
      <div className="space-y-6">
        {/* Basic Info */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Basic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Item Name"
              {...register("name")}
              error={errors.name?.message}
              required
            />
            <Input label="SKU" {...register("sku")} />
            <Select
              label="Category"
              options={categoryOptions}
              {...register("category")}
            />
            <Input
              label="Unit"
              {...register("unit")}
              placeholder="PCS, NOS, SET"
            />
          </div>
          <div className="mt-3">
            <Textarea
              label="Description"
              {...register("description")}
              rows={2}
            />
          </div>
        </div>

        {/* Pricing & Tax */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Pricing & Tax
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Cost Price (₹)"
              type="number"
              step="0.01"
              {...register("cost_price", { valueAsNumber: true })}
              error={errors.cost_price?.message}
              required
            />
            <Input
              label="Selling Price (₹)"
              type="number"
              step="0.01"
              {...register("selling_price", { valueAsNumber: true })}
              error={errors.selling_price?.message}
              required
            />
            <Input
              label="GST Rate (%)"
              type="number"
              {...register("gst_rate", { valueAsNumber: true })}
            />
            <Input label="HSN Code" {...register("hsn_code")} />
          </div>
        </div>

        {/* Stock & Vendor */}
        <div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-2">
            <Box className="w-4 h-4" /> Stock & Vendor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Low Stock Threshold"
              type="number"
              {...register("low_stock_threshold", { valueAsNumber: true })}
            />
            <Input label="Vendor Name" {...register("vendor_name")} />
            <div className="md:col-span-2">
              <Input label="Vendor Contact" {...register("vendor_contact")} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// Stock Adjustment Modal
// =====================================================

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

function AdjustStockModal({ isOpen, onClose, item }: AdjustStockModalProps) {
  const queryClient = useQueryClient();
  const [adjustType, setAdjustType] = useState<"add" | "deduct" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const qty = parseInt(quantity);
      switch (adjustType) {
        case "add":
          return inventoryApi.addStock(item.id, qty, reason);
        case "deduct":
          return inventoryApi.deductStock(item.id, qty, reason);
        case "set":
          return inventoryApi.adjustStock(item.id, qty, reason);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["category-stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      queryClient.invalidateQueries({ queryKey: ["adjustments"] });
      setQuantity("");
      setReason("");
      onClose();
    },
  });

  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Stock"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!quantity || !reason}
          >
            Apply
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-100">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-neutral-500">
            Current Stock:{" "}
            <span className="font-semibold text-neutral-900">
              {item.quantity} {item.unit}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          {(
            [
              {
                value: "add",
                label: "Add Stock",
                icon: ArrowUpCircle,
                color: "text-green-600",
              },
              {
                value: "deduct",
                label: "Deduct",
                icon: ArrowDownCircle,
                color: "text-red-600",
              },
              {
                value: "set",
                label: "Set Qty",
                icon: Edit2,
                color: "text-blue-600",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAdjustType(opt.value)}
              className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                adjustType === opt.value
                  ? "bg-primary-50 border-primary-300 text-primary-700"
                  : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <opt.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>

        <Input
          label={adjustType === "set" ? "New Quantity" : "Quantity"}
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Purchase order #PO-001"
          required
          rows={2}
        />
        {error && <Alert variant="error">{(error as Error).message}</Alert>}
      </div>
    </Modal>
  );
}

// =====================================================
// Main Inventory Page
// =====================================================

type SortKey = "name" | "quantity" | "cost_price" | "selling_price";
type SortDir = "asc" | "desc";

const SortHeader = ({
  label,
  sortKeyName,
  currentSortKey,
  currentSortDir,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  currentSortKey: SortKey;
  currentSortDir: SortDir;
  onSort: (key: SortKey) => void;
}) => (
  <th
    className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700 select-none"
    onClick={() => onSort(sortKeyName)}
  >
    <span className="flex items-center gap-1">
      {label}
      {currentSortKey === sortKeyName && (
        <span className="text-primary-500">
          {currentSortDir === "asc" ? "↑" : "↓"}
        </span>
      )}
    </span>
  </th>
);

export default function InventoryPage() {
  const { currentBranch } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low_stock" | "out_of_stock">(
    "all",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showCategories, setShowCategories] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: [
      "inventory",
      currentBranch?.id,
      search,
      filter,
      selectedCategory,
    ],
    queryFn: () =>
      inventoryApi.list({
        branch: currentBranch?.id,
        search: search || undefined,
        low_stock: filter === "low_stock" ? true : undefined,
        category: selectedCategory || undefined,
      }),
    enabled: !!currentBranch,
  });

  const { data: stats } = useQuery({
    queryKey: ["inventory-stats", currentBranch?.id],
    queryFn: () => inventoryApi.getStats(),
    enabled: !!currentBranch,
  });

  const { data: categoryStats } = useQuery({
    queryKey: ["category-stats", currentBranch?.id],
    queryFn: () => inventoryApi.getCategoryStats(currentBranch!.id),
    enabled: !!currentBranch,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", currentBranch?.id],
    queryFn: () => inventoryApi.listCategories(currentBranch!.id),
    enabled: !!currentBranch,
  });

  const items = useMemo(() => {
    const raw = data?.results || [];
    return filter === "out_of_stock"
      ? raw.filter((item) => item.quantity === 0)
      : raw;
  }, [data?.results, filter]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal: string | number = a[sortKey] ?? "";
      let bVal: string | number = b[sortKey] ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const activeCategoryName = selectedCategory
    ? categoryStats?.find((c) => c.id === selectedCategory)?.name
    : null;

  return (
    <ProtectedRoute requiredPermission="canViewInventory">
      <AppLayout>
        <Header
          title="Inventory"
          subtitle={`${stats?.total_items || 0} items · ₹${(stats?.total_value || 0).toLocaleString("en-IN")} total value`}
          actions={
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              New
            </Button>
          }
        />

        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
          {/* Main Content */}
          <div
            className={`flex-1 min-w-0 flex flex-col overflow-hidden ${selectedItem ? "hidden lg:flex lg:border-r" : ""}`}
          >
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-neutral-100 p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">
                    Total Items
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">
                    {stats?.total_items || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-neutral-100 p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">
                    Total Value
                  </p>
                  <p className="text-2xl font-bold text-neutral-900 mt-1">
                    ₹{(stats?.total_value || 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-neutral-100 p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">
                    Low Stock
                  </p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">
                    {stats?.low_stock_count || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-neutral-100 p-4">
                  <p className="text-xs text-neutral-400 uppercase tracking-wide">
                    Out of Stock
                  </p>
                  <p className="text-2xl font-bold text-red-600 mt-1">
                    {stats?.out_of_stock_count || 0}
                  </p>
                </div>
              </div>

              {/* Category Chips — Collapsible */}
              {categoryStats && categoryStats.length > 0 && (
                <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                  <button
                    onClick={() => setShowCategories(!showCategories)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    <span>Parts Catalog</span>
                    {showCategories ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showCategories && (
                    <div className="px-4 pb-4 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm ${
                          selectedCategory === null
                            ? "border-primary-400 bg-primary-50 text-primary-700 font-semibold"
                            : "border-neutral-150 bg-white text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                        <span>All</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${selectedCategory === null ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500"}`}
                        >
                          {stats?.total_items || 0}
                        </span>
                      </button>
                      {categoryStats.map((cat) => (
                        <CategoryChip
                          key={cat.id}
                          category={cat}
                          isActive={selectedCategory === cat.id}
                          onClick={() =>
                            setSelectedCategory(
                              selectedCategory === cat.id ? null : cat.id,
                            )
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search, Filters, View Toggle */}
              <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
                <div className="flex-1 w-full">
                  <Input
                    placeholder="Search by name or SKU..."
                    leftIcon={<Search className="w-4 h-4" />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "low_stock", label: "Low Stock" },
                    { value: "out_of_stock", label: "Out of Stock" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFilter(opt.value as typeof filter)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        filter === opt.value
                          ? "bg-primary-500 text-white shadow-sm"
                          : "bg-white text-neutral-500 border border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="flex rounded-lg border border-neutral-200 overflow-hidden ml-1">
                    <button
                      onClick={() => setViewMode("table")}
                      className={`p-2 transition-colors ${viewMode === "table" ? "bg-primary-500 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
                      title="Table View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("card")}
                      className={`p-2 transition-colors ${viewMode === "card" ? "bg-primary-500 text-white" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
                      title="Card View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active filter indicator */}
              {activeCategoryName && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">
                    Showing{" "}
                    <span className="font-semibold text-neutral-800">
                      {activeCategoryName}
                    </span>{" "}
                    · {sortedItems.length} items
                  </span>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="text-primary-500 hover:text-primary-600 font-medium"
                  >
                    Clear filter
                  </button>
                </div>
              )}

              {/* Content */}
              {isLoading ? (
                <LoadingState />
              ) : sortedItems.length === 0 ? (
                <div className="bg-white rounded-xl border border-neutral-100">
                  <EmptyState
                    icon={<Package className="w-8 h-8 text-neutral-300" />}
                    title="No items found"
                    description={
                      search || filter !== "all" || selectedCategory
                        ? "Try adjusting your search, filter, or category"
                        : "Add your first inventory item"
                    }
                    action={
                      !search &&
                      filter === "all" && (
                        <Button
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setShowAddModal(true)}
                        >
                          Add Item
                        </Button>
                      )
                    }
                  />
                </div>
              ) : viewMode === "table" ? (
                /* ═══ TABLE VIEW ═══ */
                <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-neutral-50 border-b border-neutral-100">
                        <tr>
                          <SortHeader label="Name" sortKeyName="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                            SKU
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                            Category
                          </th>
                          <SortHeader label="Qty" sortKeyName="quantity" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                          <SortHeader label="Cost" sortKeyName="cost_price" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                          <SortHeader
                            label="Selling"
                            sortKeyName="selling_price"
                            currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort}
                          />
                          <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-50">
                        {sortedItems.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() =>
                              setSelectedItem(
                                selectedItem?.id === item.id ? null : item,
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedItem?.id === item.id
                                ? "bg-primary-50"
                                : "hover:bg-neutral-50"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span className="text-sm font-medium text-primary-600 hover:text-primary-700">
                                {item.name}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-500">
                              {item.sku || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {item.category_name ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category_name]?.bg || "bg-gray-50"} ${CATEGORY_COLORS[item.category_name]?.text || "text-gray-600"}`}
                                >
                                  {item.category_name}
                                </span>
                              ) : (
                                <span className="text-sm text-neutral-400">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-sm font-semibold ${item.quantity === 0 ? "text-red-600" : item.is_low_stock ? "text-amber-600" : "text-neutral-900"}`}
                              >
                                {item.quantity}{" "}
                                <span className="text-neutral-400 font-normal">
                                  {item.unit}
                                </span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-neutral-600">
                              ₹{(item.cost_price || 0).toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-green-600">
                              ₹
                              {(item.selling_price || 0).toLocaleString(
                                "en-IN",
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StockBadge item={item} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* ═══ CARD VIEW ═══ */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sortedItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() =>
                        setSelectedItem(
                          selectedItem?.id === item.id ? null : item,
                        )
                      }
                      className={`p-4 bg-white rounded-xl border cursor-pointer transition-all ${
                        selectedItem?.id === item.id
                          ? "border-primary-300 ring-1 ring-primary-100"
                          : "border-neutral-100 hover:border-neutral-200 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-neutral-900 truncate text-sm">
                              {item.name}
                            </h3>
                            <StockBadge item={item} />
                          </div>
                          <p className="text-xs text-neutral-400">
                            SKU: {item.sku || "—"}
                          </p>
                        </div>
                        {item.category_name && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category_name]?.bg || "bg-gray-50"} ${CATEGORY_COLORS[item.category_name]?.text || "text-gray-600"}`}
                          >
                            {item.category_name}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <p className="text-xs text-neutral-400">Qty</p>
                          <p
                            className={`text-base font-bold ${item.quantity === 0 ? "text-red-600" : "text-neutral-900"}`}
                          >
                            {item.quantity}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-400">Cost</p>
                          <p className="text-sm font-medium text-neutral-700">
                            ₹{(item.cost_price || 0).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-400">Selling</p>
                          <p className="text-sm font-medium text-green-600">
                            ₹{(item.selling_price || 0).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ SLIDE-IN DETAIL PANEL ═══ */}
          {selectedItem && (
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onEdit={(item) => {
                setEditItem(item);
                setSelectedItem(null);
              }}
              onAdjust={(item) => {
                setAdjustItem(item);
              }}
            />
          )}
        </div>

        {/* Modals */}
        {currentBranch && (
          <>
            <ItemModal
              isOpen={showAddModal}
              onClose={() => setShowAddModal(false)}
              branchId={currentBranch.id}
              categories={categories || []}
              defaultCategoryId={selectedCategory || undefined}
            />
            <ItemModal
              isOpen={!!editItem}
              onClose={() => setEditItem(null)}
              item={editItem}
              branchId={currentBranch.id}
              categories={categories || []}
            />
          </>
        )}
        <AdjustStockModal
          isOpen={!!adjustItem}
          onClose={() => setAdjustItem(null)}
          item={adjustItem}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
