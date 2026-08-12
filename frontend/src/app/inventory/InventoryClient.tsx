"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Button, Input, LoadingState, EmptyState, StatsCard } from "@/components/ui";
import { PageShell, SegmentedControl } from "@/components/shell";
import { inventoryApi } from "@/lib/api";
import { Plus, Search, Package, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import type { InventoryItem } from "@/types";
import {
  AdjustStockModal,
  CATEGORY_COLORS,
  CategoryChip,
  DetailPanel,
  INVENTORY_VIEW_SEGMENTS,
  ItemModal,
  SortHeader,
  StockBadge,
  type SortDir,
  type SortKey,
} from "./InventoryComponents";

export default function InventoryPage() {
  const { currentBranch } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low_stock" | "out_of_stock">(
    "all",
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    if (typeof window === "undefined") return "table";
    return (localStorage.getItem("inventory-view") as "table" | "card") ?? "table";
  });

  const handleViewChange = (v: "table" | "card") => {
    setViewMode(v);
    if (typeof window !== "undefined") {
      localStorage.setItem("inventory-view", v);
    }
  };
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
              Add Item
            </Button>
          }
        />

        <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden">
          {/* Main Content */}
          <div
            className={`flex-1 min-w-0 flex flex-col overflow-hidden ${selectedItem ? "hidden lg:flex lg:border-r" : ""}`}
          >
            <PageShell width="fluid" className="flex-1 overflow-y-auto">
              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatsCard label="Total Items" value={stats?.total_items || 0} />
                <StatsCard
                  label="Total Value"
                  value={`₹${(stats?.total_value || 0).toLocaleString("en-IN")}`}
                  variant="accent"
                />
                <StatsCard
                  label="Low Stock"
                  value={stats?.low_stock_count || 0}
                  variant="warning"
                />
                <StatsCard
                  label="Out of Stock"
                  value={stats?.out_of_stock_count || 0}
                  variant="danger"
                />
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
                  <SegmentedControl
                    aria-label="Inventory layout"
                    className="ml-1 w-full shrink-0 sm:w-auto"
                    value={viewMode}
                    onValueChange={handleViewChange}
                    options={INVENTORY_VIEW_SEGMENTS}
                  />
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
                <LoadingState message="Loading inventory…" />
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
                                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category_name]?.bg || "bg-neutral-50"} ${CATEGORY_COLORS[item.category_name]?.text || "text-neutral-600"}`}
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
                            className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[item.category_name]?.bg || "bg-neutral-50"} ${CATEGORY_COLORS[item.category_name]?.text || "text-neutral-600"}`}
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
            </PageShell>
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
