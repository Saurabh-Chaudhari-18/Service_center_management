"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { Printer, Save } from "lucide-react";
import { InvoiceFormTemplate } from "@/components/billing/InvoiceFormTemplate";
import type { CreateInvoiceFormData } from "@/components/billing/InvoiceFormTemplate";
import type { JobCard, Customer, Branch } from "@/types";

export interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  formData: CreateInvoiceFormData;
  jobDetails: JobCard | null | undefined;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  customer: Customer | null | undefined;
  branchDetails?: Branch | null;
  customShopName?: string;
}

/** Portal for print content — must match globals.css #print-portal-root */
function PrintPortal({ children }: { children: React.ReactNode }) {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root" className="print-container" aria-hidden="true" hidden inert>{children}</div>,
    document.body,
  );
}

export function InvoicePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  formData,
  jobDetails,
  subtotal,
  totalTax,
  grandTotal,
  customer,
  branchDetails,
  customShopName,
}: InvoicePreviewModalProps) {
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Screen-only overlay — hidden from print */}
      <div className="modal-overlay print:hidden" onClick={onClose}>
        <div
          className="modal-content max-w-4xl w-full max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-slate-800 shrink-0">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
              Invoice Preview
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Review details before creating the invoice.
            </p>
          </div>

          {/* Scrollable template */}
          <div className="overflow-y-auto flex-1">
            <InvoiceFormTemplate
              formData={formData}
              jobDetails={jobDetails}
              subtotal={subtotal}
              totalTax={totalTax}
              grandTotal={grandTotal}
              customer={customer}
              branchDetails={branchDetails}
              customShopName={customShopName}
            />
          </div>

          {/* Footer Actions */}
          <div className="border-t border-neutral-100 dark:border-slate-800 p-4 flex justify-end gap-3 shrink-0">
            <Button variant="secondary" onClick={onClose}>
              Back to Edit
            </Button>
            <Button
              onClick={() => window.print()}
              variant="secondary"
              leftIcon={<Printer className="w-4 h-4" />}
              disabled={isSubmitting}
            >
              Print
            </Button>
            <Button
              onClick={onConfirm}
              isLoading={isSubmitting}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Confirm & Create Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Printable Area - Rendered via Portal to escape main layout hiding */}
      <PrintPortal>
        <InvoiceFormTemplate
          formData={formData}
          jobDetails={jobDetails}
          subtotal={subtotal}
          totalTax={totalTax}
          grandTotal={grandTotal}
          customer={customer}
          branchDetails={branchDetails}
          customShopName={customShopName}
        />
      </PrintPortal>
    </>
  );
}
