"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Select,
  Textarea,
  Alert,
  JobStatusBadge,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import type { JobStatus } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";

export interface JobUpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  currentStatus: JobStatus;
  allowedTransitions?: { value: string; label: string }[];
}

export function JobUpdateStatusModal({
  isOpen,
  onClose,
  jobId,
  currentStatus,
  allowedTransitions = [],
}: JobUpdateStatusModalProps) {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: () => jobsApi.updateStatus(jobId, newStatus, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      setNewStatus("");
      setNotes("");
      onClose();
    },
  });

  const availableStatuses = allowedTransitions.map((transition) => ({
    value: transition.value,
    label:
      transition.label ||
      JOB_STATUS_CONFIG[transition.value as JobStatus]?.label ||
      transition.value,
  }));

  const handleClose = () => {
    setNewStatus("");
    setNotes("");
    reset();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Update Status"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
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
        {error && (
          <Alert variant="error">
            {error instanceof Error ? error.message : "Status update failed."}
          </Alert>
        )}
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
            This job has no further standard status transitions.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
