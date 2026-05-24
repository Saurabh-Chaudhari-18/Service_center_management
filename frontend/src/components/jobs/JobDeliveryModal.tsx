"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Textarea, Alert } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { jobsApi } from "@/lib/api";
import { RefreshCw } from "lucide-react";

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

  const { mutate: resendOtp, isPending: isResending } = useMutation({
    mutationFn: () => jobsApi.resendDeliveryOtp(jobId),
    onSuccess: () => toast.success("OTP resent to customer."),
    onError: () => toast.error("Failed to resend OTP."),
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
            disabled={otp.trim().length === 0}
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
          Delivering device to <strong>{customerName}</strong>. Enter the OTP
          sent to the customer to confirm handoff.
        </p>

        <div className="space-y-1">
          <Input
            label="Delivery OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.toUpperCase())}
            placeholder="Enter 6-character OTP"
            maxLength={6}
            required
            autoFocus
          />
          <button
            type="button"
            onClick={() => resendOtp()}
            disabled={isResending}
            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isResending ? "animate-spin" : ""}`} />
            {isResending ? "Sending…" : "Resend OTP to customer"}
          </button>
        </div>

        <Textarea
          label="Delivery notes (optional)"
          placeholder="Any notes about the handoff..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
    </Modal>
  );
}
