"use client";

import { Calendar, Phone, DollarSign, User, ShieldCheck, AlertTriangle, ArrowRight, FileText } from "lucide-react";
import { Card, Button } from "@/components/ui";
import type { OutsourcedRepair } from "@/types";

export interface OutsourceDetailsCardProps {
  repairs: OutsourcedRepair[];
  onMarkReturned: (id: string) => void;
}

export function OutsourceDetailsCard({
  repairs,
  onMarkReturned,
}: OutsourceDetailsCardProps) {
  if (!repairs || repairs.length === 0) return null;

  // Format currency
  const formatCost = (val?: number | null) => {
    if (val === undefined || val === null) return "—";
    return `₹${Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  };

  // Format date
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-neutral-900 mb-2 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-orange-500" />
        Outsourced Repair History
      </h3>

      <div className="space-y-4">
        {repairs.map((item, index) => {
          const isSent = item.status === "SENT";
          const isReturned = item.status === "RETURNED";
          
          // Cost saving or over-budget calculation
          const hasEstimate = item.estimated_cost !== null && item.estimated_cost !== undefined;
          const hasActual = item.actual_cost !== null && item.actual_cost !== undefined;
          const costDiff = hasEstimate && hasActual ? (item.estimated_cost || 0) - (item.actual_cost || 0) : null;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-5 relative overflow-hidden transition-all hover:shadow-md ${
                isSent
                  ? "bg-orange-50/30 border-orange-200"
                  : "bg-white border-neutral-200"
              }`}
            >
              {/* Top Row: Vendor Details & Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3 mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                    {item.vendor_name}
                    {item.vendor_city && (
                      <span className="text-xs font-normal text-neutral-500">
                        ({item.vendor_city})
                      </span>
                    )}
                  </h4>
                  {item.vendor_phone && (
                    <a
                      href={`tel:${item.vendor_phone}`}
                      className="text-xs text-primary-600 hover:underline flex items-center gap-1 mt-1 font-mono"
                    >
                      <Phone className="w-3 h-3" />
                      {item.vendor_phone}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      isSent
                        ? "bg-orange-100 text-orange-800"
                        : isReturned
                        ? "bg-green-100 text-green-800"
                        : "bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    {item.status_display || item.status}
                  </span>

                  {isSent && (
                    <Button
                      size="sm"
                      onClick={() => onMarkReturned(item.id)}
                      leftIcon={<Calendar className="w-3.5 h-3.5" />}
                    >
                      Mark Returned
                    </Button>
                  )}
                </div>
              </div>

              {/* Grid: Outward details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                    Outward Details
                  </p>
                  <div className="space-y-1.5 text-neutral-700">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span>Sent: <strong>{formatDate(item.sent_date)}</strong></span>
                    </div>
                    {item.expected_return_date && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
                        <span>Expected Back: <strong>{formatDate(item.expected_return_date)}</strong></span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-neutral-400 shrink-0" />
                      <span>Sent By: {item.sent_by_name}</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                      Reason for Outsourcing
                    </p>
                    <p className="text-sm text-neutral-900 border-l-2 border-neutral-200 pl-2.5 py-0.5 leading-relaxed">
                      {item.reason}
                    </p>
                  </div>
                </div>

                {/* Right Column: Return details / costs */}
                <div className="border-t md:border-t-0 md:border-l border-neutral-100 pt-4 md:pt-0 md:pl-6">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">
                    Costs & Return Details
                  </p>
                  <div className="space-y-2 text-neutral-700">
                    <div className="flex justify-between items-center bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                      <span className="text-xs text-neutral-500">Estimate:</span>
                      <span className="font-semibold font-mono text-neutral-900">{formatCost(item.estimated_cost)}</span>
                    </div>

                    {isReturned ? (
                      <>
                        <div className="flex justify-between items-center bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                          <span className="text-xs text-neutral-500">Actual Cost:</span>
                          <span className="font-semibold font-mono text-neutral-900">{formatCost(item.actual_cost)}</span>
                        </div>

                        {costDiff !== null && (
                          <div className="text-xs text-right font-medium">
                            {costDiff > 0 ? (
                              <span className="text-green-600">Saved ₹{Number(costDiff).toFixed(2)} from estimate</span>
                            ) : costDiff < 0 ? (
                              <span className="text-red-600">Over estimate by ₹{Number(Math.abs(costDiff)).toFixed(2)}</span>
                            ) : (
                              <span className="text-neutral-500">Matches estimated cost</span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 pt-3 border-t border-dashed border-neutral-100 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500">Returned Date:</span>
                            <span className="font-medium text-neutral-900">{formatDate(item.return_date)}</span>
                          </div>
                          {item.vendor_invoice_number && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-neutral-500">Vendor Invoice No:</span>
                              <span className="font-mono font-medium text-neutral-900">{item.vendor_invoice_number}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500">Outcome:</span>
                            <span
                              className={`font-semibold ${
                                item.repair_outcome === "REPAIRED"
                                  ? "text-green-600"
                                  : item.repair_outcome === "PARTIALLY_REPAIRED"
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {item.repair_outcome_display || item.repair_outcome}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200/50 p-2.5 rounded-lg mt-2 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Awaiting vendor return</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Vendor notes (if returned) */}
              {isReturned && item.vendor_notes && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Vendor Report / Diagnosis Notes
                  </p>
                  <p className="text-sm text-neutral-700 bg-neutral-50/50 rounded-lg p-2.5 border border-neutral-100 leading-relaxed font-mono">
                    {item.vendor_notes}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
