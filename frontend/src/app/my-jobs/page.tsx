"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Textarea,
  Modal,
  JobStatusBadge,
  LoadingState,
  EmptyState,
  Badge,
  Alert,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  Phone,
  Laptop,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import type { JobCard, JobStatus } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";

// =====================================================
// Job Card for Technician View
// =====================================================

interface TechnicianJobCardProps {
  job: JobCard;
  onUpdateStatus: (job: JobCard) => void;
  onAddNote: (job: JobCard) => void;
}

function TechnicianJobCard({
  job,
  onUpdateStatus,
  onAddNote,
}: TechnicianJobCardProps) {
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(job.created_at).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const isPending = !["DELIVERED", "CANCELLED", "REJECTED"].includes(
    job.status
  );

  return (
    <div
      className={`p-5 bg-white border rounded-xl transition-all ${
        job.is_urgent ? "border-red-200 bg-red-50/30" : "border-neutral-100"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm font-semibold text-neutral-900">
              {job.job_number}
            </span>
            <JobStatusBadge status={job.status} />
            {job.is_urgent && <Badge variant="danger">URGENT</Badge>}
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Assigned{" "}
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </p>
        </div>
        <Link href={`/jobs/${job.id}`}>
          <Button
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Details
          </Button>
        </Link>
      </div>

      {/* Customer & Device Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 p-4 bg-neutral-50 rounded-lg">
        <div>
          <p className="text-xs text-neutral-400 uppercase font-medium mb-1">
            Customer
          </p>
          <p className="font-medium text-neutral-900">
            {job.customer?.first_name} {job.customer?.last_name}
          </p>
          <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
            <Phone className="w-3.5 h-3.5" />
            {job.customer?.mobile}
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-400 uppercase font-medium mb-1">
            Device
          </p>
          <p className="font-medium text-neutral-900 flex items-center gap-1">
            <Laptop className="w-4 h-4 text-neutral-400" />
            {job.brand} {job.model}
          </p>
          <p className="text-sm text-neutral-500 capitalize mt-1">
            {job.device_type?.toLowerCase().replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Complaint */}
      <div className="mb-4">
        <p className="text-xs text-neutral-400 uppercase font-medium mb-1">
          Issue
        </p>
        <p className="text-sm text-neutral-700">{job.customer_complaint}</p>
      </div>

      {/* Diagnosis (if available) */}
      {job.diagnosis_notes && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs text-blue-600 uppercase font-medium mb-1">
            Diagnosis
          </p>
          <p className="text-sm text-blue-800">{job.diagnosis_notes}</p>
        </div>
      )}

      {/* Estimated Cost & Date */}
      {(job.estimated_cost || job.estimated_completion_date) && (
        <div className="flex gap-4 mb-4 text-sm">
          {job.estimated_cost && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
              <span className="text-green-700">Estimate:</span>
              <span className="font-semibold text-green-800">
                ₹{job.estimated_cost.toLocaleString("en-IN")}
              </span>
            </div>
          )}
          {job.estimated_completion_date && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700">
                Due: {format(new Date(job.estimated_completion_date), "MMM dd")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
          <Button
            size="sm"
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            onClick={() => onUpdateStatus(job)}
          >
            Update Status
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<MessageSquare className="w-4 h-4" />}
            onClick={() => onAddNote(job)}
          >
            Add Note
          </Button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Update Status Modal for Technicians
// =====================================================

interface TechnicianStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobCard | null;
}

function TechnicianStatusModal({
  isOpen,
  onClose,
  job,
}: TechnicianStatusModalProps) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");

  const { mutate, isPending, error } = useMutation({
    mutationFn: async (action: string) => {
      if (!job) return;

      switch (action) {
        case "start_repair":
          return jobsApi.updateStatus(job.id, "REPAIR_IN_PROGRESS", notes);
        case "waiting_parts":
          return jobsApi.updateStatus(job.id, "WAITING_FOR_PARTS", notes);
        case "mark_ready":
          return jobsApi.markReady(job.id, notes);
        default:
          throw new Error("Unknown action");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      setNotes("");
      onClose();
    },
  });

  if (!job) return null;

  // Determine available actions based on current status
  const actions: Array<{
    key: string;
    label: string;
    color: string;
    icon: React.ReactNode;
  }> = [];

  if (["DIAGNOSIS", "APPROVED", "WAITING_FOR_PARTS"].includes(job.status)) {
    actions.push({
      key: "start_repair",
      label: "Start Repair",
      color: "bg-cyan-500",
      icon: <Wrench className="w-4 h-4" />,
    });
  }

  if (["REPAIR_IN_PROGRESS", "APPROVED"].includes(job.status)) {
    actions.push({
      key: "waiting_parts",
      label: "Waiting for Parts",
      color: "bg-amber-500",
      icon: <Clock className="w-4 h-4" />,
    });
  }

  if (job.status === "REPAIR_IN_PROGRESS") {
    actions.push({
      key: "mark_ready",
      label: "Mark Ready for Delivery",
      color: "bg-green-500",
      icon: <CheckCircle2 className="w-4 h-4" />,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Job Status"
      size="lg"
    >
      <div className="space-y-4">
        {/* Current Status */}
        <div className="p-4 bg-neutral-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-medium">{job.job_number}</p>
              <p className="text-sm text-neutral-500">
                {job.brand} {job.model}
              </p>
            </div>
            <JobStatusBadge status={job.status} />
          </div>
        </div>

        {/* Error */}
        {error && <Alert variant="error">{error.message}</Alert>}

        {/* Notes */}
        <Textarea
          label="Notes"
          placeholder="Add notes about the work done or parts needed..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />

        {/* Action Buttons */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">
            Choose an action:
          </p>
          <div className="grid gap-2">
            {actions.map((action) => (
              <Button
                key={action.key}
                onClick={() => mutate(action.key)}
                isLoading={isPending}
                className={`w-full justify-start ${action.color} hover:opacity-90`}
                leftIcon={action.icon}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {actions.length === 0 && (
          <Alert variant="info">
            No status updates available for the current status.
          </Alert>
        )}
      </div>
    </Modal>
  );
}

// =====================================================
// Add Note Modal
// =====================================================

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobCard | null;
}

function AddNoteModal({ isOpen, onClose, job }: AddNoteModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [isInternal, setIsInternal] = useState(true);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => jobsApi.addNote(job!.id, note, isInternal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-jobs"] });
      setNote("");
      onClose();
    },
  });

  if (!job) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Note"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!note.trim()}
          >
            Add Note
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="error">{error.message}</Alert>}

        <Textarea
          label="Note"
          placeholder="Enter your note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          required
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 text-primary-500"
          />
          <span className="text-sm text-neutral-700">
            Internal note (not visible to customer)
          </span>
        </label>
      </div>
    </Modal>
  );
}

// =====================================================
// Main My Jobs Page
// =====================================================

export default function MyJobsPage() {
  const { user } = useAuth();
  const [statusModal, setStatusModal] = useState<JobCard | null>(null);
  const [noteModal, setNoteModal] = useState<JobCard | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: () => jobsApi.getMyJobs(),
  });

  const jobs = data || [];

  // Group jobs by status
  const inProgress = jobs.filter((j) => j.status === "REPAIR_IN_PROGRESS");
  const pending = jobs.filter((j) =>
    ["RECEIVED", "DIAGNOSIS", "APPROVED", "WAITING_FOR_PARTS"].includes(
      j.status
    )
  );
  const ready = jobs.filter((j) => j.status === "READY_FOR_DELIVERY");

  return (
    <ProtectedRoute requiredRoles={["TECHNICIAN"]}>
      <AppLayout>
        <Header
          title={`My Jobs`}
          subtitle={`${jobs.length} jobs assigned to you`}
        />

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md" className="stats-card stats-card-accent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {inProgress.length}
                  </p>
                  <p className="text-sm text-neutral-500">In Progress</p>
                </div>
              </div>
            </Card>
            <Card padding="md" className="stats-card stats-card-warning">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {pending.length}
                  </p>
                  <p className="text-sm text-neutral-500">Pending</p>
                </div>
              </div>
            </Card>
            <Card padding="md" className="stats-card stats-card-success">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">
                    {ready.length}
                  </p>
                  <p className="text-sm text-neutral-500">Ready for Delivery</p>
                </div>
              </div>
            </Card>
          </div>

          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <Alert variant="error">Failed to load your jobs</Alert>
          ) : jobs.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FileText className="w-8 h-8 text-neutral-400" />}
                title="No jobs assigned"
                description="You don't have any jobs assigned to you yet"
              />
            </Card>
          ) : (
            <>
              {/* In Progress */}
              {inProgress.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-cyan-500" />
                    In Progress ({inProgress.length})
                  </h2>
                  <div className="space-y-4">
                    {inProgress.map((job) => (
                      <TechnicianJobCard
                        key={job.id}
                        job={job}
                        onUpdateStatus={setStatusModal}
                        onAddNote={setNoteModal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Pending */}
              {pending.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Pending ({pending.length})
                  </h2>
                  <div className="space-y-4">
                    {pending.map((job) => (
                      <TechnicianJobCard
                        key={job.id}
                        job={job}
                        onUpdateStatus={setStatusModal}
                        onAddNote={setNoteModal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Ready for Delivery */}
              {ready.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Ready for Delivery ({ready.length})
                  </h2>
                  <div className="space-y-4">
                    {ready.map((job) => (
                      <TechnicianJobCard
                        key={job.id}
                        job={job}
                        onUpdateStatus={setStatusModal}
                        onAddNote={setNoteModal}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modals */}
        <TechnicianStatusModal
          isOpen={!!statusModal}
          onClose={() => setStatusModal(null)}
          job={statusModal}
        />
        <AddNoteModal
          isOpen={!!noteModal}
          onClose={() => setNoteModal(null)}
          job={noteModal}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
