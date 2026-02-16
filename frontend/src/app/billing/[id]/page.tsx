"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  LoadingState,
  InvoiceStatusBadge,
  Modal,
  Input,
  Select,
} from "@/components/ui";
import { billingApi } from "@/lib/api";
import {
  Printer,
  Download,
  CreditCard,
  ArrowLeft,
  Lock,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import type { Invoice } from "@/types";

// =====================================================
// Print Portal Util
// =====================================================

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root">{children}</div>,
    document.body,
  );
};

// =====================================================
// Brand Logo Component (Reused)
// =====================================================
function BrandLogo({ brand }: { brand: "HP" | "DELL" | "ASUS" | "LENOVO" }) {
  switch (brand) {
    case "HP":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle cx="50" cy="50" r="45" fill="#0096D6" />
          <text
            x="50"
            y="65"
            fontSize="40"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            style={{ fontStyle: "italic", fontFamily: "serif" }}
          >
            hp
          </text>
        </svg>
      );
    case "DELL":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="#007DB8"
            strokeWidth="4"
          />
          <text
            x="50"
            y="60"
            fontSize="24"
            fontWeight="bold"
            fill="#007DB8"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            DELL
          </text>
        </svg>
      );
    case "ASUS":
      return (
        <svg viewBox="0 0 100 30" className="w-12 h-6">
          <text
            x="50"
            y="22"
            fontSize="24"
            fontWeight="bold"
            fill="#00539B"
            textAnchor="middle"
            style={{ letterSpacing: "2px" }}
          >
            ASUS
          </text>
          <line
            x1="10"
            y1="12"
            x2="90"
            y2="12"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      );
    case "LENOVO":
      return (
        <svg viewBox="0 0 100 40" className="w-16 h-8">
          <rect width="100" height="40" fill="#E2231A" />
          <text
            x="50"
            y="28"
            fontSize="20"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            Lenovo
          </text>
        </svg>
      );
  }
}

// =====================================================
// Record Payment Modal
// =====================================================

function RecordPaymentModal({
  invoiceId,
  balanceDue,
  isOpen,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  balanceDue: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(balanceDue.toString());
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      await billingApi.recordPayment(
        invoiceId,
        parseFloat(amount),
        paymentMethod,
        reference,
        notes,
      );
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (error) => {
      console.error("Failed to record payment", error);
      alert("Failed to record payment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isPending}>
            Save Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          options={[
            { value: "CASH", label: "Cash" },
            { value: "UPI", label: "UPI" },
            { value: "CARD", label: "Card" },
            { value: "NEFT", label: "NEFT" },
            { value: "CHEQUE", label: "Cheque" },
            { value: "WALLET", label: "Wallet" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <Input
          label="Reference / Transaction ID"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="e.g. UPI Ref, Cheque No"
        />
        <Input
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}

// =====================================================
// Invoice View Component (Shared Layout)
// =====================================================

function InvoiceView({ invoice }: { invoice: Invoice }) {
  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto print:p-0">
      {/* Header */}
      <div className="border-2 border-black p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-4 items-center">
            <BrandLogo brand="HP" />
            <BrandLogo brand="DELL" />
            <BrandLogo brand="ASUS" />
            <BrandLogo brand="LENOVO" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold uppercase tracking-wider">
              SHIVANGI INFOTECH
            </h1>
            <p className="text-sm font-semibold">
              HP | DELL | ASUS Authorised Partner
            </p>
          </div>
        </div>
        <div className="text-center border-t border-black pt-2 text-xs">
          <p>
            Shop No. 3, Ground Floor, Sai Complex, Pune-Nashik Highway, Pune
            411039
          </p>
          <p>Phone: +91 99999 88888 | Email: support@shivangiinfo.com</p>
          <p className="mt-1 font-bold">GSTIN: 27ABCDE1234F1Z5</p>
        </div>
      </div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-neutral-500 text-sm uppercase tracking-wider mb-1">
            Bill To
          </h3>
          <p className="font-bold text-lg">{invoice.customer_name}</p>
          <p className="text-neutral-600">{invoice.customer_mobile}</p>
          <p className="text-neutral-600 max-w-xs">
            {invoice.customer_address}
          </p>
          {invoice.customer_gstin && (
            <p className="text-sm font-mono mt-2">
              GSTIN: {invoice.customer_gstin}
            </p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-light text-primary-600 mb-2">INVOICE</h2>
          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="font-medium mr-2">Invoice #:</span>
              {invoice.invoice_number}
            </p>
            <p>
              <span className="font-medium mr-2">Date:</span>
              {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
            </p>
            {invoice.job_number && (
              <p>
                <span className="font-medium mr-2">Job Ref:</span>
                {invoice.job_number}
              </p>
            )}
            <p>
              <span className="font-medium mr-2">Status:</span>
              {invoice.status}
            </p>
          </div>
        </div>
      </div>
      {/* Line Items Table */}
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-neutral-100 border-b border-neutral-200 text-xs uppercase tracking-wider text-neutral-600 font-semibold text-left">
            <th className="px-4 py-3 border-b">#</th>
            <th className="px-4 py-3 border-b">Item & Description</th>
            <th className="px-4 py-3 border-b">HSN/SAC</th>
            <th className="px-4 py-3 text-right border-b">Qty</th>
            <th className="px-4 py-3 text-right border-b">Rate</th>
            <th className="px-4 py-3 text-right border-b">Tax %</th>
            <th className="px-4 py-3 text-right border-b">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {(invoice.line_items || []).map((item, idx) => (
            <tr key={idx} className="text-sm">
              <td className="px-4 py-3 text-neutral-400">{idx + 1}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">
                  {item.description}
                </p>
                <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded print:hidden">
                  {item.item_type}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-500">
                {item.hsn_sac_code || "-"}
              </td>
              <td className="px-4 py-3 text-right">{item.quantity}</td>
              <td className="px-4 py-3 text-right">
                ₹{Number(item.unit_price).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-neutral-500">
                {Number(item.gst_rate).toFixed(0)}%
              </td>
              <td className="px-4 py-3 text-right font-medium">
                ₹{Number(item.amount).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Totals Section */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between text-neutral-600">
            <span>Subtotal</span>
            <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Tax (GST)</span>
            <span>₹{Number(invoice.total_tax).toFixed(2)}</span>
          </div>
          {Number(invoice.discount_amount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span>-₹{Number(invoice.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg border-t border-black pt-2 mt-2">
            <span>Example Grand Total</span>
            <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-neutral-600 text-xs mt-1 pt-1 border-t border-neutral-200">
            <span>Paid Amount</span>
            <span>₹{Number(invoice.paid_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium text-red-600 text-sm">
            <span>Balance Due</span>
            <span>₹{Number(invoice.balance_due).toFixed(2)}</span>
          </div>
        </div>
      </div>
      {/* Terms & Footer */}
      <div className="border-t-2 border-neutral-100 pt-8 text-xs text-neutral-500">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="font-bold text-neutral-900 mb-2 uppercase">
              Terms & Conditions
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Warranty void if seal is broken or tampered with.</li>
              <li>Goods once sold will not be taken back.</li>
              <li>Subject to Pune jurisdiction only.</li>
              <li>
                Interest @ 24% p.a. will be charged if bill is not paid on due
                date.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-neutral-900 mb-2 uppercase">
              Bank Details
            </p>
            <p>Bank: HDFC Bank</p>
            <p>A/c Name: Shivangi Infotech</p>
            <p>A/c No: 50200012345678</p>
            <p>IFSC: HDFC0000123</p>
            <div className="mt-8 text-right">
              <p className="font-bold">For SHIVANGI INFOTECH</p>
              <div className="h-12"></div>
              <p>Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-neutral-400 mt-8 print:block hidden">
        <p>This is a computer generated invoice.</p>
      </div>
    </div>
  );
}

// =====================================================
// Main Page Component
// =====================================================

export default function InvoiceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const queryClient = useQueryClient();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => billingApi.getInvoice(id),
    enabled: !!id,
  });

  const { mutate: finalizeInvoice, isPending: isFinalizing } = useMutation({
    mutationFn: async () => {
      await billingApi.finalizeInvoice(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (error) => {
      console.error("Failed to finalize invoice", error);
      alert("Failed to finalize invoice");
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // We use window.print() because it renders the exact UI which is much better than the backend generated PDF.
    // Users can choose "Save as PDF" in the print dialog.
    alert(
      "To download the PDF with the best layout, please select 'Save as PDF' as the destination in the print dialog.",
    );
    window.print();
  };

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    );
  }

  if (error || !invoice) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-neutral-900">
                Invoice not found
              </h3>
              <p className="text-neutral-500 mt-2">
                The requested invoice details could not be loaded.
              </p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => router.push("/billing")}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back to Billing
              </Button>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canViewBilling">
      <AppLayout>
        <Header
          title={`Invoice ${invoice.invoice_number}`}
          subtitle={format(new Date(invoice.invoice_date), "MMMM dd, yyyy")}
          showBack
          backUrl="/billing"
          actions={
            <div className="flex gap-2 items-center">
              <InvoiceStatusBadge status={invoice.status} />
              {!invoice.is_finalized && (
                <>
                  <Button
                    variant="secondary"
                    leftIcon={<Edit className="w-4 h-4" />}
                    onClick={() => router.push(`/billing/${id}/edit`)}
                  >
                    Edit Invoice
                  </Button>
                  <Button
                    leftIcon={<Lock className="w-4 h-4" />}
                    onClick={() => {
                      if (
                        confirm(
                          "Are you sure you want to finalize this invoice? Once finalized, it cannot be edited.",
                        )
                      ) {
                        finalizeInvoice();
                      }
                    }}
                    isLoading={isFinalizing}
                  >
                    Finalize Invoice
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={handlePrint}
              >
                Print
              </Button>
              <Button
                variant="secondary"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={handleDownload}
              >
                Download PDF
              </Button>
              {invoice.is_finalized && Number(invoice.balance_due) > 0 && (
                <Button
                  leftIcon={<CreditCard className="w-4 h-4" />}
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  Record Payment
                </Button>
              )}
            </div>
          }
        />

        <div className="p-6 max-w-5xl mx-auto">
          <Card padding="none" className="overflow-hidden">
            <InvoiceView invoice={invoice} />
          </Card>
        </div>

        {/* Print Portal */}
        <PrintPortal>
          <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] print:h-screen print:w-screen">
            <InvoiceView invoice={invoice} />
          </div>
        </PrintPortal>

        {/* Payment Modal */}
        <RecordPaymentModal
          invoiceId={invoice.id}
          balanceDue={invoice.balance_due}
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["invoice", id] });
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
          }}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
