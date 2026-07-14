"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Button,
  Select,
  Input,
  Textarea,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";

export interface OutsourceReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  outsourceId: string;
}

export function OutsourceReturnModal({
  isOpen,
  onClose,
  jobId,
  outsourceId,
}: OutsourceReturnModalProps) {
  const queryClient = useQueryClient();

  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [actualCost, setActualCost] = useState("");
  const [repairOutcome, setRepairOutcome] = useState("REPAIRED");
  const [vendorNotes, setVendorNotes] = useState("");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [newJobStatus, setNewJobStatus] = useState("READY_FOR_DELIVERY");

  // Sync newJobStatus with repairOutcome when it changes
  useEffect(() => {
    if (repairOutcome === "REPAIRED") {
      setNewJobStatus("READY_FOR_DELIVERY");
    } else {
      setNewJobStatus("REPAIR_IN_PROGRESS");
    }
  }, [repairOutcome]);

  // Reset fields on open
  useEffect(() => {
    if (isOpen) {
      setReturnDate(new Date().toISOString().split("T")[0]);
      setActualCost("");
      setRepairOutcome("REPAIRED");
      setVendorNotes("");
      setVendorInvoiceNumber("");
      setNewJobStatus("READY_FOR_DELIVERY");
    }
  }, [isOpen]);

  const returnMutation = useMutation({
    mutationFn: () =>
      jobsApi.markOutsourceReturned(jobId, outsourceId, {
        return_date: returnDate,
        actual_cost: actualCost ? parseFloat(actualCost) : null,
        repair_outcome: repairOutcome,
        vendor_notes: vendorNotes,
        vendor_invoice_number: vendorInvoiceNumber,
        new_job_status: newJobStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
  });

  const outcomeOptions = [
    { value: "REPAIRED", label: "Repaired Successfully" },
    { value: "PARTIALLY_REPAIRED", label: "Partially Repaired" },
    { value: "NOT_REPAIRED", label: "Could Not Repair" },
  ];

  const jobStatusOptions = [
    { value: "READY_FOR_DELIVERY", label: "Ready for Delivery" },
    { value: "REPAIR_IN_PROGRESS", label: "Repair in Progress" },
  ];

  const isFormValid = returnDate && repairOutcome && newJobStatus;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mark Device Returned"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => returnMutation.mutate()}
            isLoading={returnMutation.isPending}
            disabled={!isFormValid}
          >
            Mark Returned
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Return Date"
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            required
          />
          <Input
            label="Actual Cost Charged (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={actualCost}
            onChange={(e) => setActualCost(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Repair Outcome"
            options={outcomeOptions}
            value={repairOutcome}
            onChange={(e) => setRepairOutcome(e.target.value)}
            required
          />
          <Select
            label="Transition Job Status To"
            options={jobStatusOptions}
            value={newJobStatus}
            onChange={(e) => setNewJobStatus(e.target.value)}
            required
          />
        </div>

        <Input
          label="Vendor Bill / Invoice Number"
          placeholder="e.g. INV-2026-987"
          value={vendorInvoiceNumber}
          onChange={(e) => setVendorInvoiceNumber(e.target.value)}
        />

        <Textarea
          label="Vendor Notes / Report"
          placeholder="What did the vendor say was the issue? (e.g. replaced BGA controller IC, power lines re-soldered)..."
          value={vendorNotes}
          onChange={(e) => setVendorNotes(e.target.value)}
        />
      </div>
    </Modal>
  );
}
