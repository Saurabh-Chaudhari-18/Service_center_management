"use client";

// Focused interactive island below the server route boundary.

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
  Edit,
  History,
  MoreVertical,
} from "lucide-react";
import { formatDateLong, formatDateTime } from "@/lib/formatters";
import { InvoiceTemplate } from "@/components/billing/InvoiceTemplate";
import { PrintInvoiceOptionsModal } from "@/components/billing/PrintInvoiceOptionsModal";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import type { Branch } from "@/types";
import { PageShell } from "@/components/shell";

// =====================================================
// Print Portal Util
// =====================================================

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root" className="print-container">{children}</div>,
    document.body,
  );
};



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
  const { toast } = useToast();
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
      toast.error("Failed to record payment");
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

  if (isLoading) return <LoadingState message="Loading invoice…" />;
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
          const currentPaid = sortedPayments
            .slice(0, idx + 1)
            .reduce((sum, p) => sum + Number(p.amount), 0);
          const balanceAfter = totalAmount - currentPaid;
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
                        {formatDateTime(payment.payment_date)}
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
// Edit History Component
// =====================================================

function EditHistory({ invoiceId }: { invoiceId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ["invoice-edit-history", invoiceId],
    queryFn: () => billingApi.getEditHistory(invoiceId),
    enabled: !!invoiceId,
  });

  if (isLoading) return <LoadingState message="Loading invoice…" />;
  if (!history || history.length === 0) return null;

  return (
    <Card className="mt-6 print:hidden">
      <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-primary-500" />
        Edit History
      </h3>
      <div className="space-y-4">
        {history.map((edit: any, idx: number) => (
          <div key={edit.id} className="relative">
            {idx < history.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-neutral-200" />
            )}
            <div className="flex gap-4">
              <div className="flex-shrink-0 mt-1">
                <div className="w-6 h-6 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center z-10 relative">
                  <div className="w-2 h-2 rounded-full bg-neutral-400" />
                </div>
              </div>
              <div className="pb-2">
                <div className="text-sm text-neutral-900 font-medium space-y-1">
                  {edit.summary.split("\n").map((line: string, i: number) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 mt-1">
                  <span className="font-semibold text-primary-600">
                    {edit.edit_type_display}
                  </span>
                  <span>•</span>
                  <span>{edit.edited_by_name}</span>
                  <span>•</span>
                  <span>
                    {formatDateTime(edit.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// MoreMenu — overflow action dropdown
// =====================================================

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

function MoreMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="secondary"
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-4 h-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[11rem] rounded-xl border border-neutral-200 bg-white shadow-lg py-1 overflow-hidden">
            {actions.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-neutral-400">{item.icon}</span>
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-neutral-400">{item.icon}</span>
                  {item.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
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
  const { toast } = useToast();

  const queryClient = useQueryClient();
  const { currentBranch, accessibleBranches } = useAuth();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);
  const [selectedPrintBranch, setSelectedPrintBranch] = useState<Branch | null>(null);
  const [selectedPrintCustomName, setSelectedPrintCustomName] = useState<string | undefined>(undefined);

  const {
    data: invoice,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => billingApi.getInvoice(id),
    enabled: !!id,
  });

  const handleConfirmPrint = async (selectedBranch: Branch | null, customName?: string) => {
    setSelectedPrintBranch(selectedBranch);
    setSelectedPrintCustomName(customName);
    try {
      await billingApi.logDownload(id);
      queryClient.invalidateQueries({ queryKey: ["invoice-edit-history", id] });
    } catch (error) {
      console.error("Failed to log download:", error);
    }
    setTimeout(() => window.print(), 300);
  };

  const handlePrint = () => {
    setShowPrintOptionsModal(true);
  };

  const handleDownload = () => {
    toast.info(
      "Select 'Save as PDF' as the destination in the print dialog to download.",
    );
    setShowPrintOptionsModal(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <Header title="Invoice" subtitle="Loading invoice details" />
        <PageShell width="constrained"><LoadingState message="Loading invoice…" /></PageShell>
      </AppLayout>
    );
  }

  if (error || !invoice) {
    return (
      <AppLayout>
        <Header title="Invoice" />
        <PageShell width="constrained">
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
        </PageShell>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canViewBilling">
      <AppLayout>
        <Header
          title={`Invoice ${invoice.invoice_number}`}
          subtitle={formatDateLong(invoice.invoice_date)}
          breadcrumbs={[
            { label: "Sales Register", href: "/billing" },
            { label: invoice.invoice_number },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => router.push("/billing")}
              >
                Billing
              </Button>
              {Number(invoice.balance_due) > 0 &&
                invoice.status !== "CANCELLED" && (
                  <Button
                    leftIcon={<CreditCard className="w-4 h-4" />}
                    onClick={() => setIsPaymentModalOpen(true)}
                  >
                    Record Payment
                  </Button>
                )}
              <MoreMenu
                actions={[
                  {
                    label: "Edit Invoice",
                    icon: <Edit className="w-4 h-4" />,
                    onClick: () => router.push(`/billing/${id}/edit`),
                  },
                  {
                    label: "Print",
                    icon: <Printer className="w-4 h-4" />,
                    onClick: handlePrint,
                  },
                  {
                    label: "Download PDF",
                    icon: <Download className="w-4 h-4" />,
                    onClick: handleDownload,
                  },
                ]}
              />
            </div>
          }
        />

        <PageShell width="constrained">
          {/* Status strip */}
          <div className="mb-6 print:hidden">
            <InvoiceStatusBadge status={invoice.status} />
          </div>

          <Card padding="none" className="overflow-hidden">
            <InvoiceTemplate
              invoice={invoice}
              branchDetails={selectedPrintBranch || invoice.branch_details}
              customShopName={selectedPrintCustomName}
            />
          </Card>

          <EditHistory invoiceId={invoice.id} />

          <PaymentHistory
            invoiceId={invoice.id}
            totalAmount={Number(invoice.total_amount)}
          />
        </PageShell>

        {/* Print Portal */}
        <PrintPortal>
          <div>
            <InvoiceTemplate
              invoice={invoice}
              branchDetails={selectedPrintBranch || invoice.branch_details}
              customShopName={selectedPrintCustomName}
            />
          </div>
        </PrintPortal>

        {/* Header Options Modal for Print */}
        <PrintInvoiceOptionsModal
          isOpen={showPrintOptionsModal}
          onClose={() => setShowPrintOptionsModal(false)}
          onConfirm={handleConfirmPrint}
          branchDetails={invoice.branch_details || currentBranch || null}
          allBranches={accessibleBranches}
        />

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
