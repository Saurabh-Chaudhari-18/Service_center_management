"use client";

import { createPortal } from "react-dom";
import type { JobCard, Branch } from "@/types";
import { formatPhone } from "@/lib/formatters";

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root" className="print-container">{children}</div>,
    document.body,
  );
};

interface JobCardStickerTemplateProps {
  job: JobCard;
  branchDetails?: Branch | null;
}

export function JobCardStickerTemplate({ job, branchDetails }: JobCardStickerTemplateProps) {
  // Shop name
  const shopName = branchDetails?.name || branchDetails?.organization_name || "SHIVANGI INFOTECH";
  
  // Format clean shortened address to fit on a tiny sticker
  const addressParts = [
    branchDetails?.address_line1 || "Shop No.1, Krupalu Soc",
    branchDetails?.city || "Pune"
  ];
  const shortAddress = addressParts.filter(Boolean).join(", ");

  // Shop Phone
  const shopPhone = branchDetails?.phone 
    ? formatPhone(branchDetails.phone) 
    : "9890888295";

  return (
    <PrintPortal>
      {/* eslint-disable-next-line react/no-danger */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              /* Override page size to match exactly the 50mm x 25mm dimensions */
              @page {
                size: 50mm 25mm !important;
                margin: 0 !important;
              }
              body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              /* Hide all other application elements */
              #app-root, header, aside, main, footer, .no-print {
                display: none !important;
                visibility: hidden !important;
              }
              #print-portal-root {
                display: block !important;
                width: 50mm !important;
                height: 25mm !important;
                margin: 0 !important;
                padding: 0 !important;
              }
            }
          `,
        }}
      />
      
      {/* Sticker Layout container */}
      <div 
        className="bg-white text-black p-[1.2mm] box-border overflow-hidden select-none"
        style={{
          width: "50mm",
          height: "25mm",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Branch Name - Top Centered */}
        <div 
          className="text-center font-bold uppercase truncate"
          style={{
            fontSize: "8.5pt",
            lineHeight: "1.1",
            borderBottom: "0.5px solid #000",
            paddingBottom: "0.4mm",
            letterSpacing: "0.1px",
          }}
        >
          {shopName}
        </div>

        {/* Center Section: Address Left, Job Card No Right */}
        <div 
          className="flex justify-between items-start gap-1"
          style={{
            flex: 1,
            paddingTop: "0.8mm",
            paddingBottom: "0.4mm",
          }}
        >
          {/* Short Address (Left) */}
          <div 
            style={{
              fontSize: "6.5pt",
              lineHeight: "1.15",
              color: "#374151",
              maxWidth: "29mm",
              wordBreak: "break-word",
              maxHeight: "11mm",
              overflow: "hidden",
            }}
          >
            {shortAddress}
          </div>

          {/* Job Number (Right) */}
          <div 
            className="text-right flex flex-col justify-center items-end shrink-0"
            style={{
              maxWidth: "16mm",
            }}
          >
            <span style={{ fontSize: "5pt", color: "#6b7280", fontWeight: "bold" }}>JOB NO</span>
            <span 
              className="font-mono font-bold"
              style={{ 
                fontSize: "8.5pt", 
                lineHeight: "1", 
                color: "#000",
              }}
            >
              {job.job_number}
            </span>
          </div>
        </div>

        {/* Mobile Number - Bottom Centered */}
        <div 
          className="text-center font-semibold"
          style={{
            fontSize: "7pt",
            lineHeight: "1",
            paddingTop: "0.4mm",
            borderTop: "0.5px dashed #ccc",
          }}
        >
          Mob: {shopPhone}
        </div>
      </div>
    </PrintPortal>
  );
}
