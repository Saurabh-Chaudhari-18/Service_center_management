"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { suppliersApi } from "@/lib/api/services";
import {
  Plus, Search, RefreshCw, X, Phone, Mail, MapPin,
  Star, Building2, Trash2
} from "lucide-react";
import type { Supplier } from "@/types";

export default function SuppliersPage() {
  const { currentBranch } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
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
  });

  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (search) params.search = search;
      const res = await suppliersApi.list(params);
      setSuppliers(res.results || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, search]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await suppliersApi.create({
        ...form,
        branch: currentBranch?.id,
      });
      setShowForm(false);
      setForm({
        name: "", contact_person: "", phone: "", email: "",
        city: "", state: "", gstin: "", categories: "",
        payment_terms: "IMMEDIATE", notes: "",
      });
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to create supplier:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this supplier?")) return;
    try {
      await suppliersApi.delete(id);
      fetchSuppliers();
    } catch (err) {
      console.error("Failed to delete supplier:", err);
    }
  };

  return (
    <AppLayout>
      <Header
        title="Suppliers"
        subtitle="Manage vendors & spare parts suppliers"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-lg transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        }
      />

      <div className="p-4 lg:p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <button onClick={fetchSuppliers} className="p-2 rounded-xl border border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Supplier Cards */}
        {loading ? (
          <div className="card p-8 text-center text-neutral-400">Loading suppliers...</div>
        ) : suppliers.length === 0 ? (
          <div className="card p-8 text-center text-neutral-400">No suppliers found. Add your first vendor!</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((sup) => (
              <div key={sup.id} className="card p-5 hover:shadow-lg transition-shadow relative group">
                <button
                  onClick={() => handleDelete(sup.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-sm shrink-0">
                    {sup.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 dark:text-white truncate">{sup.name}</h3>
                    {sup.contact_person && (
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{sup.contact_person}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {sup.phone && (
                    <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                      <Phone className="w-3.5 h-3.5" /> {sup.phone}
                    </div>
                  )}
                  {sup.city && (
                    <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                      <MapPin className="w-3.5 h-3.5" /> {sup.city}
                    </div>
                  )}
                </div>

                {sup.categories && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {sup.categories.split(",").map((cat, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-neutral-300">
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3.5 h-3.5 ${s <= (sup.rating || 0) ? "text-amber-400 fill-amber-400" : "text-neutral-300 dark:text-slate-600"}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Supplier Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Add Supplier</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Company / Supplier Name *</label>
                <input required type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="Supplier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Contact Person</label>
                  <input type="text" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Phone</label>
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">City</label>
                  <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">GSTIN</label>
                  <input type="text" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Categories (comma-separated)</label>
                <input type="text" value={form.categories} onChange={(e) => setForm({ ...form, categories: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  placeholder="Screens, Batteries, Chargers"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">Payment Terms</label>
                <select value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  <option value="IMMEDIATE">Immediate</option>
                  <option value="NET_7">Net 7 Days</option>
                  <option value="NET_15">Net 15 Days</option>
                  <option value="NET_30">Net 30 Days</option>
                  <option value="NET_60">Net 60 Days</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-slate-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  {saving ? "Saving..." : "Save Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
