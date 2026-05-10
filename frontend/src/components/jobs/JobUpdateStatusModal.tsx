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
}

export function JobUpdateStatusModal({
  isOpen,
  onClose,
  jobId,
  currentStatus,
}: JobUpdateStatusModalProps) {
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

  const availableStatuses = Object.keys(JOB_STATUS_CONFIG)
    .filter((status) => status !== currentStatus)
    .map((status) => ({
      value: status,
      label: JOB_STATUS_CONFIG[status as JobStatus]?.label || status,
    }));

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
