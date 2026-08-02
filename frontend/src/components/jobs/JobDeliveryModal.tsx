"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Textarea, Alert } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { jobsApi } from "@/lib/api";

export interface JobDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  customerName: string;
}

export function JobDeliveryModal({
  isOpen,
  onClose,
  jobId,
  customerName,
}: JobDeliveryModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [notes, setNotes] = useState("");

  const { mutate: deliver, isPending, error } = useMutation({
    mutationFn: () => jobsApi.deliver(jobId, otp, notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success("Device delivered successfully.");
      setOtp("");
      setNotes("");
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      toast.error(
        err.response?.data?.error || err.message || "Delivery failed. Check the OTP and try again.",
      );
    },
  });


    const handleClose = () => {
    setOtp("");
    setNotes("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirm Device Delivery"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => deliver()}
            isLoading={isPending}
          >
            Confirm Delivery
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error">
            {(error as { response?: { data?: { error?: string } }; message?: string })
              .response?.data?.error ||
              (error as Error).message ||
              "Delivery failed."}
          </Alert>
        )}

        <p className="text-sm text-neutral-600">
          Are you sure you want to deliver the device to <strong>{customerName}</strong>? This will record the handoff and change the job card status to Delivered.
        </p>

        <Textarea
          label="Delivery notes (optional)"
          placeholder="Any notes about the handoff..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>
    </Modal>
  );
}
