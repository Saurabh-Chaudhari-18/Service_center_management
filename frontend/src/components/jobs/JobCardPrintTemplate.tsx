"use client";

import { createPortal } from "react-dom";
import { formatDateLong, formatPhone } from "@/lib/formatters";
import type { JobCard, Branch } from "@/types";

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root" className="print-container">{children}</div>,
    document.body,
  );
};

interface JobCardPrintTemplateProps {
  job: JobCard;
  branchDetails?: Branch | null;
}

export function JobCardPrintTemplate({ job, branchDetails }: JobCardPrintTemplateProps) {
  const shopName = branchDetails?.organization_name || branchDetails?.name || "Service Center";
  const branchName = branchDetails?.name || shopName;
  const addressParts = [
    branchDetails?.address_line1,
    branchDetails?.address_line2,
    branchDetails?.city,
    branchDetails?.state,
    branchDetails?.pincode,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "—";
  const phone = branchDetails?.phone ? formatPhone(branchDetails.phone) : "—";
  return (
    <PrintPortal>
      {/* eslint-disable-next-line react/no-danger */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              #print-portal-root .print-section {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #print-portal-root table {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #print-portal-root tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #print-portal-root .print-header {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
            }
          `,
        }}
      />
      <div className="paper-doc bg-white text-black p-6 text-[10pt] leading-[1.25] print:p-2 print:text-[9.5pt] print:leading-[1.2] space-y-3 print:space-y-1.5">
        {/* Shop Header */}
        <div className="print-header print-section border-2 border-black p-2 print:p-1.5">
          <div className="flex items-center justify-between mb-1 print:mb-0.5">
            <div className="flex gap-4 items-center">
              <span className="text-[9pt] text-neutral-500">{branchName}</span>
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold uppercase tracking-wider print:text-xl">
                {shopName}
              </h1>
            </div>
          </div>
          <div className="text-center mt-1 pt-1 border-t border-black">
            <p className="text-[10pt] print:text-[9pt] font-medium">
              {fullAddress}
            </p>
            <p className="text-[10pt] print:text-[9pt] font-bold mt-0.5">
              Mobile: {phone}
            </p>
          </div>
          <div className="text-center mt-1 pt-1 border-t border-black">
            <p className="font-bold text-lg print:text-base uppercase tracking-wide">
              JOB CARD: {job.job_number}
            </p>
            <p className="text-[11pt] print:text-[9.5pt] font-medium">
              Date: {formatDateLong(job.created_at)}
            </p>
            <p className="text-[10pt] print:text-[9pt] font-medium text-neutral-600">
              Status: {job.status?.replace(/_/g, " ")}
            </p>
          </div>
        </div>

        {/* Customer & Device */}
        <div className="print-grid print-section grid grid-cols-2 gap-4 print:gap-2">
          <div className="border border-black p-2 print:p-1.5">
            <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
              CUSTOMER DETAILS
            </p>
            <div className="space-y-1 print:space-y-0.5">
              <p>
                <b>Name:</b> {job.customer?.first_name}{" "}
                {job.customer?.last_name}
              </p>
              <p>
                <b>Mobile:</b> {formatPhone(job.customer?.mobile)}
              </p>
              {job.customer?.email && (
                <p>
                  <b>Email:</b> {job.customer.email}
                </p>
              )}
              {job.customer?.city && (
                <p>
                  <b>Address:</b> {job.customer.city}
                  {job.customer?.state ? `, ${job.customer.state}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="border border-black p-2 print:p-1.5">
            <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
              DEVICE DETAILS
            </p>
            <div className="space-y-1 print:space-y-0.5">
              <p>
                <b>Type:</b> {job.device_type}
              </p>
              <p>
                <b>Brand/Model:</b> {job.brand} {job.model}
              </p>
              {job.serial_number && (
                <p>
                  <b>Serial:</b> {job.serial_number}
                </p>
              )}
              {job.is_urgent && (
                <p className="text-red-600 font-bold text-[11pt] print:text-[9.5pt] mt-0.5">
                  ⚠ URGENT REPAIR
                </p>
              )}
              <p>
                <b>Warranty:</b> {job.is_warranty_repair ? "YES" : "NO"}
              </p>
              {job.is_warranty_repair && job.warranty_details && (
                <p>
                  <b>Warranty Details:</b> {job.warranty_details}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Accessories */}
        <div className="print-section border border-black p-2 print:p-1.5">
          <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
            ACCESSORIES
          </p>
          <div className="space-y-1 print:space-y-0.5">
            {job.accessories && job.accessories.length > 0 ? (
              <p>
                <b>Accessories:</b>{" "}
                {job.accessories
                  .filter((a) => a.is_present)
                  .map((a) =>
                    a.accessory_type.toLowerCase().replace("_", " "),
                  )
                  .join(", ")}
              </p>
            ) : (
              <p className="text-neutral-400">No accessories submitted</p>
            )}
            <p>
              <b>Physical Condition:</b>{" "}
              {(job as any).physical_condition_display || "Not documented"}
            </p>
          </div>
        </div>

        {/* Issue Details */}
        <div className="print-section border border-black p-2 print:p-1.5">
          <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
            ISSUE DETAILS
          </p>
          <div className="space-y-1 print:space-y-0.5">
            <p>
              <b>Customer Complaint:</b> {job.customer_complaint}
            </p>
            {job.diagnosis_notes && (
              <p>
                <b>Diagnosis Notes:</b> {job.diagnosis_notes}
              </p>
            )}
            {job.additional_comments && (
              <p>
                <b>Additional Comments:</b> {job.additional_comments}
              </p>
            )}
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="print-section border border-black p-2 print:p-1.5 terms-text">
          <p className="font-bold text-[10pt] print:text-[9pt] mb-0.5 uppercase underline">
            TERMS &amp; CONDITIONS
          </p>
          <div className="space-y-1 text-[9pt] print:text-[8.5pt] leading-[1.3] text-justify">
            <p>
              <b>1. Condition:</b> In case of hard disk failure, formatting
              may be required which may lead to data loss. Customers are
              advised to backup important data. Only recommended OS with
              drivers will be installed. Physical/water/burn damage not
              covered under warranty. For warranty claims, provide purchase
              invoice. Defective parts not returned. Product may become
              non-functional during repair - we will not be responsible.
            </p>
            <p>
              <b>2. Note:</b> Customer must confirm repair within 48 hours of
              estimate, else repair will proceed automatically. Defective
              parts not returned. Complaints must be reported within 24 hours
              of delivery. Collect product within 45 days or it will be
              scrapped. After 45 days, ₹500/month handling charge applies.
            </p>
          </div>
        </div>

        {/* Authorization & Charges */}
        <div className="print-grid print-section grid grid-cols-2 gap-4 print:gap-2">
          <div className="border border-black p-2 print:p-1.5 flex flex-col justify-between">
            <div>
              <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
                CUSTOMER AUTHORIZATION
              </p>
              <p className="text-[10pt] print:text-[8.5pt] mb-2 italic">
                I hereby authorize {shopName} to provide necessary
                repair &amp; service. I have taken backup of all important
                data.
              </p>
            </div>
            <div className="mt-4 pt-1 border-t border-dashed border-black">
              <p className="font-bold mb-1 print:text-[9pt]">
                {job.customer?.first_name} {job.customer?.last_name}
              </p>
              <p className="font-bold print:text-[9pt]">
                Customer Signature: _________________
              </p>
            </div>
          </div>
          <div className="border border-black p-2 print:p-1.5">
            <p className="font-bold border-b border-black text-[11pt] print:text-[9.5pt] mb-1.5 print:mb-1 uppercase bg-slate-100">
              APPROX REPAIR CHARGES
            </p>
            <div className="space-y-2 text-[11pt] print:text-[9.5pt]">
              <p className="flex justify-between border-b border-dotted border-neutral-400 pb-0.5">
                <span>Service Charges:</span>
                <span className="w-24 border-b border-black text-right px-1">
                  {job.estimated_cost
                    ? `₹ ${Number(job.estimated_cost).toFixed(0)}`
                    : "₹"}
                </span>
              </p>
              <p className="flex justify-between border-b border-dotted border-neutral-400 pb-0.5">
                <span>Parts/Spares:</span>
                <span className="w-24 border-b border-black text-right px-1">
                  {job.total_parts_cost
                    ? `₹ ${Number(job.total_parts_cost).toFixed(0)}`
                    : "₹"}
                </span>
              </p>
              <p className="flex justify-between border-b border-dotted border-neutral-400 pb-0.5">
                <span>Discount:</span>
                <span className="w-24 border-b border-black">₹</span>
              </p>
              <p className="flex justify-between font-bold text-lg print:text-base pt-0.5">
                <span>FINAL COST:</span>
                <span className="w-24 border-b-2 border-black">₹</span>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer-text text-center mt-1 pt-1.5 border-t border-black text-[9pt] print:text-[8pt]">
          <p>
            All estimates without taxes. GST are Extra as applicable.
            Diagnosis: Laptop ₹750, Mobile/Tablet ₹500, Desktop ₹350-550
          </p>
          <p className="font-bold text-[10pt] print:text-[8.5pt] mt-0.5">
            NON-WARRANTY PRODUCTS HAVE NO WARRANTY ON REPAIRING
          </p>
        </div>
      </div>
    </PrintPortal>
  );
}
