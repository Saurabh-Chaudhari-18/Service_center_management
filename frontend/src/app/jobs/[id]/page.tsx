"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Branch } from "@/types";
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
  Phone,
  Laptop,
  FileText,
  CheckCircle2,
  AlertCircle,
  Camera,
  Package,
  UserCheck,
  Wrench,
  Settings,
  Receipt,
  Printer,
  MoreVertical,
  Copy,
  Truck,
  Send,
  MessageCircleQuestion,
} from "lucide-react";
import Link from "next/link";
import { formatDateLong, formatPhone } from "@/lib/formatters";
import { JobAssignTechnicianModal } from "@/components/jobs/JobAssignTechnicianModal";
import { JobUpdateStatusModal } from "@/components/jobs/JobUpdateStatusModal";
import { JobDiagnosisModal } from "@/components/jobs/JobDiagnosisModal";
import { JobDeliveryModal } from "@/components/jobs/JobDeliveryModal";
import { JobCardPrintTemplate } from "@/components/jobs/JobCardPrintTemplate";
import { JobCardStickerTemplate } from "@/components/jobs/JobCardStickerTemplate";

import { JobStatusHistoryCard } from "@/components/jobs/JobStatusHistoryCard";
import { OutsourceRepairModal } from "@/components/jobs/OutsourceRepairModal";
import { OutsourceReturnModal } from "@/components/jobs/OutsourceReturnModal";
import { OutsourceDetailsCard } from "@/components/jobs/OutsourceDetailsCard";
import { useToast } from "@/context/ToastContext";
import { JobCustomerResponseModal } from "@/components/jobs/JobCustomerResponseModal";

// =====================================================
// MoreMenu — overflow action dropdown
// =====================================================

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

function MoreMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;

  return (
    <div className="relative">
      <Button
        variant="secondary"
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-4 h-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[11rem] rounded-xl border border-neutral-200 bg-white shadow-lg py-1 overflow-hidden">
            {actions.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <span className="text-neutral-400">{item.icon}</span>
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  <span className="text-neutral-400">{item.icon}</span>
                  {item.label}
                </button>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// InfoField — flat label/value display
// =====================================================

function InfoField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className={`text-sm text-neutral-900${mono ? " font-mono" : ""}`}>
        {value}
      </p>
    </div>
  );
}

// =====================================================
// DetailRow — sidebar metadata list item
// =====================================================

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 last:border-0">
      <span className="text-xs text-neutral-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-right text-neutral-900">{value}</span>
    </div>
  );
}

// =====================================================
// Main Job Detail Page
// =====================================================

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { hasPermission, isRole, accessibleBranches, currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showOutsourceModal, setShowOutsourceModal] = useState(false);
  const [showOutsourceReturnModal, setShowOutsourceReturnModal] = useState(false);
  const [showCustomerResponseModal, setShowCustomerResponseModal] = useState(false);
  const [activeOutsourceId, setActiveOutsourceId] = useState("");
  const [showPrintView, setShowPrintView] = useState(false);
  const [showStickerPrintView, setShowStickerPrintView] = useState(false);
  const [selectedPrintBranch, setSelectedPrintBranch] = useState<Branch | null>(null);
  const [selectedPrintCustomName, setSelectedPrintCustomName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleAfterPrint = () => {
      setShowPrintView(false);
      setShowStickerPrintView(false);
    };
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

  const shareEstimateMutation = useMutation({
    mutationFn: () => jobsApi.shareEstimate(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success("Estimate shared with the customer.");
    },
    onError: (mutationError: Error) => toast.error(mutationError.message || "Could not share the estimate."),
  });

  if (isLoading) {
    return (
      <ProtectedRoute requiredPermission="canViewJobCards">
        <AppLayout>
          <LoadingState message="Loading job card…" />
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

  // ── Permissions ─────────────────────────────────────────────────
  const isTerminalStatus = ["DELIVERED", "CANCELLED", "REJECTED"].includes(
    job.status,
  );
  const canEdit =
    (hasPermission("canEditJobCards") && !isTerminalStatus) ||
    isRole("OWNER", "SUPER_ADMIN", "MANAGER");

  // ── Action visibility ────────────────────────────────────────────
  const showDeliver =
    job.status === "READY_FOR_DELIVERY" && hasPermission("canEditJobCards");
  const showUpdateStatus = canEdit;
  const showInvoice = [
    "APPROVED",
    "REPAIR_IN_PROGRESS",
    "READY_FOR_DELIVERY",
    "DELIVERED",
  ].includes(job.status);
  const showAssign =
    (job.status === "RECEIVED" ||
      (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
    isRole("OWNER", "SUPER_ADMIN", "MANAGER");
  const showDiagnosis =
    (job.status === "DIAGNOSIS" ||
      (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
    (isRole("TECHNICIAN") ||
      hasPermission("canEditJobCards") ||
      isRole("OWNER", "SUPER_ADMIN"));
  const showOutsource =
    ["DIAGNOSIS", "APPROVED", "WAITING_FOR_PARTS", "REPAIR_IN_PROGRESS"].includes(job.status) &&
    canEdit && isRole("OWNER", "MANAGER");
  const canManageCustomerApproval = isRole("OWNER", "MANAGER", "RECEPTIONIST");
  const showShareEstimate =
    job.status === "DIAGNOSIS" && Boolean(job.estimated_cost) && canManageCustomerApproval;
  const showRecordResponse =
    job.status === "ESTIMATE_SHARED" && canManageCustomerApproval;
  const hasAnyAction =
    showDeliver ||
    showUpdateStatus ||
    showInvoice ||
    showAssign ||
    showDiagnosis ||
    showOutsource ||
    showShareEstimate ||
    showRecordResponse;

  // ── Handlers ────────────────────────────────────────────────────
  const handlePrint = (selectedBranch: Branch | null, customName?: string) => {
    setSelectedPrintBranch(selectedBranch);
    setSelectedPrintCustomName(customName);
    setShowPrintView(true);
    setTimeout(() => window.print(), 500);
  };

  const handlePrintSticker = (selectedBranch: Branch | null) => {
    setSelectedPrintBranch(selectedBranch);
    setShowStickerPrintView(true);
    setTimeout(() => window.print(), 500);
  };

  const handleCopyPin = () => {
    if (job.tracking_pin) {
      navigator.clipboard.writeText(job.tracking_pin);
      toast.success("Tracking PIN copied");
    }
  };

  // ── Header overflow menu ─────────────────────────────────────────
  const moreMenuActions: MenuAction[] = [];
  if (isRole("OWNER", "SUPER_ADMIN")) {
    moreMenuActions.push({
      label: "Edit Job",
      icon: <Edit className="w-4 h-4" />,
      href: `/jobs/${jobId}/edit`,
    });
  }
  moreMenuActions.push({
    label: "Print Job Card",
    icon: <Printer className="w-4 h-4" />,
    onClick: () => {
      const activeBranch = currentBranch || accessibleBranches.find((b) => b.id === job.branch) || null;
      handlePrint(activeBranch);
    },
  });
  moreMenuActions.push({
    label: "Print Sticker (50x25mm)",
    icon: <Printer className="w-4 h-4 text-emerald-600" />,
    onClick: () => {
      const activeBranch = currentBranch || accessibleBranches.find((b) => b.id === job.branch) || null;
      handlePrintSticker(activeBranch);
    },
  });

  // ── Header primary action ────────────────────────────────────────
  const headerPrimaryAction = showDeliver ? (
    <Button
      onClick={() => setShowDeliveryModal(true)}
      leftIcon={<CheckCircle2 className="w-4 h-4" />}
    >
      Deliver Device
    </Button>
  ) : showUpdateStatus ? (
    <Button
      onClick={() => setShowStatusModal(true)}
      leftIcon={<Settings className="w-4 h-4" />}
    >
      Update Status
    </Button>
  ) : null;

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={job.job_number}
          subtitle={`${job.brand} ${job.model}`}
          breadcrumbs={[
            { label: "Job Cards", href: "/jobs" },
            { label: job.job_number },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => router.push("/jobs")}
              >
                Jobs
              </Button>
              {headerPrimaryAction}
              <MoreMenu actions={moreMenuActions} />
            </div>
          }
        />

        <div className="px-4 py-6 lg:px-6">
          {/* Status strip */}
          <div className="flex items-center gap-2.5 flex-wrap mb-6">
            <JobStatusBadge status={job.status} />
            {job.is_urgent && <Badge variant="danger">URGENT</Badge>}
            {job.is_warranty_repair && (
              <Badge variant="info">Warranty Repair</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main content (2 cols) ──────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField
                    label="Customer Name"
                    value={
                      `${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim() ||
                      "—"
                    }
                  />
                  <InfoField
                    label="Mobile Number"
                    value={
                      job.customer?.mobile ? (
                        <a
                          href={`tel:${job.customer.mobile}`}
                          className="text-primary-600 hover:text-primary-700 font-mono flex items-center gap-1.5 group w-fit"
                        >
                          {formatPhone(job.customer.mobile)}
                          <span className="text-xs text-neutral-400 group-hover:text-primary-500 flex items-center gap-0.5">
                            <Phone className="w-3 h-3" /> Call
                          </span>
                        </a>
                      ) : (
                        <span className="text-neutral-400 italic">
                          Not provided
                        </span>
                      )
                    }
                  />
                  <InfoField
                    label="Email Address"
                    value={
                      job.customer?.email || (
                        <span className="text-neutral-400 italic">
                          Not provided
                        </span>
                      )
                    }
                  />
                  <InfoField
                    label="Location"
                    value={
                      job.customer?.city ? (
                        `${job.customer.city}${job.customer.state ? `, ${job.customer.state}` : ""}`
                      ) : (
                        <span className="text-neutral-400 italic">
                          Not provided
                        </span>
                      )
                    }
                  />
                </div>
              </Card>

              {/* Device Information */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-neutral-400" />
                  Device Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <InfoField
                    label="Device Type"
                    value={
                      job.device_type?.toLowerCase().replace("_", " ") || "—"
                    }
                  />
                  <InfoField
                    label="Brand & Model"
                    value={`${job.brand} ${job.model}`}
                  />
                  {job.serial_number && (
                    <InfoField
                      label="Serial Number"
                      value={job.serial_number}
                      mono
                    />
                  )}
                </div>
              </Card>

              {/* Problem Description */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-neutral-400" />
                  Problem Description
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      Customer Complaint
                    </p>
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 border-l-2 border-neutral-200 dark:border-neutral-600 pl-3 py-0.5 leading-relaxed">
                      {job.customer_complaint}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      Physical Condition
                    </p>
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 border-l-2 border-neutral-200 dark:border-neutral-600 pl-3 py-0.5 leading-relaxed">
                      {(job as any).physical_condition_display ||
                        "Not documented"}
                    </p>
                  </div>
                  {(job as any).engineer_diagnosis_display && (
                    <div>
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                        Engineer Diagnosis
                      </p>
                      <p className="text-sm text-neutral-900 dark:text-neutral-100 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-0.5 leading-relaxed">
                        {(job as any).engineer_diagnosis_display}
                      </p>
                    </div>
                  )}
                  {job.diagnosis_notes && (
                    <div>
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                        Diagnosis Notes
                      </p>
                      <p className="text-sm text-neutral-900 dark:text-neutral-100 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-0.5 leading-relaxed">
                        {job.diagnosis_notes}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Outsource History Details */}
              {job.outsourced_repairs && job.outsourced_repairs.length > 0 && (
                <OutsourceDetailsCard
                  repairs={job.outsourced_repairs}
                  onMarkReturned={(outsourceId) => {
                    setActiveOutsourceId(outsourceId);
                    setShowOutsourceReturnModal(true);
                  }}
                />
              )}

              {/* Spare Parts Required */}
              {job.diagnosis_parts && job.diagnosis_parts.length > 0 && (
                <Card>
                  <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-neutral-400" />
                    Spare Parts Required
                  </h3>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-2 border-b flex gap-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                      <div className="flex-1">Part Name</div>
                      <div className="w-24 text-right">Price</div>
                      <div className="w-16 text-center">Qty</div>
                      <div className="w-24">Warranty</div>
                      <div className="w-24 text-right">Total</div>
                    </div>
                    <div className="divide-y divide-neutral-100">
                      {job.diagnosis_parts.map((part) => (
                        <div
                          key={part.id}
                          className="px-4 py-2.5 flex gap-4 text-sm text-neutral-900 hover:bg-neutral-50/50 transition-colors"
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
                              ? `${part.warranty_months}mo`
                              : "—"}
                          </div>
                          <div className="w-24 text-right font-mono font-medium">
                            ₹
                            {(Number(part.price) * part.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-neutral-50 px-4 py-3 flex justify-end gap-3 border-t">
                      <span className="text-sm text-neutral-500">
                        Total Parts Cost:
                      </span>
                      <span className="text-sm font-bold font-mono text-neutral-900">
                        ₹{Number(job.total_parts_cost || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Accessories Received */}
              {job.accessories && job.accessories.length > 0 && (
                <Card>
                  <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Package className="w-4 h-4 text-neutral-400" />
                    Accessories Received
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-neutral-400 flex-shrink-0" />
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

            {/* ── Sidebar (1 col) ──────────────────────────────── */}
            <div className="space-y-6">
              {/* 1. Actions */}
              {hasAnyAction && (
                <Card>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                    Actions
                  </h3>
                  <div className="space-y-2">
                    {showDeliver && (
                      <Button
                        className="w-full justify-start"
                        onClick={() => setShowDeliveryModal(true)}
                        leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      >
                        Deliver Device
                      </Button>
                    )}
                    {showUpdateStatus && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => setShowStatusModal(true)}
                        leftIcon={<Settings className="w-4 h-4" />}
                      >
                        Update Status
                      </Button>
                    )}
                    {showInvoice && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        leftIcon={<Receipt className="w-4 h-4" />}
                        onClick={() => router.push(`/billing/new?jobId=${job.id}`)}
                      >
                        Create Invoice
                      </Button>
                    )}
                    {showAssign && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => setShowAssignModal(true)}
                        leftIcon={<UserCheck className="w-4 h-4" />}
                      >
                        {job.assigned_technician_name
                          ? "Reassign Technician"
                          : "Assign Technician"}
                      </Button>
                    )}
                    {showDiagnosis && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => setShowDiagnosisModal(true)}
                        leftIcon={<Wrench className="w-4 h-4" />}
                      >
                        Add Diagnosis
                      </Button>
                    )}
                    {showShareEstimate && (
                      <Button
                        className="w-full justify-start"
                        onClick={() => shareEstimateMutation.mutate()}
                        isLoading={shareEstimateMutation.isPending}
                        leftIcon={<Send className="h-4 w-4" />}
                      >
                        Share Estimate
                      </Button>
                    )}
                    {showRecordResponse && (
                      <Button
                        className="w-full justify-start"
                        onClick={() => setShowCustomerResponseModal(true)}
                        leftIcon={<MessageCircleQuestion className="h-4 w-4" />}
                      >
                        Record Customer Response
                      </Button>
                    )}
                    {showOutsource && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => setShowOutsourceModal(true)}
                        leftIcon={<Truck className="w-4 h-4 text-orange-500" />}
                      >
                        Outsource Repair
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {/* 2. Status History */}
              <JobStatusHistoryCard statusHistory={job.status_history} />

              {/* 3. Job Details */}
              <Card>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-4">
                  Job Details
                </h3>
                <div>
                  <DetailRow
                    label="Job Number"
                    value={
                      <span className="font-mono">{job.job_number}</span>
                    }
                  />
                  <DetailRow
                    label="Received Date"
                    value={job.received_date ? formatDateLong(job.received_date) : formatDateLong(job.created_at)}
                  />
                  <DetailRow
                    label="Created"
                    value={formatDateLong(job.created_at)}
                  />
                  <DetailRow
                    label="Received By"
                    value={job.received_by_name || "—"}
                  />
                  <DetailRow
                    label="Technician"
                    value={job.assigned_technician_name || "Not assigned"}
                  />
                  {job.estimated_cost != null && (
                    <DetailRow
                      label="Estimated Cost"
                      value={
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          ₹{Number(job.estimated_cost).toLocaleString("en-IN")}
                        </span>
                      }
                    />
                  )}
                  {job.estimated_completion_date && (
                    <DetailRow
                      label="Est. Completion"
                      value={formatDateLong(job.estimated_completion_date)}
                    />
                  )}
                </div>

                {/* Tracking PIN */}
                {job.tracking_pin && (
                  <div className="mt-4 pt-4 border-t border-neutral-100">
                    <p className="text-xs text-neutral-400 uppercase tracking-wider mb-2">
                      Tracking PIN
                    </p>
                    <div className="flex items-center justify-between gap-2 bg-neutral-50 rounded-lg px-3 py-2 border border-neutral-200">
                      <span className="font-mono text-sm font-semibold text-neutral-900 tracking-widest">
                        {job.tracking_pin}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPin}
                        className="text-neutral-400 hover:text-primary-600 transition-colors p-0.5 rounded"
                        title="Copy PIN"
                        aria-label="Copy tracking PIN"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              {/* 4. Photos */}
              {job.photos && job.photos.length > 0 && (
                <Card>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Photos ({job.photos.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block aspect-square rounded-lg bg-neutral-100 overflow-hidden relative border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all"
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
          allowedTransitions={job.allowed_transitions?.filter(
            (transition) => !["ESTIMATE_SHARED", "APPROVED", "REJECTED"].includes(transition.value),
          )}
        />
        <JobDiagnosisModal
          isOpen={showDiagnosisModal}
          onClose={() => setShowDiagnosisModal(false)}
          jobId={jobId}
          initialData={job}
        />
        <JobDeliveryModal
          isOpen={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          jobId={jobId}
          customerName={`${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim()}
        />
        <JobCustomerResponseModal
          isOpen={showCustomerResponseModal}
          onClose={() => setShowCustomerResponseModal(false)}
          jobId={jobId}
          customerName={`${job.customer?.first_name ?? ""} ${job.customer?.last_name ?? ""}`.trim()}
          estimatedCost={job.estimated_cost}
        />
        <OutsourceRepairModal
          isOpen={showOutsourceModal}
          onClose={() => setShowOutsourceModal(false)}
          jobId={jobId}
        />
        <OutsourceReturnModal
          isOpen={showOutsourceReturnModal}
          onClose={() => setShowOutsourceReturnModal(false)}
          jobId={jobId}
          outsourceId={activeOutsourceId}
        />

        {/* PrintOptionsModal is bypassed and printed directly using the active/default branch template */}

        {/* PRINT-ONLY: Job Card Printable Template */}
        {showPrintView && (
          <JobCardPrintTemplate
            job={job}
            branchDetails={selectedPrintBranch}
            customShopName={selectedPrintCustomName}
          />
        )}

        {/* PRINT-ONLY: Shop Branding Sticker Template */}
        {showStickerPrintView && (
          <JobCardStickerTemplate
            job={job}
            branchDetails={selectedPrintBranch}
          />
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
