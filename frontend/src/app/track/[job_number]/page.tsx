"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { Wrench, Phone, AlertCircle, FileText, MapPin, Camera, RotateCcw, ImageOff } from "lucide-react";
import { Button, Input, Textarea } from "@/components/ui";
import { JOB_STATUS_CONFIG, JobStatus } from "@/types";
import { formatDateLong, formatDateTime } from "@/lib/formatters";
import { API_BASE_URL } from "@/lib/api";

interface TimelineItem {
  status: JobStatus;
  status_display: string;
  timestamp: string;
}

interface PhotoItem {
  url: string;
  type: string;
  description: string;
}

interface TrackingData {
  job_number: string;
  device_type: string;
  brand: string;
  model: string;
  customer_complaint: string;
  current_status: JobStatus;
  current_status_display: string;
  estimated_cost: number | null;
  estimated_completion_date: string | null;
  customer_response_allowed: boolean;
  customer_approval_date: string | null;
  customer_rejection_reason: string;
  timeline: TimelineItem[];
  photos: PhotoItem[];
}

export default function TrackJobPage() {
  const params = useParams();
  const jobNumber = params.job_number as string;

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingData | null>(null);
  const [responsePending, setResponsePending] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [responseMessage, setResponseMessage] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }
    if (!pin || pin.replace(/\D/g, "").length !== 4) {
      setError("Please enter your 4-digit PIN from SMS.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const qp = new URLSearchParams({
        phone: digits.slice(-10),
        pin: pin.replace(/\D/g, "").slice(0, 4),
      });
      const res = await fetch(`${API_BASE_URL}/jobs/public/track/${jobNumber}/?${qp.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            "Could not find job with provided details. Please check your phone number and PIN.",
        );
      }
      
      const responseData: TrackingData = await res.json();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setPhone("");
    setPin("");
    setError(null);
  };

  const respondToEstimate = async (approved: boolean) => {
    if (!approved && !rejectionReason.trim()) {
      setError("Please tell the service center why you are declining the estimate.");
      return;
    }
    setResponsePending(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/jobs/public/track/${jobNumber}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, "").slice(-10), pin, approved, rejection_reason: rejectionReason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not record your response.");
      setResponseMessage(payload.message);
      setData(current => current ? { ...current, current_status: payload.status, current_status_display: payload.status, customer_response_allowed: false } : current);
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : "Could not record your response.");
    } finally {
      setResponsePending(false);
    }
  };

  const getStatusColor = (status: JobStatus) => {
    return JOB_STATUS_CONFIG[status]?.color || "bg-neutral-100 text-neutral-800 border-neutral-200";
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 py-12">
      {/* Background Pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-500/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent-500/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg mb-4 text-primary-600">
            <Wrench className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">Track Your Service</h1>
          <p className="text-neutral-600 mt-2">
            Stay updated on the status of your repair job.
          </p>
        </div>

        {!data ? (
          /* Authentication Card */
          <div className="bg-white rounded-2xl p-8 shadow-xl max-w-md mx-auto border border-neutral-100">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-neutral-900 mb-1">Verify Identity</h2>
              <p className="text-sm text-neutral-500">
                Job Number: <span className="font-mono font-medium text-neutral-900">{jobNumber}</span>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <Input
                label="Registered Phone Number"
                type="tel"
                placeholder="Enter last 10 digits"
                leftIcon={<Phone className="w-5 h-5" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />

              <Input
                label="4-Digit PIN"
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="PIN from your SMS"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                required
              />

              <p className="text-xs text-neutral-400 mt-[-8px]">
                PIN was sent via SMS when your device was registered. Contact the
                service center if you don&apos;t have it.
              </p>

              <Button
                type="submit"
                className="w-full h-12"
                isLoading={isVerifying}
              >
                View Status
              </Button>
            </form>
          </div>
        ) : (
          /* Tracking Information */
          <div className="space-y-6">
            {data.customer_response_allowed && (
              <div className="rounded-2xl border border-primary-200 bg-white p-6 shadow-xl">
                <h2 className="text-lg font-semibold text-neutral-900">Approve repair estimate</h2>
                <p className="mt-1 text-sm text-neutral-600">The service center has shared an estimate of <strong>₹{Number(data.estimated_cost || 0).toLocaleString("en-IN")}</strong>. Approve it to begin repair, or decline with a reason.</p>
                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                <div className="mt-4"><Textarea label="Reason if declining" value={rejectionReason} onChange={event => setRejectionReason(event.target.value)} /></div>
                <div className="mt-4 flex flex-wrap gap-3"><Button isLoading={responsePending} onClick={() => respondToEstimate(true)}>Approve estimate</Button><Button variant="secondary" disabled={responsePending} onClick={() => respondToEstimate(false)}>Decline estimate</Button></div>
              </div>
            )}
            {responseMessage && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{responseMessage}</div>}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100">
              {/* Header Status Bar */}
              <div className="border-b border-neutral-100 p-6 bg-gradient-to-r from-neutral-50 to-white">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold font-mono text-neutral-900 mb-2">{data.job_number}</h2>
                    <div className="flex items-center gap-2 text-neutral-600">
                      <span className="font-medium">{data.brand}</span>
                      <span>•</span>
                      <span>{data.model}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-neutral-500 block mb-1">Current Status</span>
                    <span className={`px-4 py-2 rounded-full text-sm font-medium border ${getStatusColor(data.current_status)}`}>
                      {JOB_STATUS_CONFIG[data.current_status]?.label || data.current_status_display}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details & Info */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-neutral-400" /> Device Info
                  </h3>
                  <dl className="space-y-3 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-neutral-500">Device Type:</dt>
                      <dd className="col-span-2 font-medium text-neutral-900">{data.device_type}</dd>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <dt className="text-neutral-500">Complaint:</dt>
                      <dd className="col-span-2 font-medium text-neutral-900">{data.customer_complaint}</dd>
                    </div>
                    {data.estimated_cost && (
                      <div className="grid grid-cols-3 gap-2">
                        <dt className="text-neutral-500">Est. Cost:</dt>
                        <dd className="col-span-2 font-semibold text-neutral-900">₹{data.estimated_cost}</dd>
                      </div>
                    )}
                    {data.estimated_completion_date && (
                      <div className="grid grid-cols-3 gap-2">
                        <dt className="text-neutral-500">Est. Ready by:</dt>
                        <dd className="col-span-2 font-medium text-neutral-900">
                          {formatDateLong(data.estimated_completion_date)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-neutral-400" /> Status Timeline
                  </h3>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-neutral-200 before:to-transparent">
                    {data.timeline.map((item, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white bg-primary-100 text-primary-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                           <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                        </div>
                        <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2rem)] p-3 rounded-lg border border-neutral-100 bg-neutral-50/50 shadow-sm">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm text-neutral-900">{JOB_STATUS_CONFIG[item.status]?.label || item.status_display}</span>
                            <span className="text-xs text-neutral-500 mt-1">{formatDateTime(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {data.timeline.length === 0 && (
                      <p className="text-sm text-neutral-500 text-center relative z-10 w-full py-4">
                        No recent updates
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Photos Section */}
            {data.photos && data.photos.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100 p-6">
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-neutral-400" /> Diagnosis Evidence
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {data.photos.map((photo, idx) => (
                    <div key={idx} className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 block">
                       <div className="aspect-[4/3] bg-neutral-100 relative">
                         {/* eslint-disable-next-line @next/next/no-img-element */}
                         <img
                           src={photo.url}
                           alt={photo.description || "Diagnosis photo"}
                           className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                           onError={(e) => {
                             const target = e.currentTarget;
                             target.style.display = "none";
                             const fallback = target.nextElementSibling as HTMLElement | null;
                             if (fallback) fallback.style.display = "flex";
                           }}
                         />
                         <div className="absolute inset-0 hidden flex-col items-center justify-center gap-2 text-neutral-400">
                           <ImageOff className="w-8 h-8" />
                           <span className="text-xs">Image unavailable</span>
                         </div>
                       </div>
                       {photo.description && (
                         <div className="p-3 bg-white border-t border-neutral-100">
                           <p className="text-sm text-neutral-700 clamp-2">
                             {photo.description}
                           </p>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Reset Button */}
          <div className="flex justify-center mt-4">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors px-4 py-2 rounded-lg hover:bg-neutral-100"
            >
              <RotateCcw className="w-4 h-4" />
              Check another job
            </button>
          </div>
          </div>
        )}

        <div className="mt-8 text-center">
            <p className="text-sm text-neutral-500 mb-2">Powered by ServiceHub</p>
        </div>
      </div>
    </div>
  );
}
