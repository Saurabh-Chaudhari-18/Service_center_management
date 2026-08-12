"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Textarea, Alert } from "@/components/ui";
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
  const [method, setMethod] = useState<"otp" | "signature">("otp");
  const [signature, setSignature] = useState<File | undefined>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  const { mutate: deliver, isPending, error } = useMutation({
    mutationFn: () => jobsApi.deliver(jobId, { otp: method === "otp" ? otp : undefined, signature, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      toast.success("Device delivered successfully.");
      setOtp("");
      setNotes("");
      setSignature(undefined);
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      toast.error(
        err.response?.data?.error || err.message || "Delivery failed. Check the OTP and try again.",
      );
    },
  });

  const {
    mutate: resendOtp,
    isPending: isResending,
  } = useMutation({
    mutationFn: () => jobsApi.resendDeliveryOtp(jobId),
    onSuccess: () => toast.success("A new delivery OTP was sent to the customer."),
    onError: (err: Error) => toast.error(err.message || "Could not resend the OTP."),
  });


    const handleClose = () => {
    setOtp("");
    setNotes("");
    setSignature(undefined);
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
            disabled={method === "otp" ? otp.trim().length !== 6 : !signature}
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
          Confirm the handoff to <strong>{customerName}</strong> using the OTP sent to the customer. This permanently records the job as delivered.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={method === "otp" ? "primary" : "secondary"} onClick={() => setMethod("otp")}>Customer OTP</Button>
          <Button type="button" variant={method === "signature" ? "primary" : "secondary"} onClick={() => setMethod("signature")}>Customer signature</Button>
        </div>

        {method === "otp" ? <div className="space-y-2">
          <Input
            label="Customer delivery OTP"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Enter the OTP from the customer"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => resendOtp()}
            isLoading={isResending}
          >
            Resend delivery OTP
          </Button>
        </div> : <SignaturePad canvasRef={canvasRef} drawingRef={drawingRef} onChange={setSignature} />}

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

function SignaturePad({ canvasRef, drawingRef, onChange }: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  drawingRef: React.MutableRefObject<boolean>;
  onChange: (file: File | undefined) => void;
}) {
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const p = point(event);
    context.beginPath(); context.moveTo(p.x, p.y);
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const p = point(event);
    context.lineWidth = 3; context.lineCap = "round"; context.strokeStyle = "#111827";
    context.lineTo(p.x, p.y); context.stroke();
  };
  const finish = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    event.currentTarget.toBlob(blob => onChange(blob ? new File([blob], "delivery-signature.png", { type: "image/png" }) : undefined), "image/png");
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(undefined);
  };
  return <div className="space-y-2"><p className="text-sm font-semibold text-neutral-700">Ask the customer to sign below</p><canvas ref={canvasRef} width={600} height={220} className="h-40 w-full touch-none rounded-xl border border-neutral-300 bg-white" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} /><Button type="button" variant="ghost" size="sm" onClick={clear}>Clear signature</Button></div>;
}
