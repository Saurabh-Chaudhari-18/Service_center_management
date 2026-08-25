import React from "react";
import { format } from "date-fns";
import type { Invoice, Branch } from "@/types";
import { formatPhone } from "@/lib/formatters";
import converter from "number-to-words";

// =====================================================
// Brand Logo Component (Reused)
// =====================================================
export function BrandLogo({ brand }: { brand: "HP" | "DELL" | "ASUS" | "LENOVO" }) {
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
// Invoice View Component (Shared Layout)
// =====================================================

export interface InvoiceTemplateProps {
  invoice: Invoice;
  branchDetails?: Branch | null;
  customShopName?: string;
}

export function InvoiceTemplate({
  invoice,
  branchDetails,
  customShopName,
}: InvoiceTemplateProps) {
  const branch = branchDetails || invoice.branch_details;

  // Shop name: custom override → branch name → organization name → fallback
  const shopName =
    customShopName ||
    branch?.name ||
    branch?.organization_name ||
    "SHIVANGI INFOTECH";

  // Address: fully from the selected branch; blank lines are filtered out
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
    : "Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa Showroom, Pune-411038";

  // Phone from branch
  const phone = branch?.phone
    ? formatPhone(branch.phone)
    : "9890888295, 9850292673";

  // GSTIN from branch
  const gstin = branch?.gstin ?? "";

  return (
    <div className="paper-doc bg-white text-black p-8 max-w-4xl mx-auto print:p-0 print:max-w-none print:m-0 print:w-full">
      {/* ============================================= */}
      {/* COMPANY HEADER */}
      {/* ============================================= */}
      <div className="border-2 border-black p-4 mb-4 print:p-2.5 print:mb-3">
        <div className="flex items-center justify-between mb-3 print:mb-2">
          <div className="flex gap-4 items-center print:gap-3">
            <BrandLogo brand="HP" />
            <BrandLogo brand="DELL" />
            <BrandLogo brand="ASUS" />
            <BrandLogo brand="LENOVO" />
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-bold uppercase tracking-wider print:text-xl">
              {shopName}
            </h1>
            <p className="text-sm font-semibold print:text-xs">
              HP | DELL | ASUS Authorised Partner
            </p>
          </div>
        </div>
        <div className="text-center border-t border-black pt-2 text-xs print:text-[10px] print:pt-1">
          <p>{fullAddress}</p>
          <p>Mobile: {phone}</p>
          {gstin && (
            <p className="mt-1 font-bold print:mt-0.5">GSTIN: {gstin}</p>
          )}
        </div>
      </div>

      {/* ============================================= */}
      {/* CUSTOMER DETAILS + INVOICE DETAILS */}
      {/* ============================================= */}
      <div className="grid grid-cols-2 gap-4 mb-4 print:gap-3 print:mb-3 text-black">
        {/* Customer Details */}
        <div className="border-2 border-black">
          <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
            <h3 className="text-sm font-bold uppercase tracking-wide print:text-xs text-black">
              Customer Details
            </h3>
          </div>
          <div className="p-3 text-sm space-y-1 print:p-2 print:text-xs print:space-y-0.5 text-black">
            <p>
              <span className="font-semibold text-black">Name:</span>{" "}
              {invoice.customer_name}
            </p>
            <p>
              <span className="font-semibold text-black">Mobile:</span>{" "}
              {invoice.customer_mobile}
            </p>
            {invoice.customer_email && (
              <p>
                <span className="font-semibold text-black">Email:</span>{" "}
                {invoice.customer_email}
              </p>
            )}
            {invoice.customer_address && (
              <p>
                <span className="font-semibold text-black">Address:</span>{" "}
                {invoice.customer_address}
              </p>
            )}
            {invoice.customer_gstin && (
              <p>
                <span className="font-semibold text-black">GSTIN:</span>{" "}
                <span className="font-mono text-black">{invoice.customer_gstin}</span>
              </p>
            )}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="border-2 border-black">
          <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
            <h3 className="text-sm font-bold uppercase tracking-wide print:text-xs text-black">
              Invoice Details
            </h3>
          </div>
          <div className="p-3 text-sm space-y-1 print:p-2 print:text-xs print:space-y-0.5 text-black">
            <p>
              <span className="font-semibold text-black">Invoice #:</span>{" "}
              {invoice.invoice_number}
            </p>
            <p>
              <span className="font-semibold text-black">Date:</span>{" "}
              {format(new Date(invoice.invoice_date), "dd MMM yyyy")}
            </p>
            {invoice.job_number && (
              <p>
                <span className="font-semibold text-black">Job Ref:</span>{" "}
                {invoice.job_number}
              </p>
            )}
            {invoice.is_interstate && invoice.place_of_supply && (
              <p>
                <span className="font-semibold text-black">Place of Supply:</span>{" "}
                {invoice.place_of_supply}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* LINE ITEMS */}
      {/* ============================================= */}
      <div className="border-2 border-black mb-4 print:mb-3 text-black">
        <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1 text-black">
          <h3 className="text-sm font-bold uppercase tracking-wide print:text-xs text-black">
            Item Details
          </h3>
        </div>
        <table className="w-full border-collapse text-sm print:text-xs text-black">
          <thead>
            <tr className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-800 font-semibold text-left border-b border-black print:bg-neutral-100 print:text-[10px]">
              <th className="px-3 py-2 border-r border-neutral-300 w-8 print:px-2 print:py-1 print:w-8 text-black">
                #
              </th>
              <th className="px-3 py-2 border-r border-neutral-300 print:px-2 print:py-1 text-black">
                Item & Description
              </th>
              <th className="px-3 py-2 border-r border-neutral-300 w-20 print:px-2 print:py-1 print:w-16 text-black">
                HSN/SAC
              </th>
              <th className="px-3 py-2 text-right border-r border-neutral-300 w-12 print:px-2 print:py-1 print:w-10 text-black">
                Qty
              </th>
              <th className="px-3 py-2 text-right border-r border-neutral-300 w-24 print:px-2 print:py-1 print:w-20 text-black">
                Rate
              </th>
              <th className="px-3 py-2 text-right border-r border-neutral-300 w-16 print:px-2 print:py-1 print:w-14 text-black">
                Tax %
              </th>
              <th className="px-3 py-2 text-right w-24 print:px-2 print:py-1 print:w-20 text-black">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {(invoice.line_items || []).map((item, idx) => (
              <tr
                key={idx}
                className="border-b border-neutral-300 print:break-inside-avoid text-black"
              >
                <td className="px-3 py-2 text-neutral-700 border-r border-neutral-300 print:px-2 print:py-1 print:text-[11px] text-black">
                  {idx + 1}
                </td>
                <td className="px-3 py-2 border-r border-neutral-300 print:px-2 print:py-1 text-black">
                  <p className="font-medium text-black">
                    {item.description}
                  </p>
                  <span className="text-xs text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded print:hidden">
                    {item.item_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-800 border-r border-neutral-300 print:px-2 print:py-1 print:text-[11px] text-black">
                  {item.hsn_sac_code || "-"}
                </td>
                <td className="px-3 py-2 text-right border-r border-neutral-300 print:px-2 print:py-1 print:text-[11px] text-black">
                  {item.quantity}
                </td>
                <td className="px-3 py-2 text-right border-r border-neutral-300 print:px-2 print:py-1 print:text-[11px] text-black">
                  ₹{Number(item.unit_price).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-neutral-800 border-r border-neutral-300 print:px-2 print:py-1 print:text-[11px] text-black">
                  {Number(item.gst_rate).toFixed(0)}%
                </td>
                <td className="px-3 py-2 text-right font-medium print:px-2 print:py-1 print:text-[11px] text-black">
                  ₹
                  {(
                    Number(item.amount) +
                    (Number(item.amount) * Number(item.gst_rate)) / 100
                  ).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>


        <div>
          {/* ============================================= */}
          {/* AMOUNT SUMMARY + PAYMENT SUMMARY */}
          {/* ============================================= */}
          <div className="grid grid-cols-2 gap-4 mb-4 print:gap-2 print:mb-2 print:break-inside-avoid text-black">
            {/* Payment Summary */}
            <div className="border-2 border-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm text-black">
                  Payment Summary
                </h3>
              </div>
              <div className="p-3 text-sm space-y-2 print:p-2 print:text-sm print:space-y-1 text-black">
                <div className="flex justify-between">
                  <span className="text-[#000000]">Paid Amount:</span>
                  <span className="font-semibold text-green-700">
                    ₹{Number(invoice.paid_amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-dashed border-neutral-400 pt-2 text-black">
                  <span className="font-bold text-black">Amount in Words:</span>
                </div>
                <div>
                  <span className="font-medium text-xs italic capitalize text-black">
                    {converter.toWords(Number(invoice.total_amount))} Rupees
                    Only
                  </span>
                </div>
              </div>
            </div>

            {/* Amount Summary */}
            <div className="border-2 border-black text-black">
              <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm text-black">
                  Amount Summary
                </h3>
              </div>
              <div className="p-3 text-sm space-y-1 print:p-2 print:text-sm print:space-y-0.5 text-black">
                <div className="flex justify-between text-black">
                  <span>Subtotal:</span>
                  <span>₹{Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-black">
                  <span>Tax (GST):</span>
                  <span>₹{Number(invoice.total_tax).toFixed(2)}</span>
                </div>
                {Number(invoice.discount_amount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount:</span>
                    <span>-₹{Number(invoice.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t-2 border-black pt-2 mt-2 text-black">
                  <span>GRAND TOTAL:</span>
                  <span>₹{Number(invoice.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================= */}
          {/* BOTTOM SECTION (Terms, Bank, Signatures) */}
          {/* ============================================= */}
          <div className="print:break-inside-avoid text-black">
            <div className="grid grid-cols-2 gap-4 mb-4 print:gap-2 print:mb-2">
              {/* Terms & Conditions */}
              <div className="border-2 border-black text-black">
                <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1 text-black">
                  <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm text-black">
                    Terms & Conditions
                  </h3>
                </div>
                <div className="p-3 text-xs space-y-1 print:p-2 print:text-xs print:space-y-0 text-black">
                  <p className="text-[#000000]">
                    <span className="font-bold text-black">1. </span>Warranty void if seal
                    is broken or tampered with.
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-bold text-black">2. </span>Goods once sold will
                    not be taken back.
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-bold text-black">3. </span>Subject to{" "}
                    {branch?.city || "local"} jurisdiction only.
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-bold text-black">4. </span>Interest @ 24% p.a.
                    will be charged if bill is not paid on due date.
                  </p>
                </div>
              </div>

              {/* Bank Details */}
              <div className="border-2 border-black text-black">
                <div className="bg-white px-3 py-1.5 border-b-2 border-black print:px-2 print:py-1">
                  <h3 className="text-sm font-bold uppercase tracking-wide print:text-sm text-black">
                    Bank Details
                  </h3>
                </div>
                <div className="p-3 text-xs space-y-1 print:p-2 print:text-xs print:space-y-0 text-black">
                  <p className="text-[#000000]">
                    <span className="font-semibold text-black">Bank:</span>{" "}
                    {invoice.branch_details?.effective_bank_name || "HDFC Bank"}
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-semibold text-black">A/c Name:</span>{" "}
                    {invoice.branch_details?.name || "Shivangi Infotech"}
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-semibold text-black">A/c No:</span>{" "}
                    {invoice.branch_details?.effective_bank_account_number || "50200012345678"}
                  </p>
                  <p className="text-[#000000]">
                    <span className="font-semibold text-black">IFSC:</span>{" "}
                    {invoice.branch_details?.effective_bank_ifsc || "HDFC0000123"}
                    {invoice.branch_details?.effective_bank_branch
                      ? ` (${invoice.branch_details.effective_bank_branch})`
                      : ""}
                  </p>
                </div>
              </div>
            </div>

            {/* ============================================= */}
            {/* SIGNATURES */}
            {/* ============================================= */}
            <div className="border-2 border-black flex justify-between h-24 print:h-20 text-black">
              <div className="p-4 print:p-2 flex flex-col justify-end w-1/2">
                <p className="font-bold text-sm print:text-sm text-black">
                  {invoice.customer_name}
                </p>
                <div className="h-2" />
                <p className="text-xs print:text-xs text-neutral-600">
                  Customer Signature
                </p>
              </div>
              <div className="p-4 print:p-2 flex flex-col justify-between text-right w-1/2 border-l-2 border-dashed border-neutral-400 print:border-neutral-400">
                <p className="font-bold text-sm print:text-sm text-black">
                  For {shopName.toUpperCase()}
                </p>
                <p className="text-xs print:text-xs text-black">
                  {branch?.effective_authorized_signatory || branch?.authorized_signatory || "Authorized Signatory"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

