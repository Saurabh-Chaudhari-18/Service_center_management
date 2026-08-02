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
  // Shop name (consistent with job card print name resolution)
  const shopName = branchDetails?.name || branchDetails?.organization_name || "SHIVANGI INFOTECH";
  
  // Skip address_line1 (society name, shop numbers) to prevent clutter,
  // prioritize address_line2 (street/area) and city.
  const addressParts = [];
  if (branchDetails?.address_line2) {
    addressParts.push(branchDetails.address_line2);
  } else if (branchDetails?.address_line1) {
    // If address_line2 is empty, fall back to line 1 but keep it clean
    addressParts.push(branchDetails.address_line1.split(",")[0]);
  }
  addressParts.push(branchDetails?.city || "Pune");
  const shortAddress = addressParts.filter(Boolean).join(", ");

  // Shop/Branch Phone
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
              /* Force exactly 50mm x 25mm label dimensions */
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
              /* Hide standard web app elements */
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
      
      {/* Sticker main frame */}
      <div 
        className="bg-white text-black box-border overflow-hidden select-none"
        style={{
          width: "50mm",
          height: "25mm",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          border: "1px solid #e5e7eb", /* Screen-only boundary indicator, prints transparently */
        }}
      >
        {/* TOP BAND: Navy/Indigo gradient */}
        <div 
          style={{
            background: "linear-gradient(to right, #1e1b4b, #312e81)",
            padding: "1.2mm 1.5mm 1mm 1.5mm",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            minHeight: "8.5mm",
          }}
        >
          <div 
            className="font-extrabold uppercase truncate w-full"
            style={{
              fontSize: "8.5pt",
              lineHeight: "1.1",
              letterSpacing: "0.2px",
            }}
          >
            💻 {shopName}
          </div>
          <div 
            className="uppercase truncate w-full font-semibold"
            style={{
              fontSize: "4.5pt",
              lineHeight: "1.1",
              color: "#fbbf24",
              marginTop: "0.2mm",
              letterSpacing: "0.3px",
            }}
          >
            HP | DELL | ASUS Authorised Service Partner
          </div>
        </div>

        {/* MIDDLE SECTION: White background */}
        <div 
          style={{
            flex: 1,
            backgroundColor: "white",
            padding: "0.8mm 1.5mm 0.8mm 1.5mm",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "stretch",
            gap: "1.5mm",
          }}
        >
          {/* Address (Left Column) */}
          <div 
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flex: 1,
              maxWidth: "28mm",
            }}
          >
            <span 
              style={{ 
                fontSize: "4.5pt", 
                fontWeight: "bold", 
                color: "#6b7280", 
                letterSpacing: "0.2px",
                marginBottom: "0.3mm" 
              }}
            >
              ADDRESS
            </span>
            <span 
              className="truncate"
              style={{
                fontSize: "6.5pt",
                fontWeight: "600",
                lineHeight: "1.1",
                color: "#374151",
              }}
            >
              {shortAddress}
            </span>
          </div>

          {/* Job Number (Right Column) */}
          <div 
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-end",
              textAlign: "right",
              borderLeft: "0.5px solid #e5e7eb",
              paddingLeft: "1.5mm",
              flexShrink: 0,
            }}
          >
            <span 
              style={{ 
                fontSize: "4.5pt", 
                fontWeight: "bold", 
                color: "#ef4444", 
                letterSpacing: "0.2px",
                marginBottom: "0.3mm" 
              }}
            >
              JOB CARD
            </span>
            <span 
              className="font-mono font-bold"
              style={{ 
                fontSize: "7.5pt", 
                lineHeight: "1", 
                color: "#111827",
              }}
            >
              {job.job_number}
            </span>
          </div>
        </div>

        {/* BOTTOM STRIP: Vibrant red gradient */}
        <div 
          style={{
            background: "linear-gradient(to right, #dc2626, #991b1b)",
            padding: "0.8mm 1.5mm",
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "white",
            minHeight: "5.5mm",
          }}
        >
          <span 
            style={{
              fontSize: "7.5pt",
              fontWeight: "bold",
              letterSpacing: "0.5px",
              lineHeight: "1",
            }}
          >
            📞 {shopPhone}
          </span>
        </div>
      </div>
    </PrintPortal>
  );
}
