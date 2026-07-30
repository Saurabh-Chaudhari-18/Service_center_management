"use client";

import React from "react";
import * as z from "zod";
import { BrandLogo } from "@/components/billing/InvoiceTemplate";
import { formatDateLong, formatPhone } from "@/lib/formatters";
import type { JobCard, Customer, Branch } from "@/types";

// =====================================================
// Schemas & Types (re-exported for consumers)
// =====================================================

export const invoiceLineItemSchema = z.object({
  item_type: z.enum(["SERVICE", "PART", "LABOUR", "OTHER"]),
  description: z.string().min(1, "Description is required"),
  hsn_sac_code: z.string().optional(),
  quantity: z.number().min(1, "Minimum quantity is 1"),
  unit_price: z.number().min(0, "Price cannot be negative"),
  gst_rate: z.number().min(0, "GST rate cannot be negative"),
  inventory_item: z.string().uuid().optional(),
});

export const createInvoiceSchema = z
  .object({
    job_id: z.string().optional(),
    customer_id: z.string().optional(),
    branch: z.string().min(1, "Invalid Branch ID"),
    due_date: z.string().optional(),
    notes: z.string().optional(),
    line_items: z.array(invoiceLineItemSchema).min(1, "Add at least one item"),
  })
  .refine((data) => data.job_id || data.customer_id, {
    message: "Please select a customer or a job",
    path: ["customer_id"],
  });

export type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

// =====================================================
// InvoiceFormTemplate Component
// (Screen & Print preview of an in-progress invoice)
// =====================================================

export interface InvoiceFormTemplateProps {
  formData: CreateInvoiceFormData;
  jobDetails: JobCard | null | undefined;
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  customer: Customer | null | undefined;
  branchDetails?: Branch | null;
  customShopName?: string;
}

export function InvoiceFormTemplate({
  formData,
  jobDetails,
  subtotal,
  totalTax,
  grandTotal,
  customer,
  branchDetails,
  customShopName,
}: InvoiceFormTemplateProps) {
  const branch = branchDetails || jobDetails?.branch_details;

  const shopName =
    customShopName ||
    branch?.name ||
    branch?.organization_name ||
    "SHIVANGI INFOTECH";

  const fullAddress = branch?.address_line1
    ? [
        branch.address_line1,
        branch.address_line2,
        branch.city,
        branch.state,
        branch.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "Shop No. 3, Ground Floor, Sai Complex, Pune-Nashik Highway, Pune 411039";

  const phone = branch?.phone
    ? formatPhone(branch.phone)
    : "+91 99999 88888";

  const gstin = branch?.gstin ?? "27ABCDE1234F1Z5";

  return (
    <div className="paper-doc bg-white text-black p-8 max-w-4xl mx-auto">
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
              {shopName}
            </h1>
            <p className="text-sm font-semibold">
              HP | DELL | ASUS Authorised Partner
            </p>
          </div>
        </div>
        <div className="text-center border-t border-black pt-2 text-xs">
          <p>{fullAddress}</p>
          <p>Phone: {phone}</p>
          {gstin && <p className="mt-1 font-bold">GSTIN: {gstin}</p>}
        </div>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-neutral-500 text-sm uppercase tracking-wider mb-1">
            Bill To
          </h3>
          <p className="font-bold text-lg">
            {customer?.first_name} {customer?.last_name}
          </p>
          <p className="text-neutral-600">{customer?.mobile}</p>
          <p className="text-neutral-600">{customer?.email}</p>
          {customer?.address_line1 && (
            <p className="text-neutral-600 text-sm max-w-xs mt-1">
              {customer.address_line1}, {customer.city}
            </p>
          )}
          {customer?.gstin && (
            <p className="text-sm font-mono mt-2">GSTIN: {customer.gstin}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-light text-primary-600 mb-2">INVOICE</h2>
          <div className="space-y-1 text-sm text-neutral-600">
            <p>
              <span className="font-medium mr-2">Date:</span>
              {formatDateLong(new Date().toISOString())}
            </p>
            <p>
              <span className="font-medium mr-2">Job Ref:</span>
              {jobDetails?.job_number}
            </p>
            <p>
              <span className="font-medium mr-2">Status:</span>
              Unpaid
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
            <th className="px-4 py-3 text-right border-b">Qty</th>
            <th className="px-4 py-3 text-right border-b">Rate</th>
            <th className="px-4 py-3 text-right border-b">Tax %</th>
            <th className="px-4 py-3 text-right border-b">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {formData.line_items.map((item, idx) => (
            <tr key={idx} className="text-sm">
              <td className="px-4 py-3 text-neutral-400">{idx + 1}</td>
              <td className="px-4 py-3">
                <p className="font-medium text-neutral-900">
                  {item.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                    {item.item_type}
                  </span>
                  {item.hsn_sac_code && (
                    <span className="text-xs text-neutral-400">
                      HSN: {item.hsn_sac_code}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">{item.quantity}</td>
              <td className="px-4 py-3 text-right">
                ₹{item.unit_price.toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right text-neutral-500">
                {item.gst_rate}%
              </td>
              <td className="px-4 py-3 text-right font-medium">
                ₹
                {(
                  item.quantity *
                  item.unit_price *
                  (1 + item.gst_rate / 100)
                ).toFixed(2)}
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
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-neutral-600">
            <span>Tax (GST)</span>
            <span>₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="border-t border-neutral-200 pt-2 mt-2 flex justify-between items-center font-bold text-lg text-neutral-900">
            <span>Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms and Signatures */}
      <div className="grid grid-cols-2 gap-8 border-t border-neutral-200 pt-8 text-xs text-neutral-500">
        <div>
          <h4 className="font-bold text-neutral-700 mb-2">
            Terms & Conditions
          </h4>
          <ul className="list-disc pl-4 space-y-1">
            <li>Payment is due upon receipt.</li>
            <li>Warranty as per manufacturer policy for parts.</li>
            <li>Service warranty valid for 7 days only on same issue.</li>
            <li>Subject to Pune Jurisdiction.</li>
          </ul>
        </div>
        <div className="text-center pt-8">
          <div className="border-b border-neutral-300 w-32 mx-auto mb-2"></div>
          <p>Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}
