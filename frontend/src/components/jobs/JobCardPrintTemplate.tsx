"use client";

import { createPortal } from "react-dom";
import { formatDateLong, formatPhone } from "@/lib/formatters";
import type { JobCard, Branch } from "@/types";

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root">{children}</div>,
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
                page-break-inside: avoid;
                break-inside: avoid;
              }
              #print-portal-root table {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              #print-portal-root tr {
                page-break-inside: avoid;
                break-inside: avoid;
              }
              #print-portal-root .print-header {
                page-break-after: avoid;
                break-after: avoid;
              }
            }
          `,
        }}
      />
      <div className="bg-white p-6 text-[10pt] leading-[1.3] text-black h-screen flex flex-col justify-between">
        <div className="space-y-3">
          {/* Shop Header */}
          <div className="print-header print-section border-2 border-black p-2 mb-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-4 items-center">
                <span className="text-[9pt] text-neutral-500">{branchName}</span>
              </div>
              <div className="text-right">
                <h1 className="text-2xl font-bold uppercase tracking-wider">
                  {shopName}
                </h1>
              </div>
            </div>
            <div className="text-center mt-2 pt-2 border-t-2 border-black">
              <p className="text-[10pt] font-medium">
                {fullAddress}
              </p>
              <p className="text-[10pt] font-bold mt-1">
                Mobile: {phone}
              </p>
            </div>
            <div className="text-center mt-2 pt-2 border-t-2 border-black">
              <p className="font-bold text-lg uppercase tracking-wide">
                JOB CARD: {job.job_number}
              </p>
              <p className="text-[11pt] font-medium">
                Date: {formatDateLong(job.created_at)}
              </p>
              <p className="text-[10pt] font-medium text-neutral-600">
                Status: {job.status?.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Customer & Device */}
          <div className="print-grid print-section grid grid-cols-2 gap-4 mb-2">
            <div className="border border-black p-2">
              <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                CUSTOMER DETAILS
              </p>
              <div className="space-y-1">
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
            <div className="border border-black p-2">
              <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                DEVICE DETAILS
              </p>
              <div className="space-y-1">
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
                  <p className="text-red-600 font-bold text-[11pt] mt-1">
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
          <div className="print-section border border-black p-2 mb-2">
            <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
              ACCESSORIES
            </p>
            <div className="space-y-2">
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
          <div className="print-section border border-black p-2 mb-2">
            <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
              ISSUE DETAILS
            </p>
            <div className="space-y-2">
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
          <div className="print-section border border-black p-2 terms-text mb-2">
            <p className="font-bold text-[10pt] mb-1 uppercase underline">
              TERMS &amp; CONDITIONS
            </p>
            <div className="space-y-2 text-[9pt] leading-[1.4] text-justify">
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
        </div>

        <div className="space-y-2">
          {/* Authorization & Charges */}
          <div className="print-grid print-section grid grid-cols-2 gap-4">
            <div className="border border-black p-2 h-full flex flex-col justify-between">
              <div>
                <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                  CUSTOMER AUTHORIZATION
                </p>
                <p className="text-[10pt] mb-4 italic">
                  I hereby authorize {shopName} to provide necessary
                  repair &amp; service. I have taken backup of all important
                  data.
                </p>
              </div>
              <div className="mt-8 pt-2 border-t border-dashed border-black">
                <p className="font-bold mb-2">
                  {job.customer?.first_name} {job.customer?.last_name}
                </p>
                <p className="font-bold">
                  Customer Signature: _________________
                </p>
              </div>
            </div>
            <div className="border border-black p-2">
              <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                APPROX REPAIR CHARGES
              </p>
              <div className="space-y-3 text-[11pt]">
                <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                  <span>Service Charges:</span>
                  <span className="w-24 border-b border-black text-right px-1">
                    {job.estimated_cost
                      ? `₹ ${Number(job.estimated_cost).toFixed(0)}`
                      : "₹"}
                  </span>
                </p>
                <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                  <span>Parts/Spares:</span>
                  <span className="w-24 border-b border-black text-right px-1">
                    {job.total_parts_cost
                      ? `₹ ${Number(job.total_parts_cost).toFixed(0)}`
                      : "₹"}
                  </span>
                </p>
                <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                  <span>Discount:</span>
                  <span className="w-24 border-b border-black">₹</span>
                </p>
                <p className="flex justify-between font-bold text-lg pt-1">
                  <span>FINAL COST:</span>
                  <span className="w-24 border-b-2 border-black">₹</span>
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="footer-text text-center mt-2 pt-2 border-t-2 border-black text-[9pt]">
            <p>
              All estimates without taxes. GST are Extra as applicable.
              Diagnosis: Laptop ₹750, Mobile/Tablet ₹500, Desktop ₹350-550
            </p>
            <p className="font-bold text-[10pt] mt-1">
              NON-WARRANTY PRODUCTS HAVE NO WARRANTY ON REPAIRING
            </p>
          </div>
        </div>
      </div>
    </PrintPortal>
  );
}
