"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, User, Phone, MapPin, Building, AlertCircle } from "lucide-react";
import {
  Modal,
  Button,
  Select,
  Input,
  Textarea,
  Alert,
} from "@/components/ui";
import { jobsApi, outsourceVendorsApi } from "@/lib/api";
import type { OutsourceVendor } from "@/types";

export interface OutsourceRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}

export function OutsourceRepairModal({
  isOpen,
  onClose,
  jobId,
}: OutsourceRepairModalProps) {
  const queryClient = useQueryClient();

  // Outsource Form State
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  // Inline New Vendor Form State
  const [showNewVendorForm, setShowNewVendorForm] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorCity, setVendorCity] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [vendorNotes, setVendorNotes] = useState("");
  const [vendorError, setVendorError] = useState("");

  // Fetch Vendors
  const { data: vendorsData, isLoading: isLoadingVendors, refetch: refetchVendors } = useQuery({
    queryKey: ["outsourceVendors"],
    queryFn: () => outsourceVendorsApi.list(),
    enabled: isOpen,
  });

  const vendors = vendorsData?.results || [];

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setSelectedVendorId("");
      setReason("");
      setSentDate(new Date().toISOString().split("T")[0]);
      setEstimatedCost("");
      setExpectedReturnDate("");
      setNotes("");
      setShowNewVendorForm(false);
      resetVendorForm();
    }
  }, [isOpen]);

  const resetVendorForm = () => {
    setVendorName("");
    setContactPerson("");
    setVendorPhone("");
    setVendorAddress("");
    setVendorCity("");
    setSpecialization("");
    setVendorNotes("");
    setVendorError("");
  };

  // Vendor Creation Mutation
  const createVendorMutation = useMutation({
    mutationFn: () =>
      outsourceVendorsApi.create({
        name: vendorName,
        contact_person: contactPerson,
        phone: vendorPhone,
        address: vendorAddress,
        city: vendorCity,
        specialization,
        notes: vendorNotes,
        is_active: true,
      }),
    onSuccess: (newVendor) => {
      queryClient.invalidateQueries({ queryKey: ["outsourceVendors"] });
      refetchVendors().then(() => {
        setSelectedVendorId(newVendor.id);
        setShowNewVendorForm(false);
        resetVendorForm();
      });
    },
    onError: (err: any) => {
      setVendorError(err.message || "Failed to create vendor. Please check phone number/details.");
    },
  });

  // Outsource Repair Mutation
  const outsourceMutation = useMutation({
    mutationFn: () =>
      jobsApi.outsource(jobId, {
        vendor: selectedVendorId,
        reason,
        sent_date: sentDate,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
        expected_return_date: expectedReturnDate || null,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      onClose();
    },
  });

  const handleCreateVendor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      setVendorError("Vendor name is required.");
      return;
    }
    if (!vendorPhone.trim()) {
      setVendorError("Vendor phone number is required.");
      return;
    }
    setVendorError("");
    createVendorMutation.mutate();
  };

  const isFormValid = selectedVendorId && reason.trim() && sentDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Outsource Repair"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {!showNewVendorForm && (
            <Button
              onClick={() => outsourceMutation.mutate()}
              isLoading={outsourceMutation.isPending}
              disabled={!isFormValid}
            >
              Send to Vendor
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* Toggle between selection and creation of vendor */}
        {!showNewVendorForm ? (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Select
                  label="Select Repair Vendor"
                  options={vendors.map((v) => ({ value: v.id, label: `${v.name} (${v.city || "No City"})` }))}
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  placeholder={isLoadingVendors ? "Loading vendors..." : "Choose a vendor..."}
                  required
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNewVendorForm(true)}
                leftIcon={<Plus className="w-4 h-4" />}
                className="mb-[1px]"
              >
                New Vendor
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Sent Date"
                type="date"
                value={sentDate}
                onChange={(e) => setSentDate(e.target.value)}
                required
              />
              <Input
                label="Expected Return Date"
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Estimated Repair Cost (₹)"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>

            <Textarea
              label="Reason for Outsourcing"
              placeholder="Detail why this device cannot be repaired in-house (e.g. requires BGA rework, CPU reballing, lack of specialized parts)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            <Textarea
              label="Additional Notes (Internal)"
              placeholder="Any other internal notes for staff tracking..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        ) : (
          <form onSubmit={handleCreateVendor} className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-primary-500" />
                Register New Outsource Vendor
              </h3>
              <button
                type="button"
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                onClick={() => {
                  setShowNewVendorForm(false);
                  setVendorError("");
                }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {vendorError && (
              <Alert variant="error" className="text-xs">
                {vendorError}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Vendor/Shop Name"
                placeholder="e.g. Jalgaon Chip Level Solutions"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                required
              />
              <Input
                label="Contact Person"
                placeholder="e.g. Mr. Rajesh Chaudhari"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                placeholder="e.g. 9876543210"
                value={vendorPhone}
                onChange={(e) => setVendorPhone(e.target.value)}
                required
              />
              <Input
                label="Specialization"
                placeholder="e.g. Motherboard BGA, BIOS programming"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="City"
                placeholder="e.g. Jalgaon"
                value={vendorCity}
                onChange={(e) => setVendorCity(e.target.value)}
              />
              <Input
                label="Address"
                placeholder="Shop address details..."
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
              />
            </div>

            <Textarea
              label="Vendor Notes"
              placeholder="Payment terms, reliability, delivery speed..."
              value={vendorNotes}
              onChange={(e) => setVendorNotes(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowNewVendorForm(false);
                  setVendorError("");
                }}
              >
                Back to Selection
              </Button>
              <Button
                type="submit"
                isLoading={createVendorMutation.isPending}
                disabled={!vendorName.trim() || !vendorPhone.trim()}
              >
                Create & Select Vendor
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
