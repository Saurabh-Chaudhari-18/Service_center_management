"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Modal,
  LoadingState,
  EmptyState,
  Badge,
  Alert,
} from "@/components/ui";
import { inventoryApi } from "@/lib/api";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  Edit2,
  History,
  LayoutGrid,
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
} from "lucide-react";
import { format } from "date-fns";
import type { InventoryItem, StockAdjustment } from "@/types";

// =====================================================
// Category Icon Mapping
// =====================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  RAM: <Cpu className="w-6 h-6" />,
  SSD: <HardDrive className="w-6 h-6" />,
  HDD: <HardDrive className="w-6 h-6" />,
  Screen: <Monitor className="w-6 h-6" />,
  Battery: <Battery className="w-6 h-6" />,
  Keyboard: <Keyboard className="w-6 h-6" />,
  Charger: <Plug className="w-6 h-6" />,
  Motherboard: <CircuitBoard className="w-6 h-6" />,
  Fan: <Fan className="w-6 h-6" />,
  Trackpad: <Mouse className="w-6 h-6" />,
  Speaker: <Speaker className="w-6 h-6" />,
  Camera: <Camera className="w-6 h-6" />,
  Other: <Box className="w-6 h-6" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  RAM: "from-blue-500 to-blue-600",
  SSD: "from-purple-500 to-purple-600",
  HDD: "from-indigo-500 to-indigo-600",
  Screen: "from-cyan-500 to-cyan-600",
  Battery: "from-green-500 to-green-600",
  Keyboard: "from-amber-500 to-amber-600",
  Charger: "from-orange-500 to-orange-600",
  Motherboard: "from-red-500 to-red-600",
  Fan: "from-teal-500 to-teal-600",
  Trackpad: "from-pink-500 to-pink-600",
  Speaker: "from-violet-500 to-violet-600",
  Camera: "from-rose-500 to-rose-600",
  Other: "from-gray-500 to-gray-600",
};

// =====================================================
// Stock Status Badge
// =====================================================

function StockStatusBadge({ item }: { item: InventoryItem }) {
  if (item.quantity === 0) {
    return <Badge variant="danger">Out of Stock</Badge>;
  }
  if (item.quantity <= (item.low_stock_threshold || 5)) {
    return <Badge variant="warning">Low Stock</Badge>;
  }
  return <Badge variant="success">In Stock</Badge>;
}

// =====================================================
// Category Card
// =====================================================

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    item_count: number;
    total_quantity: number;
  };
  isActive: boolean;
  onClick: () => void;
}

function CategoryCard({ category, isActive, onClick }: CategoryCardProps) {
  const icon = CATEGORY_ICONS[category.name] || <Package className="w-6 h-6" />;
  const gradient =
    CATEGORY_COLORS[category.name] || "from-gray-500 to-gray-600";

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group ${
        isActive
          ? "border-primary-500 bg-primary-50 shadow-lg shadow-primary-100 scale-[1.02]"
          : "border-neutral-100 bg-white hover:border-neutral-300 hover:shadow-md"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <span className="text-sm font-semibold text-neutral-800">
        {category.name}
      </span>
      <div className="flex items-center gap-1">
        <span className="text-xs text-neutral-400">
          {category.item_count} items
        </span>
        {category.total_quantity > 0 && (
          <span className="text-xs text-green-600 font-medium">
            · {category.total_quantity} qty
          </span>
        )}
      </div>
      {isActive && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full ring-2 ring-white" />
      )}
    </button>
  );
}

// =====================================================
// Inventory Item Card
// =====================================================

interface InventoryItemCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onAdjust: (item: InventoryItem) => void;
}

function InventoryItemCard({ item, onEdit, onAdjust }: InventoryItemCardProps) {
  return (
    <div className="p-5 bg-white border border-neutral-100 rounded-xl hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-neutral-900 truncate">
              {item.name}
            </h3>
            <StockStatusBadge item={item} />
          </div>
          <p className="text-sm text-neutral-500 mb-2">
            SKU: {item.sku || "—"}
          </p>

          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p className="text-xs text-neutral-400">Quantity</p>
              <p
                className={`text-lg font-semibold ${
                  item.quantity === 0
                    ? "text-red-600"
                    : item.quantity <= (item.low_stock_threshold || 5)
                      ? "text-amber-600"
                      : "text-neutral-900"
                }`}
              >
                {item.quantity} {item.unit}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Cost Price</p>
              <p className="text-sm font-medium">
                ₹{(item.cost_price || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-neutral-400">Selling Price</p>
              <p className="text-sm font-medium text-green-600">
                ₹{(item.selling_price || 0).toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-neutral-100">
        <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
          <Edit2 className="w-4 h-4" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onAdjust(item)}>
          <ArrowUpCircle className="w-4 h-4" />
          Adjust Stock
        </Button>
      </div>
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
    defaultValues: item
      ? {
          name: item.name,
          sku: item.sku,
          description: item.description,
          category: (item as unknown as Record<string, string>).category || "",
          cost_price: item.cost_price,
          selling_price: item.selling_price,
          gst_rate: item.gst_rate,
          hsn_code: item.hsn_code,
          low_stock_threshold: item.low_stock_threshold,
          unit: item.unit,
          vendor_name: item.vendor_name,
          vendor_contact: item.vendor_contact,
        }
      : {
          gst_rate: 18,
          low_stock_threshold: 5,
          unit: "PCS",
          category: defaultCategoryId || "",
        },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ItemFormData) =>
      isEdit
        ? inventoryApi.update(item.id, data)
        : inventoryApi.create({ ...data, branch: branchId }),
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Item Name"
          {...register("name")}
          error={errors.name?.message}
          required
        />
        <Input label="SKU" {...register("sku")} error={errors.sku?.message} />
        <Select
          label="Category"
          options={categoryOptions}
          {...register("category")}
        />
        <Input
          label="Unit"
          {...register("unit")}
          placeholder="e.g., PCS, NOS"
        />
        <div className="md:col-span-2">
          <Textarea label="Description" {...register("description")} rows={2} />
        </div>
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
          error={errors.gst_rate?.message}
        />
        <Input label="HSN Code" {...register("hsn_code")} />
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
        <div className="p-4 bg-neutral-50 rounded-lg">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-neutral-500">
            Current Stock:{" "}
            <span className="font-semibold">
              {item.quantity} {item.unit}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { value: "add", label: "Add Stock", icon: ArrowUpCircle },
            { value: "deduct", label: "Deduct", icon: ArrowDownCircle },
            { value: "set", label: "Set Quantity", icon: Edit2 },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setAdjustType(opt.value as "add" | "deduct" | "set")
              }
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
          placeholder="Enter quantity"
          required
        />

        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Purchase order #PO-001, Manual count correction..."
          required
          rows={2}
        />

        {error && <Alert variant="error">{error.message}</Alert>}
      </div>
    </Modal>
  );
}

// =====================================================
// Main Inventory Page
// =====================================================

export default function InventoryPage() {
  const { currentBranch } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low_stock" | "out_of_stock">(
    "all",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);

  // Fetch inventory items — pass category filter to the API
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

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["inventory-stats", currentBranch?.id],
    queryFn: () => inventoryApi.getStats(),
    enabled: !!currentBranch,
  });

  // Fetch category stats
  const { data: categoryStats } = useQuery({
    queryKey: ["category-stats", currentBranch?.id],
    queryFn: () => inventoryApi.getCategoryStats(currentBranch!.id),
    enabled: !!currentBranch,
  });

  // Fetch categories for the Add Item modal dropdown
  const { data: categories } = useQuery({
    queryKey: ["categories", currentBranch?.id],
    queryFn: () => inventoryApi.listCategories(currentBranch!.id),
    enabled: !!currentBranch,
  });

  let items = data?.results || [];

  // Additional client-side filtering
  if (filter === "out_of_stock") {
    items = items.filter((item) => item.quantity === 0);
  }

  // Get the name of the active category
  const activeCategoryName = selectedCategory
    ? categoryStats?.find((c) => c.id === selectedCategory)?.name || "Category"
    : "All Items";

  return (
    <ProtectedRoute requiredPermission="canViewInventory">
      <AppLayout>
        <Header
          title="Inventory"
          subtitle={`${stats?.total_items || 0} items in stock`}
          actions={
            <Button
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Add Item
            </Button>
          }
        />

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card padding="md" className="stats-card stats-card-primary">
              <p className="text-sm text-neutral-500">Total Items</p>
              <p className="text-2xl font-bold text-neutral-900">
                {stats?.total_items || 0}
              </p>
            </Card>
            <Card padding="md" className="stats-card stats-card-success">
              <p className="text-sm text-neutral-500">Total Value</p>
              <p className="text-2xl font-bold text-neutral-900">
                ₹{(stats?.total_value || 0).toLocaleString("en-IN")}
              </p>
            </Card>
            <Card padding="md" className="stats-card stats-card-warning">
              <p className="text-sm text-neutral-500">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats?.low_stock_count || 0}
              </p>
            </Card>
            <Card padding="md" className="stats-card stats-card-danger">
              <p className="text-sm text-neutral-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">
                {stats?.out_of_stock_count || 0}
              </p>
            </Card>
          </div>

          {/* ── Part Categories Grid ──────────────────────────── */}
          {categoryStats && categoryStats.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-neutral-800 mb-3">
                Parts Catalog
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                {/* All Items Card */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group ${
                    selectedCategory === null
                      ? "border-primary-500 bg-primary-50 shadow-lg shadow-primary-100 scale-[1.02]"
                      : "border-neutral-100 bg-white hover:border-neutral-300 hover:shadow-md"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                    <LayoutGrid className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-800">
                    All
                  </span>
                  <span className="text-xs text-neutral-400">
                    {stats?.total_items || 0} items
                  </span>
                  {selectedCategory === null && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full ring-2 ring-white" />
                  )}
                </button>

                {/* Category Cards */}
                {categoryStats.map((cat) => (
                  <CategoryCard
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
            </div>
          )}

          {/* Search & Filters */}
          <Card padding="md">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or SKU..."
                  leftIcon={<Search className="w-5 h-5" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {[
                  { value: "all", label: "All Items" },
                  { value: "low_stock", label: "Low Stock" },
                  { value: "out_of_stock", label: "Out of Stock" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value as typeof filter)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      filter === opt.value
                        ? "bg-primary-500 text-white"
                        : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Section Header */}
          {selectedCategory && (
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-neutral-700">
                Showing: {activeCategoryName}
              </h3>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-primary-500 hover:text-primary-600 font-medium"
              >
                ← Show All
              </button>
            </div>
          )}

          {/* Inventory List */}
          {isLoading ? (
            <LoadingState />
          ) : items.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Package className="w-8 h-8 text-neutral-400" />}
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
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => (
                <InventoryItemCard
                  key={item.id}
                  item={item}
                  onEdit={setEditItem}
                  onAdjust={setAdjustItem}
                />
              ))}
            </div>
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
