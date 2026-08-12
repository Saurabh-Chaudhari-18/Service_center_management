"use client";

// Focused interactive island below the server route boundary.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { CreditCard, Plus } from "lucide-react";
import { Modal, Button, Card, Input, Select, StatsCard, Textarea } from "@/components/ui";

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

  const { data = [], isLoading } = useQuery<any>({
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
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-violet-600" /> GST Payments
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Track challan payments made to the government</p>
        </div>
        <Button onClick={() => setShowForm(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Payment
        </Button>
      </div>

      {/* Total paid */}
      <StatsCard label="Total GST Paid (All Time)" value={fmt(totalPaid)} variant="accent" />

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add GST Payment"
        size="md"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => addMutation.mutate()} isLoading={addMutation.isPending}>
              Save Payment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {[
            { label: "Period (Month)", key: "period_month", type: "month" },
            { label: "CGST Paid (₹)", key: "cgst_paid", type: "number" },
            { label: "SGST Paid (₹)", key: "sgst_paid", type: "number" },
            { label: "Payment Date", key: "payment_date", type: "date" },
            { label: "Challan Number (CRN)", key: "challan_number", type: "text" },
          ].map((f) => (
            <Input
              key={f.key}
              label={f.label}
                type={f.type}
                value={(form as Record<string, string>)[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              />
          ))}
            <Select
              label="Payment Method"
              value={form.payment_method}
              onChange={(e) => setForm((p) => ({ ...p, payment_method: e.target.value }))}
              options={PAYMENT_METHODS.map((method) => ({ value: method, label: method }))}
            />
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
        </div>
      </Modal>

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
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
      </Card>
    </div>
  );
}
