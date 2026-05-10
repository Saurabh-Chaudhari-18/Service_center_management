"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Select, Textarea, Alert } from "@/components/ui";
import { jobsApi, usersApi } from "@/lib/api";

export interface JobAssignTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  branchId?: string;
}

export function JobAssignTechnicianModal({
  isOpen,
  onClose,
  jobId,
  branchId,
}: JobAssignTechnicianModalProps) {
  const queryClient = useQueryClient();
  const [technicianId, setTechnicianId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: techniciansData } = useQuery({
    queryKey: ["technicians", branchId],
    queryFn: () =>
      usersApi.list({
        role: "TECHNICIAN",
        ...(branchId ? { branch: branchId } : {}),
      }),
    enabled: isOpen,
  });

  const technicians =
    techniciansData?.results?.map(
      (user: { id: string; first_name: string; last_name: string }) => ({
        value: user.id,
        label: `${user.first_name} ${user.last_name}`,
      }),
    ) || [];

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => jobsApi.assignTechnician(jobId, technicianId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      setTechnicianId("");
      setNotes("");
      onClose();
    },
  });

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
        {error && <Alert variant="error">{(error as Error).message}</Alert>}
        {technicians.length === 0 ? (
          <Alert variant="info">
            No technicians available. Please add technicians to this branch
            first.
          </Alert>
        ) : (
          <Select
            label="Select Technician"
            options={technicians}
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            placeholder="Choose a technician..."
            required
          />
        )}
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
