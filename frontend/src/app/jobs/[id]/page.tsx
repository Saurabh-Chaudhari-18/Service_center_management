"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  JobStatusBadge,
  LoadingState,
  Modal,
  Alert,
  Badge,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Laptop,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  MessageSquare,
  Package,
  DollarSign,
  Send,
  UserCheck,
  Wrench,
  Truck,
  History,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobCard, JobStatus, JobStatusHistoryItem } from "@/types";
import { JOB_STATUS_CONFIG, ROLE_PERMISSIONS } from "@/types";

// =====================================================
// Timeline Component
// =====================================================

interface TimelineProps {
  history: JobStatusHistoryItem[];
}

function StatusTimeline({ history }: TimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-neutral-500 text-center py-4">
        No status history available
      </p>
    );
  }

  return (
    <div className="timeline">
      {history.map((item, index) => {
        const toConfig = JOB_STATUS_CONFIG[item.to_status as JobStatus];

        return (
          <div key={item.id} className="timeline-item">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-neutral-900">
                    {toConfig?.label}
                  </span>
                  {item.is_override && (
                    <Badge variant="warning" size="sm">
                      Override
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  by {item.changed_by_name || "System"}
                </p>
                {item.notes && (
                  <p className="text-sm text-neutral-600 mt-2 italic">
                    &quot;{item.notes}&quot;
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {format(new Date(item.created_at), "MMM dd, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Action Modals
// =====================================================

interface AssignTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

function AssignTechnicianModal({
  isOpen,
  onClose,
  jobId,
}: AssignTechnicianModalProps) {
  const queryClient = useQueryClient();
  const [technicianId, setTechnicianId] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => jobsApi.assignTechnician(jobId, technicianId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onClose();
    },
  });

  // TODO: Fetch technicians list from API
  const technicians = [
    { value: "tech1", label: "John Doe - Technician" },
    { value: "tech2", label: "Jane Smith - Technician" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign Technician"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!technicianId}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select
          label="Select Technician"
          options={technicians}
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
          placeholder="Choose a technician..."
          required
        />
        <Textarea
          label="Notes (optional)"
          placeholder="Add any assignment notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  currentStatus: JobStatus;
}

function UpdateStatusModal({
  isOpen,
  onClose,
  jobId,
  currentStatus,
}: UpdateStatusModalProps) {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => jobsApi.updateStatus(jobId, newStatus, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onClose();
    },
  });

  // Define allowed transitions based on current status
  const allowedTransitions: Record<string, string[]> = {
    RECEIVED: ["DIAGNOSIS"],
    DIAGNOSIS: ["ESTIMATE_SHARED"],
    ESTIMATE_SHARED: ["APPROVED", "REJECTED"],
    APPROVED: ["WAITING_FOR_PARTS", "REPAIR_IN_PROGRESS"],
    WAITING_FOR_PARTS: ["REPAIR_IN_PROGRESS"],
    REPAIR_IN_PROGRESS: ["WAITING_FOR_PARTS", "READY_FOR_DELIVERY"],
    READY_FOR_DELIVERY: ["DELIVERED", "REPAIR_IN_PROGRESS"],
  };

  const availableStatuses = (allowedTransitions[currentStatus] || []).map(
    (status) => ({
      value: status,
      label: JOB_STATUS_CONFIG[status as JobStatus]?.label || status,
    })
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Status"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!newStatus}
          >
            Update
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-neutral-50 rounded-lg">
          <span className="text-sm text-neutral-500">Current Status:</span>
          <JobStatusBadge status={currentStatus} />
        </div>

        {availableStatuses.length > 0 ? (
          <>
            <Select
              label="New Status"
              options={availableStatuses}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              placeholder="Select new status..."
              required
            />
            <Textarea
              label="Notes"
              placeholder="Add transition notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        ) : (
          <Alert variant="info">
            No further status transitions available for this job.
          </Alert>
        )}
      </div>
    </Modal>
  );
}

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

function DiagnosisModal({ isOpen, onClose, jobId }: DiagnosisModalProps) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      jobsApi.addDiagnosis(
        jobId,
        diagnosis,
        estimatedCost ? parseFloat(estimatedCost) : undefined,
        estimatedDate || undefined
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onClose();
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Diagnosis"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!diagnosis}
          >
            Save Diagnosis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Diagnosis Notes"
          placeholder="Describe the issue found and recommended repairs..."
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
          rows={4}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Estimated Cost (₹)"
            type="number"
            placeholder="0.00"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            leftIcon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            label="Estimated Completion Date"
            type="date"
            value={estimatedDate}
            onChange={(e) => setEstimatedDate(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// Job Detail Page
// =====================================================

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, hasPermission, isRole } = useAuth();

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);

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
    job.status
  );
  const canEdit = hasPermission("canEditJobCards") && !isTerminalStatus;

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={job.job_number}
          subtitle={`${job.brand} ${job.model}`}
          actions={
            <div className="flex items-center gap-3">
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
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  {job.status === "RECEIVED" && isRole("OWNER", "MANAGER") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<UserCheck className="w-4 h-4" />}
                      onClick={() => setShowAssignModal(true)}
                    >
                      Assign Technician
                    </Button>
                  )}

                  {job.status === "DIAGNOSIS" &&
                    (isRole("TECHNICIAN") ||
                      hasPermission("canEditJobCards")) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Wrench className="w-4 h-4" />}
                        onClick={() => setShowDiagnosisModal(true)}
                      >
                        Add Diagnosis
                      </Button>
                    )}

                  <Button
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setShowStatusModal(true)}
                  >
                    Update Status
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-500" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Name</p>
                    <p className="font-medium text-neutral-900">
                      {job.customer_details?.first_name}{" "}
                      {job.customer_details?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Mobile</p>
                    <p className="font-medium text-neutral-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-neutral-400" />
                      {job.customer_details?.mobile}
                    </p>
                  </div>
                  {job.customer_details?.email && (
                    <div>
                      <p className="text-sm text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        {job.customer_details.email}
                      </p>
                    </div>
                  )}
                  {job.customer_details?.city && (
                    <div>
                      <p className="text-sm text-neutral-500">Location</p>
                      <p className="font-medium text-neutral-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-neutral-400" />
                        {job.customer_details.city},{" "}
                        {job.customer_details.state}
                      </p>
                    </div>
                  )}
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
                      {job.physical_condition || "Not documented"}
                    </p>
                  </div>

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
                          "MMM dd, yyyy"
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
                <StatusTimeline history={job.status_history || []} />
              </Card>

              {/* Intake Photos */}
              {job.photos && job.photos.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary-500" />
                    Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-lg bg-neutral-100 overflow-hidden"
                      >
                        <img
                          src={photo.photo}
                          alt={photo.description || "Job photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <AssignTechnicianModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          jobId={jobId}
        />
        <UpdateStatusModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          jobId={jobId}
          currentStatus={job.status}
        />
        <DiagnosisModal
          isOpen={showDiagnosisModal}
          onClose={() => setShowDiagnosisModal(false)}
          jobId={jobId}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
