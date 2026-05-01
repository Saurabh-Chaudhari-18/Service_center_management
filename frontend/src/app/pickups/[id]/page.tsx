"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, LoadingState, LiveTrackingMap } from "@/components/ui";
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
import Link from "next/link";
import { format } from "date-fns";
import type { PickupRequestStatus } from "@/types";
import { PICKUP_STATUS_CONFIG } from "@/types";

// =====================================================
// Status Badge
// =====================================================

function PickupStatusBadge({ status }: { status: PickupRequestStatus }) {
  const config = PICKUP_STATUS_CONFIG[status];
  return (
    <span
      className="px-3 py-1.5 rounded-full text-sm font-semibold"
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    >
      {config.label}
    </span>
  );
}

// =====================================================
// Status Timeline
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
        <span className="px-4 py-2 bg-neutral-100 text-neutral-600 rounded-full font-medium">
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
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isCurrent ? "ring-4 ring-offset-2" : ""
                }`}
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
// Main Detail Page
// =====================================================

export default function PickupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentBranch } = useAuth();
  const pickupId = params.id as string;

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusNotes, setStatusNotes] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [actionError, setActionError] = useState("");

  // Fetch pickup details
  const {
    data: pickup,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pickup", pickupId],
    queryFn: () => pickupsApi.get(pickupId),
    enabled: !!pickupId,
  });

  // Fetch technicians for assignment
  const { data: technicians } = useQuery({
    queryKey: ["technicians", currentBranch?.id],
    queryFn: () => usersApi.list({ role: "TECHNICIAN" }),
    enabled: !!currentBranch && showAssignModal,
  });

  // Mutations
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
    },
    onError: (err: Error) => setActionError(err.message),
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
          <div className="p-6">
            <LoadingState />
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!pickup) {
    return (
      <ProtectedRoute requiredPermission="canViewPickups">
        <AppLayout>
          <Header title="Pickup Not Found" />
          <div className="p-6 text-center">
            <p className="text-neutral-500">Pickup request not found.</p>
            <Link href="/pickups">
              <Button className="mt-4">Back to Pickups</Button>
            </Link>
          </div>
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

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title={pickup.pickup_number}
          subtitle={`Pickup request for ${pickup.customer?.first_name} ${pickup.customer?.last_name}`}
          actions={
            <Link href="/pickups">
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
            </Link>
          }
        />

        <div className="p-6 space-y-6">
          {/* Error Banner */}
          {actionError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {actionError}
            </div>
          )}

          {/* Status & Actions Bar */}
          <Card>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <PickupStatusBadge status={pickup.status} />
                {pickup.is_urgent && (
                  <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    URGENT
                  </span>
                )}
              </div>

              {!isTerminal && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Assign Technician */}
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<UserPlus className="w-4 h-4" />}
                    onClick={() => setShowAssignModal(true)}
                  >
                    {pickup.assigned_technician
                      ? "Reassign"
                      : "Assign Technician"}
                  </Button>

                  {/* Update Status */}
                  {pickup.allowed_transitions &&
                    pickup.allowed_transitions.length > 0 && (
                      <Button
                        size="sm"
                        leftIcon={<ArrowRight className="w-4 h-4" />}
                        onClick={() => setShowStatusModal(true)}
                      >
                        Update Status
                      </Button>
                    )}

                  {/* Convert to Job */}
                  {canConvert && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<FileText className="w-4 h-4" />}
                      onClick={() => convertMutation.mutate()}
                      disabled={convertMutation.isPending}
                    >
                      {convertMutation.isPending
                        ? "Creating..."
                        : "Create Job Card"}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Status Timeline */}
            <div className="mt-4">
              <StatusTimeline currentStatus={pickup.status} />
            </div>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-500" />
                Customer
              </h3>
              <div className="space-y-3">
                <InfoRow
                  label="Name"
                  value={`${pickup.customer?.first_name || ""} ${pickup.customer?.last_name || ""}`}
                />
                <InfoRow
                  label="Contact"
                  value={pickup.contact_number}
                  icon={<Phone className="w-4 h-4" />}
                />
                <InfoRow
                  label="Mobile"
                  value={pickup.customer?.mobile || ""}
                  icon={<Phone className="w-4 h-4" />}
                />
              </div>
            </Card>

            {/* Device Info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary-500" />
                Device
              </h3>
              <div className="space-y-3">
                <InfoRow
                  label="Type"
                  value={pickup.device_type_display || pickup.device_type}
                />
                <InfoRow label="Brand" value={pickup.brand || "-"} />
                <InfoRow label="Model" value={pickup.model_name || "-"} />
              </div>
            </Card>

            {/* Pickup Details */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                Pickup Details
              </h3>
              <div className="space-y-3">
                <InfoRow label="Address" value={pickup.pickup_address} />
                <InfoRow
                  label="Date"
                  value={format(
                    new Date(pickup.pickup_date),
                    "EEEE, MMM dd, yyyy",
                  )}
                  icon={<Calendar className="w-4 h-4" />}
                />
                <InfoRow
                  label="Time Slot"
                  value={pickup.pickup_time_slot || "Any time"}
                  icon={<Clock className="w-4 h-4" />}
                />
                <InfoRow
                  label="Technician"
                  value={pickup.assigned_technician_name || "Not assigned"}
                  icon={<User className="w-4 h-4" />}
                />
              </div>
            </Card>

            {/* Complaint & Notes */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Complaint & Notes
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-neutral-500">
                    Customer Complaint
                  </label>
                  <p className="mt-1 text-neutral-900 whitespace-pre-wrap">
                    {pickup.customer_complaint}
                  </p>
                </div>
                {pickup.notes && (
                  <div>
                    <label className="text-sm font-medium text-neutral-500">
                      Internal Notes
                    </label>
                    <p className="mt-1 text-neutral-700 whitespace-pre-wrap">
                      {pickup.notes}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Technician Live Tracking Map */}
          {pickup.status === "EN_ROUTE" && (
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary-500" />
                Live Technician Tracking
              </h3>
              <TechnicianTrackingView pickupId={pickup.id} technicianName={pickup.assigned_technician_name ?? undefined} />
            </Card>
          )}

          {/* Linked Job Card */}
          {pickup.job && (
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-500" />
                    Linked Job Card
                  </h3>
                  <p className="text-sm text-neutral-500 mt-1">
                    Job {pickup.job_number} was created from this pickup
                  </p>
                </div>
                <Link href={`/jobs/${pickup.job}`}>
                  <Button
                    variant="secondary"
                    rightIcon={<ChevronRight className="w-4 h-4" />}
                  >
                    View Job
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Meta Info */}
          <Card>
            <div className="flex items-center gap-6 text-sm text-neutral-500">
              <span>
                Created by {pickup.created_by_name} on{" "}
                {format(new Date(pickup.created_at), "MMM dd, yyyy h:mm a")}
              </span>
              <span>
                Last updated:{" "}
                {format(new Date(pickup.updated_at), "MMM dd, yyyy h:mm a")}
              </span>
            </div>
          </Card>
        </div>

        {/* Assign Technician Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Assign Technician for Pickup
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {technicians?.results?.map(
                  (tech: {
                    id: string;
                    first_name: string;
                    last_name: string;
                  }) => (
                    <button
                      key={tech.id}
                      onClick={() => assignMutation.mutate(tech.id)}
                      disabled={assignMutation.isPending}
                      className="w-full text-left px-4 py-3 rounded-lg border border-neutral-100 hover:border-primary-300 hover:bg-primary-50 transition-all flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                        {tech.first_name?.[0]}
                        {tech.last_name?.[0]}
                      </div>
                      <span className="font-medium text-neutral-900">
                        {tech.first_name} {tech.last_name}
                      </span>
                    </button>
                  ),
                )}
                {(!technicians?.results ||
                  technicians.results.length === 0) && (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    No technicians available
                  </p>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Update Status Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Update Status
              </h3>
              <div className="space-y-3">
                {pickup.allowed_transitions?.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSelectedStatus(t.value)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                      selectedStatus === t.value
                        ? "border-primary-500 bg-primary-50"
                        : "border-neutral-100 hover:border-primary-200"
                    }`}
                  >
                    <span className="font-medium">{t.label}</span>
                  </button>
                ))}

                <div className="mt-3">
                  <label className="text-sm font-medium text-neutral-700">
                    Notes (optional)
                  </label>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Add notes for this status change..."
                    className="mt-1 w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
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
                  onClick={() => statusMutation.mutate()}
                  disabled={!selectedStatus || statusMutation.isPending}
                >
                  {statusMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}

// =====================================================
// Helper Component
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
    <div className="flex items-start gap-2">
      {icon && <span className="text-neutral-400 mt-0.5">{icon}</span>}
      <div>
        <span className="text-sm font-medium text-neutral-500">{label}</span>
        <p className="text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

// =====================================================
// Technician Tracking View Component
// =====================================================

function TechnicianTrackingView({ pickupId, technicianName }: { pickupId: string; technicianName?: string }) {
  const { data: locationData, isLoading } = useQuery({
    queryKey: ["pickup-tracking", pickupId],
    queryFn: () => pickupsApi.track(pickupId),
    refetchInterval: 10000, // Poll every 10 seconds while En Route
  });

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-xl border border-neutral-100">
        <div className="text-center">
          <LoadingState />
          <p className="text-xs text-neutral-500 mt-2">Locating technician...</p>
        </div>
      </div>
    );
  }

  if (!locationData || locationData.latitude === null || locationData.longitude === null) {
    return (
      <div className="h-48 flex items-center justify-center bg-neutral-50 rounded-xl border border-neutral-100 text-center p-4">
        <div>
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-neutral-800">Location Unavailable</p>
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
