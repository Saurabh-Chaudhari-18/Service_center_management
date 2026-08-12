"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Modal, Textarea } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { jobsApi } from "@/lib/api";

interface JobCustomerResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  customerName: string;
  estimatedCost: number | null;
}

export function JobCustomerResponseModal({
  isOpen,
  onClose,
  jobId,
  customerName,
  estimatedCost,
}: JobCustomerResponseModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rejectionReason, setRejectionReason] = useState("");

  const responseMutation = useMutation({
    mutationFn: ({ approved }: { approved: boolean }) =>
      jobsApi.recordCustomerResponse(
        jobId,
        approved,
        approved ? undefined : rejectionReason.trim(),
      ),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success(
        variables.approved
          ? "Customer approval recorded."
          : "Customer rejection recorded.",
      );
      setRejectionReason("");
      onClose();
    },
  });

  const handleClose = () => {
    if (responseMutation.isPending) return;
    responseMutation.reset();
    setRejectionReason("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Record Customer Response"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={responseMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => responseMutation.mutate({ approved: false })}
            disabled={!rejectionReason.trim() || responseMutation.isPending}
          >
            Record Rejection
          </Button>
          <Button
            onClick={() => responseMutation.mutate({ approved: true })}
            isLoading={responseMutation.isPending}
          >
            Record Approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {responseMutation.error && (
          <Alert variant="error">
            {responseMutation.error instanceof Error
              ? responseMutation.error.message
              : "Could not record the customer response."}
          </Alert>
        )}
        <Alert variant="info">
          Confirm the response received from {customerName || "the customer"}
          {estimatedCost ? ` for the ₹${estimatedCost.toLocaleString("en-IN")} estimate` : ""}.
        </Alert>
        <Textarea
          label="Rejection reason"
          placeholder="Required only when the customer rejects the estimate"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          rows={3}
        />
        <p className="text-xs text-neutral-500">
          Approval moves the job into the repair workflow. Rejection closes the job as customer rejected.
        </p>
      </div>
    </Modal>
  );
}
