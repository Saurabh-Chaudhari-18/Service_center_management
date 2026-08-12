"use client";

// Focused interactive island below the server route boundary.

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  LoadingState,
  LiveTrackingMap,
  Modal,
  PickupStatusBadge,
  Textarea,
} from "@/components/ui";
import { PageShell } from "@/components/shell";
import { pickupsApi, usersApi } from "@/lib/api";
import {
  ArrowLeft,
  Truck,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import { formatDateTime } from "@/lib/formatters";
import type { PickupRequestStatus } from "@/types";
import { PICKUP_STATUS_CONFIG } from "@/types";

// =====================================================
// Status Timeline — horizontal progress indicator
// =====================================================

const STATUS_STEPS: PickupRequestStatus[] = [
  "REQUESTED",
  "ASSIGNED",
  "EN_ROUTE",
  "PICKED_UP",
  "DELIVERED_TO_CENTER",
  "COMPLETED",
];

function StatusTimeline({
  currentStatus,
}: {
  currentStatus: PickupRequestStatus;
}) {
  if (currentStatus === "CANCELLED") {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-full text-sm font-medium">
          This pickup request was cancelled
        </span>
      </div>
    );
  }

  const currentIdx = STATUS_STEPS.indexOf(currentStatus);

  return (
    <div className="flex items-center justify-between overflow-x-auto py-4 gap-1">
      {STATUS_STEPS.map((step, idx) => {
        const config = PICKUP_STATUS_CONFIG[step];
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all`}
                style={{
                  backgroundColor: isCompleted ? config.color : "#e5e7eb",
                  color: isCompleted ? "white" : "#9ca3af",
                  boxShadow: isCurrent
                    ? `0 0 0 4px ${config.color}40`
                    : undefined,
                }}
              >
                {idx + 1}
              </div>
              <span
                className={`text-xs mt-1.5 text-center font-medium ${
                  isCompleted ? "text-neutral-900" : "text-neutral-400"
                }`}
              >
                {config.label}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 min-w-[20px] ${
                  idx < currentIdx ? "bg-primary-500" : "bg-neutral-200"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// =====================================================
// InfoRow — label/value pair
// =====================================================

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      {icon && <span className="text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-sm text-neutral-900 break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

// =====================================================
// Technician Tracking View
// =====================================================

function TechnicianTrackingView({
  pickupId,
  technicianName,
}: {
  pickupId: string;
  technicianName?: string;
}) {
  const { data: locationData, isLoading } = useQuery({
    queryKey: ["pickup-tracking", pickupId],
    queryFn: () => pickupsApi.track(pickupId),
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-xl border border-neutral-100">
        <div className="text-center">
          <LoadingState message="Loading pickup…" />
          <p className="text-xs text-neutral-500 mt-2">
            Locating technician...
          </p>
        </div>
      </div>
    );
  }

  if (
    !locationData ||
    locationData.latitude === null ||
    locationData.longitude === null
  ) {
    return (
      <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-xl border border-neutral-100 text-center p-4">
        <div>
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-800">
            Location Unavailable
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Waiting for technician&apos;s device to transmit coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm border border-neutral-200">
      <LiveTrackingMap
        latitude={locationData.latitude}
        longitude={locationData.longitude}
        label={technicianName || "Technician"}
        updateTime={locationData.last_updated || undefined}
      />
    </div>
  );
}

// =====================================================
// Main Detail Page
// =====================================================

export default function PickupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { currentBranch } = useAuth();
  const pickupId = params.id as string;

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [actionError, setActionError] = useState("");

  const {
    data: pickup,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pickup", pickupId],
    queryFn: () => pickupsApi.get(pickupId),
    enabled: !!pickupId,
  });

  const { data: technicians } = useQuery({
    queryKey: ["technicians", currentBranch?.id],
    queryFn: () => usersApi.list({ role: "TECHNICIAN" }),
    enabled: !!currentBranch && showAssignModal,
  });

  const assignMutation = useMutation({
    mutationFn: (techId: string) =>
      pickupsApi.assignTechnician(pickupId, techId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pickup-stats"] });
      setShowAssignModal(false);
      setActionError("");
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: () =>
      pickupsApi.updateStatus(pickupId, selectedStatus, statusNotes),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["pickup-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      setShowStatusModal(false);
      setStatusNotes("");
      setSelectedStatus("");
      setActionError("");
      toast.success("Pickup status updated successfully.");
    },
    onError: (err: Error) => {
      setActionError(err.message);
      toast.error("Failed to update pickup status. Please try again.");
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => pickupsApi.convertToJob(pickupId),
    onSuccess: (result) => {
      refetch();
      router.push(`/jobs/${result.job_id}`);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  if (isLoading) {
    return (
      <ProtectedRoute requiredPermission="canViewPickups">
        <AppLayout>
          <Header title="Pickup Details" />
          <PageShell width="fluid">
            <LoadingState message="Loading pickup…" />
          </PageShell>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!pickup) {
    return (
      <ProtectedRoute requiredPermission="canViewPickups">
        <AppLayout>
          <Header title="Pickup Not Found" />
          <PageShell width="constrained" className="text-center">
            <p className="text-neutral-500">Pickup request not found.</p>
            <Button className="mt-4" onClick={() => router.push("/pickups")}>
              Back to Pickups
            </Button>
          </PageShell>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const isTerminal =
    pickup.status === "COMPLETED" || pickup.status === "CANCELLED";
  const canConvert =
    (pickup.status === "DELIVERED_TO_CENTER" ||
      pickup.status === "COMPLETED") &&
    !pickup.job;
  const hasTransitions =
    !isTerminal &&
    pickup.allowed_transitions &&
    pickup.allowed_transitions.length > 0;

  // Header primary action
  const headerPrimaryAction = canConvert ? (
    <Button
      leftIcon={<FileText className="w-4 h-4" />}
      onClick={() => convertMutation.mutate()}
      disabled={convertMutation.isPending}
    >
      {convertMutation.isPending ? "Creating..." : "Create Job Card"}
    </Button>
  ) : hasTransitions ? (
    <Button
      leftIcon={<ArrowRight className="w-4 h-4" />}
      onClick={() => setShowStatusModal(true)}
    >
      Update Status
    </Button>
  ) : null;

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title={pickup.pickup_number}
          subtitle={`${pickup.customer?.first_name ?? ""} ${pickup.customer?.last_name ?? ""}`}
          breadcrumbs={[
            { label: "Pickups", href: "/pickups" },
            { label: pickup.pickup_number },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => router.push("/pickups")}
              >
                Pickups
              </Button>
              {headerPrimaryAction}
            </div>
          }
        />

        <PageShell width="fluid">
          {/* Error Banner */}
          {actionError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {actionError}
            </div>
          )}

          {/* Status strip */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <PickupStatusBadge status={pickup.status} size="md" />
            {pickup.is_urgent && (
              <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                URGENT
              </span>
            )}
          </div>

          {/* Status Timeline — full width */}
          <Card>
            <StatusTimeline currentStatus={pickup.status} />
          </Card>

          {/* Main 2+1 grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Main content (2 cols) ──────────────────────────── */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Info */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-neutral-400" />
                  Customer
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow
                    label="Name"
                    value={`${pickup.customer?.first_name || ""} ${pickup.customer?.last_name || ""}`.trim()}
                  />
                  <InfoRow
                    label="Contact"
                    value={pickup.contact_number}
                    icon={<Phone className="w-3.5 h-3.5" />}
                  />
                  <InfoRow
                    label="Mobile"
                    value={pickup.customer?.mobile || ""}
                    icon={<Phone className="w-3.5 h-3.5" />}
                  />
                </div>
              </Card>

              {/* Device Info */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-neutral-400" />
                  Device
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <InfoRow
                    label="Type"
                    value={
                      pickup.device_type_display || pickup.device_type || "—"
                    }
                  />
                  <InfoRow label="Brand" value={pickup.brand || "—"} />
                  <InfoRow
                    label="Model"
                    value={pickup.model_name || "—"}
                  />
                </div>
              </Card>

              {/* Pickup Details */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-neutral-400" />
                  Pickup Details
                </h3>
                <div className="space-y-1">
                  <InfoRow label="Address" value={pickup.pickup_address} />
                  <InfoRow
                    label="Date"
                    value={new Date(pickup.pickup_date).toLocaleDateString(
                      "en-IN",
                      {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      },
                    )}
                    icon={<Calendar className="w-3.5 h-3.5" />}
                  />
                  <InfoRow
                    label="Time Slot"
                    value={pickup.pickup_time_slot || "Any time"}
                    icon={<Clock className="w-3.5 h-3.5" />}
                  />
                  <InfoRow
                    label="Technician"
                    value={
                      pickup.assigned_technician_name || "Not assigned"
                    }
                    icon={<User className="w-3.5 h-3.5" />}
                  />
                </div>
              </Card>

              {/* Complaint & Notes */}
              <Card>
                <h3 className="text-base font-semibold text-neutral-900 mb-4">
                  Complaint &amp; Notes
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                      Customer Complaint
                    </p>
                    <p className="text-sm text-neutral-900 dark:text-neutral-100 border-l-2 border-neutral-200 dark:border-neutral-600 pl-3 py-0.5 leading-relaxed whitespace-pre-wrap">
                      {pickup.customer_complaint}
                    </p>
                  </div>
                  {pickup.notes && (
                    <div>
                      <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1.5">
                        Internal Notes
                      </p>
                      <p className="text-sm text-neutral-700 dark:text-neutral-300 border-l-2 border-neutral-200 dark:border-neutral-600 pl-3 py-0.5 leading-relaxed whitespace-pre-wrap">
                        {pickup.notes}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Technician Live Tracking Map */}
              {pickup.status === "EN_ROUTE" && (
                <Card>
                  <h3 className="text-base font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-neutral-400" />
                    Live Technician Tracking
                  </h3>
                  <TechnicianTrackingView
                    pickupId={pickup.id}
                    technicianName={
                      pickup.assigned_technician_name ?? undefined
                    }
                  />
                </Card>
              )}
            </div>

            {/* ── Sidebar (1 col) ──────────────────────────────── */}
            <div className="space-y-6">
              {/* 1. Actions */}
              {(!isTerminal || canConvert) && (
                <Card>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                    Actions
                  </h3>
                  <div className="space-y-2">
                    {canConvert && (
                      <Button
                        className="w-full justify-start"
                        leftIcon={<FileText className="w-4 h-4" />}
                        onClick={() => convertMutation.mutate()}
                        disabled={convertMutation.isPending}
                      >
                        {convertMutation.isPending
                          ? "Creating..."
                          : "Create Job Card"}
                      </Button>
                    )}
                    {hasTransitions && (
                      <Button
                        variant={canConvert ? "secondary" : undefined}
                        className="w-full justify-start"
                        leftIcon={<ArrowRight className="w-4 h-4" />}
                        onClick={() => setShowStatusModal(true)}
                      >
                        Update Status
                      </Button>
                    )}
                    {!isTerminal && (
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        leftIcon={<UserPlus className="w-4 h-4" />}
                        onClick={() => setShowAssignModal(true)}
                      >
                        {pickup.assigned_technician
                          ? "Reassign Technician"
                          : "Assign Technician"}
                      </Button>
                    )}
                  </div>
                </Card>
              )}

              {/* 2. Linked Job Card */}
              {pickup.job && (
                <Card>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                    Linked Job
                  </h3>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        {pickup.job_number}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Created from this pickup
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                      onClick={() => router.push(`/jobs/${pickup.job}`)}
                    >
                      View
                    </Button>
                  </div>
                </Card>
              )}

              {/* 3. Meta Info */}
              <Card>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-3">
                  Record Info
                </h3>
                <div className="space-y-2 text-xs text-neutral-500">
                  <p>
                    <span className="font-medium text-neutral-600">
                      Created by
                    </span>{" "}
                    {pickup.created_by_name}
                  </p>
                  <p>
                    <span className="font-medium text-neutral-600">
                      Created on
                    </span>{" "}
                    {formatDateTime(pickup.created_at)}
                  </p>
                  <p>
                    <span className="font-medium text-neutral-600">
                      Last updated
                    </span>{" "}
                    {formatDateTime(pickup.updated_at)}
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </PageShell>

        {/* Assign Technician Modal */}
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Assign Technician for Pickup"
          size="md"
          footer={
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAssignModal(false)}
            >
              Cancel
            </Button>
          }
        >
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {technicians?.results?.map(
              (tech: {
                id: string;
                first_name: string;
                last_name: string;
              }) => (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => assignMutation.mutate(tech.id)}
                  disabled={assignMutation.isPending}
                  className="flex w-full items-center gap-3 rounded-lg border border-neutral-100 px-4 py-3 text-left transition-all hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-600">
                    {tech.first_name?.[0]}
                    {tech.last_name?.[0]}
                  </div>
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {tech.first_name} {tech.last_name}
                  </span>
                </button>
              ),
            )}
            {(!technicians?.results || technicians.results.length === 0) && (
              <p className="py-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
                No technicians available
              </p>
            )}
          </div>
        </Modal>

        {/* Update Status Modal */}
        <Modal
          isOpen={showStatusModal}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedStatus("");
            setStatusNotes("");
          }}
          title="Update Pickup Status"
          size="md"
          footer={
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedStatus("");
                  setStatusNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => statusMutation.mutate()}
                disabled={!selectedStatus || statusMutation.isPending}
                isLoading={statusMutation.isPending}
              >
                Update
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {pickup.allowed_transitions?.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedStatus(t.value)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-all ${
                  selectedStatus === t.value
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/40"
                    : "border-neutral-100 hover:border-primary-200 dark:border-slate-700"
                }`}
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {t.label}
                </span>
              </button>
            ))}
            <div className="mt-3">
              <Textarea
                label="Notes (optional)"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Add notes for this status change..."
                rows={3}
              />
            </div>
          </div>
        </Modal>
      </AppLayout>
    </ProtectedRoute>
  );
}
