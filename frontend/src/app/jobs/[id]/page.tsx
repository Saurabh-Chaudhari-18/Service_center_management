"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  JobStatusBadge,
  LoadingState,
  Alert,
  Badge,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Mail,
  MapPin,
  Laptop,
  FileText,
  CheckCircle2,
  AlertCircle,
  Camera,
  Package,
  UserCheck,
  Wrench,
  History,
  Settings,
  Receipt,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { JobStatusTimeline } from "@/components/jobs/JobStatusTimeline";
import { JobAssignTechnicianModal } from "@/components/jobs/JobAssignTechnicianModal";
import { JobUpdateStatusModal } from "@/components/jobs/JobUpdateStatusModal";
import { JobDiagnosisModal } from "@/components/jobs/JobDiagnosisModal";
import { JobBrandLogo } from "@/components/jobs/JobBrandLogo";

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root">{children}</div>,
    document.body,
  );
};

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { hasPermission, isRole } = useAuth();

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // Hide print portal after printing is done
  useEffect(() => {
    const handleAfterPrint = () => setShowPrintView(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <ProtectedRoute requiredPermission="canViewJobCards">
        <AppLayout>
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error || !job) {
    return (
      <ProtectedRoute requiredPermission="canViewJobCards">
        <AppLayout>
          <div className="p-6">
            <Alert variant="error" title="Error">
              Failed to load job card details.
            </Alert>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const isTerminalStatus = ["DELIVERED", "CANCELLED", "REJECTED"].includes(
    job.status,
  );
  // Allow Owner/Manager to edit even if terminal
  const canEdit =
    (hasPermission("canEditJobCards") && !isTerminalStatus) ||
    isRole("OWNER", "SUPER_ADMIN", "MANAGER");

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={job.job_number}
          subtitle={`${job.brand} ${job.model}`}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  setShowPrintView(true);
                  setTimeout(() => window.print(), 500);
                }}
              >
                Print Job Card
              </Button>
              {isRole("OWNER", "SUPER_ADMIN") && (
                <Link href={`/jobs/${jobId}/edit`}>
                  <Button
                    variant="secondary"
                    leftIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit Job
                  </Button>
                </Link>
              )}
              <Link href="/jobs">
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Jobs
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6">
          {/* Status Bar */}
          <Card padding="md" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <JobStatusBadge status={job.status} />
                {job.is_urgent && <Badge variant="danger">URGENT</Badge>}
                {job.is_warranty_repair && (
                  <Badge variant="info">Warranty Repair</Badge>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Invoice Button - Always visible for valid statuses */}
                {[
                  "APPROVED",
                  "REPAIR_IN_PROGRESS",
                  "READY_FOR_DELIVERY",
                  "DELIVERED",
                ].includes(job.status) && (
                  <Link href={`/billing/new?jobId=${job.id}`}>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Receipt className="w-4 h-4" />}
                    >
                      Create Invoice
                    </Button>
                  </Link>
                )}
                {(job.status === "RECEIVED" ||
                  (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
                  isRole("OWNER", "SUPER_ADMIN", "MANAGER") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<UserCheck className="w-4 h-4" />}
                      onClick={() => setShowAssignModal(true)}
                    >
                      Assign Technician
                    </Button>
                  )}

                {(job.status === "DIAGNOSIS" ||
                  (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
                  (isRole("TECHNICIAN") ||
                    hasPermission("canEditJobCards") ||
                    isRole("OWNER", "SUPER_ADMIN")) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Wrench className="w-4 h-4" />}
                      onClick={() => setShowDiagnosisModal(true)}
                    >
                      Add Diagnosis
                    </Button>
                  )}

                {canEdit && (
                  <Button
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setShowStatusModal(true)}
                  >
                    Update Status
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-500" />
                    Customer Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Customer Name
                      </p>
                      <p className="font-semibold text-neutral-900 text-lg">
                        {job.customer?.first_name} {job.customer?.last_name}
                      </p>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Mobile Number
                      </p>
                      <p className="font-medium text-neutral-900 font-mono">
                        {job.customer?.mobile}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Email Address
                      </p>
                      <p className="font-medium text-neutral-900 break-all">
                        {job.customer?.email || (
                          <span className="text-neutral-400 italic">
                            Not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">Location</p>
                      <p className="font-medium text-neutral-900">
                        {job.customer?.city ? (
                          `${job.customer.city}${
                            job.customer.state ? `, ${job.customer.state}` : ""
                          }`
                        ) : (
                          <span className="text-neutral-400 italic">
                            Not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Device Information */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-primary-500" />
                  Device Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Device Type</p>
                    <p className="font-medium text-neutral-900 capitalize">
                      {job.device_type?.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Brand & Model</p>
                    <p className="font-medium text-neutral-900">
                      {job.brand} {job.model}
                    </p>
                  </div>
                  {job.serial_number && (
                    <div>
                      <p className="text-sm text-neutral-500">Serial Number</p>
                      <p className="font-mono text-sm text-neutral-900">
                        {job.serial_number}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Problem & Diagnosis */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  Problem Description
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 mb-1">
                      Customer Complaint
                    </p>
                    <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                      {job.customer_complaint}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-neutral-500 mb-1">
                      Physical Condition
                    </p>
                    <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                      {(job as any).physical_condition_display ||
                        "Not documented"}
                    </p>
                  </div>

                  {(job as any).engineer_diagnosis_display && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-1">
                        Engineer Diagnosis
                      </p>
                      <p className="text-neutral-900 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        {(job as any).engineer_diagnosis_display}
                      </p>
                    </div>
                  )}

                  {job.diagnosis_notes && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-1">
                        Diagnosis Notes
                      </p>
                      <p className="text-neutral-900 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        {job.diagnosis_notes}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Diagnosis Parts Display */}
              {job.diagnosis_parts && job.diagnosis_parts.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary-500" />
                    Spare Parts Required
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-2 border-b flex gap-4 text-sm font-medium text-neutral-500 text-xs uppercase tracking-wider">
                      <div className="flex-1">Part Name</div>
                      <div className="w-24 text-right">Price</div>
                      <div className="w-16 text-center">Qty</div>
                      <div className="w-24">Warranty</div>
                      <div className="w-24 text-right">Total</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {job.diagnosis_parts.map((part) => (
                        <div
                          key={part.id}
                          className="px-4 py-2 flex gap-4 text-sm text-neutral-900 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="flex-1 font-medium">{part.name}</div>
                          <div className="w-24 text-right font-mono text-neutral-600">
                            ₹{Number(part.price).toFixed(2)}
                          </div>
                          <div className="w-16 text-center">
                            {part.quantity}
                          </div>
                          <div className="w-24 text-neutral-600">
                            {part.warranty_months
                              ? `${part.warranty_months} Months`
                              : "-"}
                          </div>
                          <div className="w-24 text-right font-mono font-medium">
                            ₹{(Number(part.price) * part.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-neutral-50 px-4 py-3 flex justify-end gap-3 border-t">
                      <span className="text-sm font-medium text-neutral-600">
                        Total Parts Cost:
                      </span>
                      <span className="text-sm font-bold text-green-600 font-mono text-base">
                        ₹{Number(job.total_parts_cost || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Accessories */}
              {job.accessories && job.accessories.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-500" />
                    Accessories Received
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {job.accessories.map((acc) => (
                      <div
                        key={acc.id}
                        className={`p-3 rounded-lg border ${
                          acc.is_present
                            ? "bg-green-50 border-green-200"
                            : "bg-neutral-50 border-neutral-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {acc.is_present ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-neutral-400" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {acc.accessory_type.toLowerCase().replace("_", " ")}
                          </span>
                        </div>
                        {acc.condition && (
                          <p className="text-xs text-neutral-500 mt-1 ml-6">
                            {acc.condition}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Job Details */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Job Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Job Number</span>
                    <span className="font-mono text-sm font-medium">
                      {job.job_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Created</span>
                    <span className="text-sm">
                      {format(new Date(job.created_at), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">
                      Received By
                    </span>
                    <span className="text-sm">
                      {job.received_by_name || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Technician</span>
                    <span className="text-sm">
                      {job.assigned_technician_name || "Not assigned"}
                    </span>
                  </div>
                  {job.estimated_cost && (
                    <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                      <span className="text-sm text-neutral-500">
                        Estimated Cost
                      </span>
                      <span className="text-sm font-medium text-green-600">
                        ₹{job.estimated_cost.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                  {job.estimated_completion_date && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-neutral-500">
                        Est. Completion
                      </span>
                      <span className="text-sm">
                        {format(
                          new Date(job.estimated_completion_date),
                          "MMM dd, yyyy",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Status History */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary-500" />
                  Status History
                </h3>
                <JobStatusTimeline history={job.status_history || []} />
              </Card>

              {/* Intake Photos */}
              {job.photos && job.photos.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary-500" />
                    Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {job.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block aspect-square rounded-xl bg-neutral-100 overflow-hidden relative border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photo}
                          alt={photo.description || "Job photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {photo.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-xs text-white truncate">
                              {photo.description}
                            </p>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <JobAssignTechnicianModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          jobId={jobId}
          branchId={job.branch}
        />
        <JobUpdateStatusModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          jobId={jobId}
          currentStatus={job.status}
        />
        <JobDiagnosisModal
          isOpen={showDiagnosisModal}
          onClose={() => setShowDiagnosisModal(false)}
          jobId={jobId}
          initialData={job}
        />

        {/* PRINT-ONLY: Job Card Printable Template */}
        {showPrintView && (
          <PrintPortal>
            <div className="bg-white p-6 text-[10pt] leading-[1.3] text-black h-screen flex flex-col justify-between">
              <div className="space-y-3">
                {/* Shop Header */}
                <div className="print-section border-2 border-black p-2 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-4 items-center">
                      <JobBrandLogo brand="HP" />
                      <JobBrandLogo brand="DELL" />
                      <JobBrandLogo brand="ASUS" />
                      <JobBrandLogo brand="LENOVO" />
                    </div>
                    <div className="text-right">
                      <h1 className="text-2xl font-bold uppercase tracking-wider">
                        SHIVANGI INFOTECH
                      </h1>
                      <p className="text-[10pt] font-semibold">
                        HP | DELL | ASUS Authorised Partner
                      </p>
                    </div>
                  </div>
                  <div className="text-center mt-2 pt-2 border-t-2 border-black">
                    <p className="text-[10pt] font-medium">
                      Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa
                      Showroom, Pune-411038
                    </p>
                    <p className="text-[10pt] font-bold mt-1">
                      Mobile: 9890888295, 9850292673
                    </p>
                  </div>
                  <div className="text-center mt-2 pt-2 border-t-2 border-black">
                    <p className="font-bold text-lg uppercase tracking-wide">
                      JOB CARD: {job.job_number}
                    </p>
                    <p className="text-[11pt] font-medium">
                      Date: {format(new Date(job.created_at), "dd MMM yyyy")}
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
                        <b>Mobile:</b> {job.customer?.mobile}
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
                      <p className="text-neutral-400">
                        No accessories submitted
                      </p>
                    )}
                    <p>
                      <b>Physical Condition:</b>{" "}
                      {(job as any).physical_condition_display ||
                        "Not documented"}
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
                    TERMS & CONDITIONS
                  </p>
                  <div className="space-y-2 text-[9pt] leading-[1.4] text-justify">
                    <p>
                      <b>1. Condition:</b> In case of hard disk failure,
                      formatting may be required which may lead to data loss.
                      Customers are advised to backup important data. Only
                      recommended OS with drivers will be installed.
                      Physical/water/burn damage not covered under warranty. For
                      warranty claims, provide purchase invoice. Defective parts
                      not returned. Product may become non-functional during
                      repair - we will not be responsible.
                    </p>
                    <p>
                      <b>2. Note:</b> Customer must confirm repair within 48
                      hours of estimate, else repair will proceed automatically.
                      Defective parts not returned. Complaints must be reported
                      within 24 hours of delivery. Collect product within 45
                      days or it will be scrapped. After 45 days, ₹500/month
                      handling charge applies.
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
                        I hereby authorize Shivangi Infotech to provide
                        necessary repair & service. I have taken backup of all
                        important data.
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
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
