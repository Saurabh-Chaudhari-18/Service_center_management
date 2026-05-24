"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { PageShell } from "@/components/shell/PageShell";
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
  StatsCard,
} from "@/components/ui";
import { jobsApi, usersApi } from "@/lib/api";
import {
  Wrench,
  Clock,
  CheckCircle2,
  CheckCircle,
  MessageSquare,
  ArrowRight,
  Phone,
  Laptop,
  FileText,
  MapPin,
  Navigation,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import type { JobCard } from "@/types";
import { formatPhone, formatDateLong } from "@/lib/formatters";

const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED", "REJECTED"];
const isTerminalStatus = (status: string) => TERMINAL_STATUSES.includes(status);

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
            {formatPhone(job.customer?.mobile)}
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
                Due: {formatDateLong(job.estimated_completion_date)}
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
          <div className="text-center py-6">
            <div className="text-neutral-400 mb-2">
              <CheckCircle className="h-8 w-8 mx-auto" />
            </div>
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {isTerminalStatus(job.status)
                ? "This job is complete — no further updates needed."
                : "No actions available for your role at this stage."}
            </p>
            {isTerminalStatus(job.status) && (
              <p className="text-xs text-neutral-400 mt-1">
                Status: <span className="font-mono">{job.status}</span>
              </p>
            )}
          </div>
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
// Live Location Banner
// =====================================================

function LiveLocationBanner() {
  const [sharing, setSharing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await usersApi.updateLocation(pos.coords.latitude, pos.coords.longitude);
          setLastUpdate(new Date());
          setLocationError(null);
        } catch {
          setLocationError("Failed to send location to server.");
        }
      },
      (err) => {
        setLocationError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startSharing = () => {
    setSharing(true);
    pushLocation(); // Push immediately
    intervalRef.current = setInterval(pushLocation, 30000); // then every 30s
  };

  const stopSharing = () => {
    setSharing(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        sharing
          ? "bg-green-50 border-green-200"
          : "bg-blue-50 border-blue-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            sharing ? "bg-green-100" : "bg-blue-100"
          }`}
        >
          {sharing ? (
            <Navigation className="w-5 h-5 text-green-600 animate-pulse" />
          ) : (
            <MapPin className="w-5 h-5 text-blue-600" />
          )}
        </div>
        <div>
          <p
            className={`font-semibold text-sm ${
              sharing ? "text-green-800" : "text-blue-800"
            }`}
          >
            {sharing ? "📡 Sharing Live Location" : "Share Your Location"}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              sharing ? "text-green-600" : "text-blue-600"
            }`}
          >
            {sharing
              ? lastUpdate
                ? `Last sent: ${formatDistanceToNow(lastUpdate, { addSuffix: true })} · Updates every 30s`
                : "Sending first update..."
              : "Enable so managers can track you on the pickup map when EN_ROUTE"}
          </p>
          {locationError && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              {locationError}
            </p>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={sharing ? "danger" : "primary"}
        onClick={sharing ? stopSharing : startSharing}
        leftIcon={
          sharing ? (
            <WifiOff className="w-4 h-4" />
          ) : (
            <Navigation className="w-4 h-4" />
          )
        }
        className="shrink-0"
      >
        {sharing ? "Stop Sharing" : "Start Sharing"}
      </Button>
    </div>
  );
}

// =====================================================
// Main My Jobs Page
// =====================================================

export default function MyJobsPage() {
  const [statusModal, setStatusModal] = useState<JobCard | null>(null);
  const [noteModal, setNoteModal] = useState<JobCard | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["my-jobs"],
    queryFn: () => jobsApi.getMyJobs(),
  });

  const jobs = data?.results || [];
  const totalJobs = data?.count ?? jobs.length;

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
          subtitle={`${totalJobs} jobs assigned to you`}
        />

        <PageShell>
          {/* Live Location Sharing Banner */}
          <LiveLocationBanner />

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatsCard
              label="In Progress"
              value={inProgress.length}
              icon={<Wrench className="w-5 h-5" />}
              variant="accent"
            />
            <StatsCard
              label="Pending"
              value={pending.length}
              icon={<Clock className="w-5 h-5" />}
              variant="warning"
            />
            <StatsCard
              label="Ready for Delivery"
              value={ready.length}
              icon={<CheckCircle2 className="w-5 h-5" />}
              variant="success"
            />
          </div>

          {isLoading ? (
            <LoadingState message="Loading jobs…" />
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
              {/* Desktop flat table — lg+ */}
              <div className="hidden lg:block overflow-hidden rounded-xl border border-neutral-100 bg-white dark:border-slate-700 dark:bg-slate-800">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                      <th scope="col" className="px-4 py-3">Job #</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Customer</th>
                      <th scope="col" className="px-4 py-3">Device</th>
                      <th scope="col" className="px-4 py-3">Issue</th>
                      <th scope="col" className="px-4 py-3">Est. Due</th>
                      <th scope="col" className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-800 dark:text-slate-200">
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b border-neutral-100 last:border-b-0 dark:border-slate-800/80"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-mono text-sm font-semibold text-primary-600 hover:underline dark:text-primary-400"
                            >
                              {job.job_number}
                            </Link>
                            {job.is_urgent && (
                              <Badge variant="danger" size="sm">URGENT</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <JobStatusBadge status={job.status} />
                        </td>
                        <td className="px-4 py-3 align-middle font-medium text-neutral-900 dark:text-white">
                          {job.customer?.first_name} {job.customer?.last_name}
                        </td>
                        <td className="px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">
                          {job.brand} {job.model}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 align-middle text-neutral-600 dark:text-slate-400">
                          {job.customer_complaint}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-500 dark:text-slate-500">
                          {job.estimated_completion_date
                            ? formatDateLong(job.estimated_completion_date)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 align-middle">
                          {!isTerminalStatus(job.status) && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                                onClick={() => setStatusModal(job)}
                              >
                                Update
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<MessageSquare className="w-3.5 h-3.5" />}
                                onClick={() => setNoteModal(job)}
                              >
                                Note
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile grouped cards — below lg */}
              <div className="space-y-6 lg:hidden">
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
              </div>
            </>
          )}
        </PageShell>

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
