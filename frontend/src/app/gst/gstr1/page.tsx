"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { gstApi } from "@/lib/api/services";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { FileText, Download } from "lucide-react";
import { GSTDateFilter, type DateRange } from "../GSTDateFilter";

export default function GSTR1Page() {
  const { currentBranch } = useAuth();
  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: format(startOfMonth(today), "yyyy-MM-dd"),
    to: format(endOfMonth(today), "yyyy-MM-dd"),
  });
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["gstr1", range.from, range.to, currentBranch?.id],
    queryFn: () => gstApi.getGSTR1Data({ from_date: range.from, to_date: range.to, branch: currentBranch?.id }),
  });

  const handleDownloadJSON = async () => {
    setDownloading(true);
    try {
      await gstApi.downloadGSTR1JSON({ from_date: range.from, to_date: range.to, branch: currentBranch?.id });
    } finally {
      setDownloading(false);
    }
  };

  const fmt = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" /> GSTR-1
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Outward supplies — B2B and B2CS breakdown</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <GSTDateFilter onChange={setRange} />
          <button
            onClick={handleDownloadJSON}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Generating..." : "Download JSON"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-neutral-400">Loading...</div>
      ) : data ? (
        <>
          {/* B2B Section */}
          <section>
            <h2 className="font-semibold text-neutral-800 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">B2B</span>
              B2B Invoices ({data.b2b_count} invoices — customers with GSTIN)
            </h2>
            {!data.b2b?.length ? (
              <p className="text-neutral-400 text-sm py-4">No B2B invoices in this period.</p>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {["Invoice #", "Date", "Customer", "GSTIN", "Taxable", "CGST", "SGST", "Total"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.b2b.map((inv: any) => (
                      <tr key={inv.invoice_number} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-mono text-xs">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-neutral-600">{inv.date}</td>
                        <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-500">{inv.customer_gstin}</td>
                        <td className="px-4 py-3 text-right">{fmt(inv.taxable)}</td>
                        <td className="px-4 py-3 text-right">{fmt(inv.cgst)}</td>
                        <td className="px-4 py-3 text-right">{fmt(inv.sgst)}</td>
                        <td className="px-4 py-3 text-right font-bold">{fmt(inv.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* B2CS Section */}
          <section>
            <h2 className="font-semibold text-neutral-800 mb-3 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded text-xs font-bold">B2CS</span>
              B2CS Summary (individual customers — aggregated by GST rate)
            </h2>
            {!data.b2cs?.length ? (
              <p className="text-neutral-400 text-sm py-4">No B2CS invoices in this period.</p>
            ) : (
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {["GST Rate", "Taxable Amount", "CGST", "SGST"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {data.b2cs.map((r: any) => (
                      <tr key={r.rate} className="hover:bg-neutral-50">
                        <td className="px-4 py-3 font-bold">{r.rate}%</td>
                        <td className="px-4 py-3 text-right">{fmt(r.taxable)}</td>
                        <td className="px-4 py-3 text-right text-indigo-700">{fmt(r.cgst)}</td>
                        <td className="px-4 py-3 text-right text-indigo-700">{fmt(r.sgst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
            <strong>How to use the JSON file:</strong> Click "Download JSON" → go to GST Portal → GSTR-1 → Upload → select the downloaded file. It will pre-fill all B2B and B2CS sections automatically.
          </div>
        </>
      ) : null}
    </div>
  );
}
