"use client";
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { gstApi } from "@/lib/api/services";
import { Hash, Plus, Search, X, Pencil } from "lucide-react";

const DEFAULT_FORM = { code: "", code_type: "SAC", description: "", default_gst_rate: "18" };
type HSNFormState = typeof DEFAULT_FORM;

interface HSNCodeRecord {
  id: string;
  code: string;
  code_type: string;
  description: string;
  default_gst_rate: number | string;
}

interface GSTFormModalProps {
  title: string;
  onSave: () => void;
  onClose: () => void;
  loading: boolean;
  form: HSNFormState;
  setForm: React.Dispatch<React.SetStateAction<HSNFormState>>;
}

function GSTFormModal({ title, onSave, onClose, loading, form, setForm }: GSTFormModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-neutral-400" /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Code *</label>
              <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                placeholder="e.g. 998711"
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">Type</label>
              <select value={form.code_type} onChange={e => setForm(p => ({ ...p, code_type: e.target.value }))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                <option value="SAC">SAC (Service)</option>
                <option value="HSN">HSN (Goods)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Description *</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Repair of computers and peripherals"
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">Default GST Rate (%)</label>
            <input type="number" value={form.default_gst_rate} onChange={e => setForm(p => ({ ...p, default_gst_rate: e.target.value }))}
              className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600">Cancel</button>
          <button type="button" onClick={onSave} disabled={loading}
            className="flex-1 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HSNPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HSNCodeRecord | null>(null);
  const [form, setForm] = useState<HSNFormState>(DEFAULT_FORM);

  const { data = [], isLoading } = useQuery<HSNCodeRecord[]>({
    queryKey: ["hsn-codes", search],
    queryFn: async () => {
      const res = await gstApi.getHSNCodes(search ? { q: search } : undefined);
      return Array.isArray(res) ? (res as HSNCodeRecord[]) : [];
    },
  });

  const addMutation = useMutation({
    mutationFn: () => gstApi.addHSNCode(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hsn-codes"] }); setShowForm(false); setForm(DEFAULT_FORM); },
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error("No code selected");
      return gstApi.updateHSNCode(editing.id, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hsn-codes"] }); setEditing(null); setForm(DEFAULT_FORM); },
  });

  const codes = Array.isArray(data) ? data : [];

  const openEdit = (hsn: HSNCodeRecord) => {
    setEditing(hsn);
    setForm({ code: hsn.code, code_type: hsn.code_type, description: hsn.description, default_gst_rate: String(hsn.default_gst_rate) });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Hash className="w-6 h-6 text-neutral-700" /> HSN / SAC Code Master
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Manage HSN (goods) and SAC (service) codes used in invoices</p>
        </div>
        <button type="button" onClick={() => { setForm(DEFAULT_FORM); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors">
          <Plus className="w-4 h-4" /> Add Code
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by code or description..."
          className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm" />
      </div>

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {["Code", "Type", "Description", "GST Rate", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">Loading...</td></tr>
            ) : !codes.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                {search ? "No codes found." : "No HSN/SAC codes yet. Add your first one!"}
              </td></tr>
            ) : (
              codes.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono font-bold text-neutral-900">{c.code}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.code_type === "SAC" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                    }`}>{c.code_type}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{c.description}</td>
                  <td className="px-4 py-3 font-semibold">{c.default_gst_rate}%</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => openEdit(c)} className="text-neutral-400 hover:text-neutral-700">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Common service center codes helper */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm">
        <p className="font-semibold text-neutral-700 mb-2">Common codes for computer service centers:</p>
        <div className="grid grid-cols-2 gap-1 text-neutral-600 text-xs font-mono">
          <span>998711 — SAC — Repair of computers (18%)</span>
          <span>998713 — SAC — Maintenance of computers (18%)</span>
          <span>84733099 — HSN — Computer parts, other (18%)</span>
          <span>85171890 — HSN — Laptop parts (18%)</span>
        </div>
      </div>

      {showForm && (
        <GSTFormModal title="Add HSN/SAC Code" onSave={() => addMutation.mutate()}
          onClose={() => setShowForm(false)} loading={addMutation.isPending}
          form={form} setForm={setForm} />
      )}
      {editing && (
        <GSTFormModal title="Edit HSN/SAC Code" onSave={() => updateMutation.mutate()}
          onClose={() => setEditing(null)} loading={updateMutation.isPending}
          form={form} setForm={setForm} />
      )}
    </div>
  );
}
