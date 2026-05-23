"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { suppliersApi } from "@/lib/api/services";
import {
  Plus,
  Phone,
  MapPin,
  Star,
  Trash2,
  ChevronRight,
} from "lucide-react";
import type { Supplier } from "@/types";
import {
  Modal,
  Button,
  Input,
  Select,
  LoadingState,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import {
  PageShell,
  RegisterToolbar,
  WorkspaceSurface,
} from "@/components/shell";

const PAYMENT_TERMS_OPTIONS = [
  { value: "IMMEDIATE", label: "Immediate" },
  { value: "NET_7",     label: "Net 7 Days" },
  { value: "NET_15",    label: "Net 15 Days" },
  { value: "NET_30",    label: "Net 30 Days" },
  { value: "NET_60",    label: "Net 60 Days" },
];

const EMPTY_FORM = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  gstin: "",
  categories: "",
  payment_terms: "IMMEDIATE",
  notes: "",
};

export default function SuppliersPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const errorRef = React.useRef(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["suppliers", currentBranch?.id, search],
    queryFn: () =>
      suppliersApi.list({
        branch: currentBranch?.id,
        search: search || undefined,
      }),
    enabled: !!currentBranch,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (isError && !errorRef.current) {
      errorRef.current = true;
      toast.error("Failed to load suppliers.");
    }
    if (!isError) errorRef.current = false;
  }, [isError, toast]);

  const createMutation = useMutation({
    mutationFn: () =>
      suppliersApi.create({ ...form, branch: currentBranch?.id }),
    onSuccess: () => {
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success("Supplier added.");
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: () => toast.error("Failed to add supplier."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      setPendingDeleteId(null);
      toast.success("Supplier deleted.");
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: () => toast.error("Failed to delete supplier."),
  });

  const suppliers: Supplier[] = data?.results || [];

  const f = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <AppLayout>
      <Header
        title="Suppliers"
        subtitle="Manage vendors & spare parts suppliers"
        actions={
          <Button
            onClick={() => setShowForm(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Supplier
          </Button>
        }
      />

      <PageShell width="fluid">
        <RegisterToolbar
          search={
            <Input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              aria-label="Search suppliers"
              className="py-3 text-sm"
            />
          }
        />

        <WorkspaceSurface>
          {isLoading ? (
            <div className="p-8">
              <LoadingState />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No suppliers found"
                description={
                  search
                    ? "Try a different search term"
                    : "Add your first vendor to get started"
                }
                action={
                  !search && (
                    <Button
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => setShowForm(true)}
                    >
                      Add Supplier
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
            {/* Desktop table — lg and above */}
            <div className="hidden lg:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">City</th>
                    <th className="px-4 py-3">Categories</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="w-10 px-2 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="text-neutral-800 dark:text-slate-200">
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="border-b border-neutral-100 last:border-b-0 dark:border-slate-800/80">
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
                            {sup.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900 dark:text-white">{sup.name}</p>
                            {sup.contact_person && <p className="text-xs text-neutral-500 dark:text-neutral-400">{sup.contact_person}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">{sup.phone || "—"}</td>
                      <td className="px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">{sup.city || "—"}</td>
                      <td className="px-4 py-3 align-middle">
                        {sup.categories ? (
                          <div className="flex flex-wrap gap-1">
                            {sup.categories.split(",").slice(0, 3).map((cat, i) => (
                              <span key={i} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-slate-700 dark:text-neutral-300">
                                {cat.trim()}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`h-3 w-3 ${s <= (sup.rating || 0) ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-slate-600"}`} />
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-3 align-middle">
                        <button type="button" onClick={() => setPendingDeleteId(sup.id)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors" aria-label="Delete supplier">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile / tablet cards — below lg */}
            <div className="lg:hidden grid grid-cols-1 gap-4 p-4 md:grid-cols-2 md:p-6">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="group relative rounded-xl border border-neutral-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(sup.id)}
                    className="absolute right-3 top-3 rounded-lg p-1.5 text-neutral-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                    aria-label="Delete supplier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="mb-3 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                      {sup.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-neutral-900 dark:text-white">
                        {sup.name}
                      </h3>
                      {sup.contact_person && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">
                          {sup.contact_person}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    {sup.phone && (
                      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                        <Phone className="h-3.5 w-3.5" />
                        {sup.phone}
                      </div>
                    )}
                    {sup.city && (
                      <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                        <MapPin className="h-3.5 w-3.5" />
                        {sup.city}
                      </div>
                    )}
                  </div>

                  {sup.categories && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {sup.categories.split(",").map((cat, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:bg-slate-700 dark:text-neutral-300"
                        >
                          {cat.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${
                          s <= (sup.rating || 0)
                            ? "fill-amber-400 text-amber-400"
                            : "text-neutral-300 dark:text-slate-600"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </WorkspaceSurface>
      </PageShell>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Supplier"
        size="lg"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="supplier-create-form"
              isLoading={createMutation.isPending}
            >
              Save Supplier
            </Button>
          </>
        }
      >
        <form
          id="supplier-create-form"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <Input
            required
            label="Company / Supplier Name"
            value={form.name}
            onChange={(e) => f("name", e.target.value)}
            placeholder="Supplier name"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Contact Person"
              value={form.contact_person}
              onChange={(e) => f("contact_person", e.target.value)}
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => f("phone", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={form.city}
              onChange={(e) => f("city", e.target.value)}
            />
            <Input
              label="GSTIN"
              value={form.gstin}
              onChange={(e) => f("gstin", e.target.value)}
            />
          </div>
          <Input
            label="Categories (comma-separated)"
            value={form.categories}
            onChange={(e) => f("categories", e.target.value)}
            placeholder="Screens, Batteries, Chargers"
          />
          <Select
            label="Payment Terms"
            value={form.payment_terms}
            options={PAYMENT_TERMS_OPTIONS}
            onChange={(e) => f("payment_terms", e.target.value)}
          />
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!pendingDeleteId}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
        }}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </AppLayout>
  );
}
