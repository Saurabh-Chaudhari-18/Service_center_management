"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { CreditCard, Plus, X } from "lucide-react";

const PAYMENT_METHODS = ["NEFT", "UPI", "CASH", "DEBIT_CARD", "OTHER"];

export default function GSTPaymentsPage() {
  const { currentBranch } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    period_month: new Date().toISOString().slice(0, 7) + "-01",
    cgst_paid: "", sgst_paid: "",
    payment_date: new Date().toISOString().slice(0, 10),
    challan_number: "", payment_method: "NEFT", notes: "",
    branch: currentBranch?.id,
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["gst-payments", currentBranch?.id],
    queryFn: () => gstApi.getPayments({ branch: currentBranch?.id }),
  });

  const addMutation = useMutation({
    mutationFn: () => gstApi.addPayment({ ...form, branch: currentBranch?.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gst-payments"] });
      setShowForm(false);
    },
  });

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const payments = Array.isArray(data) ? data : [];
  const totalPaid = payments.reduce((s: number, p: any) => s + (Number(p.cgst_paid) + Number(p.sgst_paid)), 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-violet-600" /> GST Payments
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Track challan payments made to the government</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Total paid */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-5">
        <p className="text-xs text-violet-600 font-semibold uppercase tracking-wider">Total GST Paid (All Time)</p>
        <p className="text-3xl font-bold text-violet-700 mt-1">{fmt(totalPaid)}</p>
      </div>

      {/* Add Payment Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-900">Add GST Payment</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: "Period (Month)", key: "period_month", type: "month" },
                { label: "CGST Paid (₹)", key: "cgst_paid", type: "number" },
                { label: "SGST Paid (₹)", key: "sgst_paid", type: "number" },
                { label: "Payment Date", key: "payment_date", type: "date" },
                { label: "Challan Number (CRN)", key: "challan_number", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Payment Method</label>
                <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                Cancel
              </button>
              <button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}
                className="flex-1 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {addMutation.isPending ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              {["Period", "CGST", "SGST", "Total", "Date", "Challan #", "Method"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Loading...</td></tr>
            ) : !payments.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-400">No payments recorded yet.</td></tr>
            ) : (
              payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">{p.period_display}</td>
                  <td className="px-4 py-3 text-right">{fmt(Number(p.cgst_paid))}</td>
                  <td className="px-4 py-3 text-right">{fmt(Number(p.sgst_paid))}</td>
                  <td className="px-4 py-3 text-right font-bold text-violet-700">{fmt(Number(p.cgst_paid) + Number(p.sgst_paid))}</td>
                  <td className="px-4 py-3 text-neutral-600">{p.payment_date}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.challan_number || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded text-xs">{p.payment_method}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
