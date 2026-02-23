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
import converter from "number-to-words";

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
    <>
      <style type="text/css">
        {`
          @media print {
            @page {
              size: A4;
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}
      </style>
      <div className="bg-white text-black p-8 max-w-4xl mx-auto print:p-8 print:text-base print:box-border print:block">
        {/* ============================================= */}
        {/* COMPANY HEADER */}
        {/* ============================================= */}
        <div className="border-2 border-black p-4 mb-4 print:p-2 print:mb-2">
          <div className="flex items-center justify-between mb-3">
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
          <div className="text-center border-t border-black pt-2 text-xs print:text-xs print:pt-1">
            <p>
              Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa Showroom,
              Pune-411038
            </p>
            <p>Mobile: 9890888295, 9850292673</p>
            <p className="mt-1 font-bold print:mt-0">GSTIN: 27ABCDE1234F1Z5</p>
          </div>
        </div>

        {/* ============================================= */}
        {/* CUSTOMER DETAILS + INVOICE DETAILS */}
        {/* ============================================= */}
        <div className="grid grid-cols-2 gap-4 mb-4 print:gap-2 print:mb-2">
          {/* Customer Details */}
          <div className="border-2 border-black">
            <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
              <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                Customer Details
              </h3>
            </div>
            <div className="p-3 text-sm space-y-1 print:p-2 print:text-sm print:space-y-0.5">
              <p>
                <span className="font-semibold">Name:</span>{" "}
                {invoice.customer_name}
              </p>
              <p>
                <span className="font-semibold">Mobile:</span>{" "}
                {invoice.customer_mobile}
              </p>
              {invoice.customer_email && (
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  {invoice.customer_email}
                </p>
              )}
              {invoice.customer_address && (
                <p>
                  <span className="font-semibold">Address:</span>{" "}
                  {invoice.customer_address}
                </p>
              )}
              {invoice.customer_gstin && (
                <p>
                  <span className="font-semibold">GSTIN:</span>{" "}
                  <span className="font-mono">{invoice.customer_gstin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="border-2 border-black">
            <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
              <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                Invoice Details
              </h3>
            </div>
            <div className="p-3 text-sm space-y-1 print:p-2 print:text-sm print:space-y-0.5">
              <p>
                <span className="font-semibold">Invoice #:</span>{" "}
                {invoice.invoice_number}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{" "}
                {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
              </p>
              {invoice.job_number && (
                <p>
                  <span className="font-semibold">Job Ref:</span>{" "}
                  {invoice.job_number}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ============================================= */}
        {/* LINE ITEMS (Fixed Height for Print) */}
        {/* ============================================= */}
        <div className="border-2 border-black mb-4 print:mb-2 print:h-[400px] print:flex print:flex-col">
          <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1 print:shrink-0">
            <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
              Item Details
            </h3>
          </div>
          <div className="print:flex-1">
            <table className="w-full border-collapse text-sm print:text-sm print:h-full">
              <thead>
                <tr className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-700 font-semibold text-left border-b border-black print:text-xs">
                  <th className="px-3 py-2 border-r border-neutral-300 w-8 print:px-1 print:py-1">
                    #
                  </th>
                  <th className="px-3 py-2 border-r border-neutral-300 print:px-1 print:py-1">
                    Item & Description
                  </th>
                  <th className="px-3 py-2 border-r border-neutral-300 w-20 print:px-1 print:py-1">
                    HSN/SAC
                  </th>
                  <th className="px-3 py-2 text-right border-r border-neutral-300 w-12 print:px-1 print:py-1">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right border-r border-neutral-300 w-24 print:px-1 print:py-1">
                    Rate
                  </th>
                  <th className="px-3 py-2 text-right border-r border-neutral-300 w-16 print:px-1 print:py-1">
                    Tax %
                  </th>
                  <th className="px-3 py-2 text-right w-24 print:px-1 print:py-1">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {(invoice.line_items || []).map((item, idx) => (
                  <tr key={idx} className="border-b border-neutral-200">
                    <td className="px-3 py-2 text-neutral-400 border-r border-neutral-200 print:px-1 print:py-1">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 border-r border-neutral-200 print:px-1 print:py-1">
                      <p className="font-medium text-neutral-900">
                        {item.description}
                      </p>
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded print:hidden">
                        {item.item_type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-500 border-r border-neutral-200 print:px-1 print:py-1">
                      {item.hsn_sac_code || "-"}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-neutral-200 print:px-1 print:py-1">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right border-r border-neutral-200 print:px-1 print:py-1">
                      ₹{Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-neutral-500 border-r border-neutral-200 print:px-1 print:py-1">
                      {Number(item.gst_rate).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 text-right font-medium print:px-1 print:py-1">
                      ₹
                      {(
                        Number(item.amount) +
                        (Number(item.amount) * Number(item.gst_rate)) / 100
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))}

                {/* Spacer Row to push vertical borders down */}
                <tr className="hidden print:table-row print:h-full">
                  <td className="border-r border-neutral-200"></td>
                  <td className="border-r border-neutral-200"></td>
                  <td className="border-r border-neutral-200"></td>
                  <td className="border-r border-neutral-200"></td>
                  <td className="border-r border-neutral-200"></td>
                  <td className="border-r border-neutral-200"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          {/* ============================================= */}
          {/* AMOUNT SUMMARY + PAYMENT SUMMARY */}
          {/* ============================================= */}
          <div className="grid grid-cols-2 gap-4 mb-4 print:gap-2 print:mb-2">
            {/* Payment Summary */}
            <div className="border-2 border-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                  Payment Summary
                </h3>
              </div>
              <div className="p-3 text-sm space-y-2 print:p-2 print:text-sm print:space-y-1">
                <div className="flex justify-between">
                  <span>Paid Amount:</span>
                  <span className="font-semibold text-green-700">
                    ₹{Number(invoice.paid_amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-neutral-300 pt-2">
                  <span className="font-bold">Amount in Words:</span>
                </div>
                <div>
                  <span className="font-medium text-xs italic capitalize">
                    {converter.toWords(Number(invoice.total_amount))} Rupees
                    Only
                  </span>
                </div>
              </div>
            </div>

            {/* Amount Summary */}
            <div className="border-2 border-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                  Amount Summary
                </h3>
              </div>
              <div className="p-3 text-sm space-y-1 print:p-2 print:text-sm print:space-y-0.5">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (GST):</span>
                  <span>₹{Number(invoice.total_tax).toFixed(2)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-₹{Number(invoice.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t-2 border-black pt-2 mt-2">
                  <span>GRAND TOTAL:</span>
                  <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================= */}
          {/* TERMS & CONDITIONS + BANK DETAILS */}
          {/* ============================================= */}
          <div className="grid grid-cols-2 gap-4 mb-4 print:gap-2 print:mb-2">
            {/* Terms & Conditions */}
            <div className="border-2 border-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                  Terms & Conditions
                </h3>
              </div>
              <div className="p-3 text-xs space-y-1 print:p-2 print:text-xs print:space-y-0">
                <p>
                  <span className="font-bold">1. </span>Warranty void if seal is
                  broken or tampered with.
                </p>
                <p>
                  <span className="font-bold">2. </span>Goods once sold will not
                  be taken back.
                </p>
                <p>
                  <span className="font-bold">3. </span>Subject to Pune
                  jurisdiction only.
                </p>
                <p>
                  <span className="font-bold">4. </span>Interest @ 24% p.a. will
                  be charged if bill is not paid on due date.
                </p>
              </div>
            </div>

            {/* Bank Details */}
            <div className="border-2 border-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm">
                  Bank Details
                </h3>
              </div>
              <div className="p-3 text-xs space-y-1 print:p-2 print:text-xs print:space-y-0">
                <p>
                  <span className="font-semibold">Bank:</span> HDFC Bank
                </p>
                <p>
                  <span className="font-semibold">A/c Name:</span> Shivangi
                  Infotech
                </p>
                <p>
                  <span className="font-semibold">A/c No:</span> 50200012345678
                </p>
                <p>
                  <span className="font-semibold">IFSC:</span> HDFC0000123
                </p>
              </div>
            </div>
          </div>

          {/* ============================================= */}
          {/* SIGNATURES */}
          {/* ============================================= */}
          <div className="border-2 border-black flex justify-between h-24 print:h-20">
            <div className="p-4 print:p-2 flex flex-col justify-end w-1/2">
              <p className="font-bold text-sm print:text-sm">
                {invoice.customer_name}
              </p>
              <div className="h-2" />
              <p className="text-xs print:text-xs text-neutral-500">
                Customer Signature
              </p>
            </div>
            <div className="p-4 print:p-2 flex flex-col justify-between text-right w-1/2 border-l-2 border-dashed border-neutral-300 print:border-neutral-300">
              <p className="font-bold text-sm print:text-sm">
                For SHIVANGI INFOTECH
              </p>
              <p className="text-xs print:text-xs">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// =====================================================
// Payment History Component
// =====================================================

const PAYMENT_METHOD_STYLES: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  CASH: { label: "Cash", bg: "bg-green-100", text: "text-green-700" },
  UPI: { label: "UPI", bg: "bg-purple-100", text: "text-purple-700" },
  CARD: { label: "Card", bg: "bg-blue-100", text: "text-blue-700" },
  NEFT: { label: "NEFT", bg: "bg-cyan-100", text: "text-cyan-700" },
  CHEQUE: { label: "Cheque", bg: "bg-amber-100", text: "text-amber-700" },
  WALLET: { label: "Wallet", bg: "bg-pink-100", text: "text-pink-700" },
  OTHER: { label: "Other", bg: "bg-neutral-100", text: "text-neutral-700" },
};

function PaymentHistory({
  invoiceId,
  totalAmount,
}: {
  invoiceId: string;
  totalAmount: number;
}) {
  const { data: payments, isLoading } = useQuery({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: () => billingApi.getPayments(invoiceId),
    enabled: !!invoiceId,
  });

  if (isLoading) return <LoadingState />;
  if (!payments || payments.length === 0) {
    return (
      <Card className="mt-6 print:hidden">
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          Payment History
        </h3>
        <p className="text-neutral-500 text-center py-6">
          No payments recorded yet
        </p>
      </Card>
    );
  }

  // Sort by date ascending for running balance calculation
  const sortedPayments = [...payments].sort(
    (a, b) =>
      new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
  );

  let runningPaid = 0;

  return (
    <Card className="mt-6 print:hidden">
      <h3 className="text-lg font-semibold text-neutral-900 mb-1 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-primary-500" />
        Payment History
      </h3>
      <p className="text-sm text-neutral-500 mb-4">
        {payments.length} payment{payments.length !== 1 ? "s" : ""} recorded
      </p>

      <div className="space-y-0">
        {sortedPayments.map((payment, idx) => {
          runningPaid += Number(payment.amount);
          const balanceAfter = totalAmount - runningPaid;
          const methodStyle =
            PAYMENT_METHOD_STYLES[payment.payment_method] ||
            PAYMENT_METHOD_STYLES.OTHER;

          return (
            <div key={payment.id || idx} className="relative">
              {/* Timeline connector */}
              {idx < sortedPayments.length - 1 && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-neutral-200" />
              )}

              <div className="flex gap-4 pb-5">
                {/* Timeline dot */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      idx === sortedPayments.length - 1
                        ? "bg-green-100 text-green-600"
                        : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>

                {/* Payment details */}
                <div className="flex-1 bg-neutral-50 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-neutral-900">
                          ₹{Number(payment.amount).toLocaleString("en-IN")}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${methodStyle.bg} ${methodStyle.text}`}
                        >
                          {methodStyle.label}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-500 mt-1">
                        {format(
                          new Date(payment.payment_date),
                          "dd MMM yyyy, hh:mm a",
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-neutral-400 uppercase tracking-wider">
                        Balance after
                      </p>
                      <p
                        className={`font-semibold ${
                          balanceAfter <= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {balanceAfter <= 0
                          ? "₹0 — Fully Paid"
                          : `₹${balanceAfter.toLocaleString("en-IN")} due`}
                      </p>
                    </div>
                  </div>

                  {/* Reference & Received By */}
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
                    {payment.reference && (
                      <span>
                        <span className="font-medium text-neutral-600">
                          Ref:
                        </span>{" "}
                        {payment.reference}
                      </span>
                    )}
                    {payment.received_by_name && (
                      <span>
                        <span className="font-medium text-neutral-600">
                          Received by:
                        </span>{" "}
                        {payment.received_by_name}
                      </span>
                    )}
                    {payment.notes && (
                      <span>
                        <span className="font-medium text-neutral-600">
                          Note:
                        </span>{" "}
                        {payment.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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

          {/* Payment History — visible to owner/manager only, hidden from print */}
          {invoice.is_finalized && (
            <PaymentHistory
              invoiceId={invoice.id}
              totalAmount={Number(invoice.total_amount)}
            />
          )}
        </div>

        {/* Print Portal */}
        <PrintPortal>
          <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999]">
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
