"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Input, Select, Textarea } from "@/components/ui";
import { inventoryApi, outsourceVendorsApi, outsourcedRepairsApi } from "@/lib/api";
import { Package, Building2, Wrench, ShieldCheck } from "lucide-react";
import type { InventoryItem, OutsourceVendor } from "@/types";

import { useAuth } from "@/context/AuthContext";

export interface OutsourceWarrantyRepairModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OutsourceWarrantyRepairModal({
  isOpen,
  onClose,
}: OutsourceWarrantyRepairModalProps) {
  const queryClient = useQueryClient();
  const { currentBranch } = useAuth();

  const [selectedInventoryId, setSelectedInventoryId] = useState("");
  const [itemName, setItemName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("0");
  const [notes, setNotes] = useState("");

  // Fetch Inventory Items
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-items-outsourced-repair"],
    queryFn: () => inventoryApi.list({ limit: 200 }),
    enabled: isOpen,
  });

  const inventoryItems: InventoryItem[] = useMemo(
    () => inventoryData?.results || [],
    [inventoryData],
  );

  // Fetch Outsource Vendors
  const { data: vendorsData, isLoading: isLoadingVendors } = useQuery({
    queryKey: ["outsourceVendors"],
    queryFn: () => outsourceVendorsApi.list(),
    enabled: isOpen,
  });

  const vendors: OutsourceVendor[] = useMemo(() => {
    if (!vendorsData) return [];
    return Array.isArray(vendorsData) ? vendorsData : vendorsData.results || [];
  }, [vendorsData]);

  const resetForm = () => {
    setSelectedInventoryId("");
    setItemName("");
    setSerialNumber("");
    setCustomerName("");
    setCustomerPhone("");
    setVendorId("");
    setReason("");
    setSentDate(new Date().toISOString().split("T")[0]);
    setExpectedReturnDate("");
    setEstimatedCost("0");
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Handle inventory selection
  const handleInventorySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedInventoryId(id);
    const item = inventoryItems.find((i) => i.id === id);
    if (item) {
      setItemName(item.name);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      outsourcedRepairsApi.createWarrantyOutsource({
        branch: currentBranch?.id || undefined,
        inventory_item: selectedInventoryId || undefined,
        item_name: itemName.trim(),
        serial_number: serialNumber.trim() || undefined,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        is_warranty_repair: true,
        vendor: vendorId,
        reason: reason.trim(),
        sent_date: sentDate,
        expected_return_date: expectedReturnDate || undefined,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : 0,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outsourcedRepairs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      handleClose();
    },
  });

  const vendorOptions = vendors.map((v) => ({
    value: v.id,
    label: `${v.name} ${v.city ? `(${v.city})` : ""} - ${v.phone}`,
  }));

  const inventoryOptions = inventoryItems.map((item) => ({
    value: item.id,
    label: `${item.name} (SKU: ${item.sku || "N/A"}) - Stock: ${item.quantity}`,
  }));

  const isValid = itemName.trim() && vendorId && reason.trim() && sentDate;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Outsource Inventory / Warranty Repair"
      size="2xl"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            isLoading={createMutation.isPending}
            disabled={!isValid}
            leftIcon={<Wrench className="w-4 h-4" />}
          >
            Create Outsource Repair
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-800 dark:text-emerald-200">
            <p className="font-semibold">Warranty / Sold Item Outsource Repair</p>
            <p className="mt-0.5">
              Use this form when an inventory item or a part sold to a customer returns for repair under warranty and needs to be sent to an external vendor.
            </p>
          </div>
        </div>

        {/* Section 1: Item Identification */}
        <div className="p-4 bg-neutral-50/70 dark:bg-slate-800/40 rounded-xl border border-neutral-200/80 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary-500" />
            Item & Customer Details
          </h4>

          {inventoryItems.length > 0 && (
            <Select
              label="Select from Inventory (Optional)"
              options={inventoryOptions}
              value={selectedInventoryId}
              onChange={handleInventorySelect}
              placeholder="-- Pick an item from stock --"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Item / Part Name *"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Asus ROG 15.6 LED Screen"
              required
            />
            <Input
              label="Serial Number / Invoice Ref"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. SN-98124 / INV-2024-88"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Name (Optional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
            />
            <Input
              label="Customer Mobile (Optional)"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
            />
          </div>
        </div>

        {/* Section 2: Outsource & Vendor Details */}
        <div className="p-4 bg-neutral-50/70 dark:bg-slate-800/40 rounded-xl border border-neutral-200/80 dark:border-slate-800 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-primary-500" />
            Vendor & Repair Information
          </h4>

          <Select
            label="Outsource Vendor *"
            options={vendorOptions}
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            placeholder={
              isLoadingVendors ? "Loading vendors..." : "-- Select Vendor --"
            }
            required
          />

          <Textarea
            label="Reason for Outsource / Warranty Claim Issue *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the issue found (e.g. Display backlight flicker under 1-yr warranty)..."
            required
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Sent Date *"
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
            <Input
              label="Vendor Estimated Cost (₹)"
              type="number"
              step="0.01"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <Textarea
            label="Internal Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes for staff..."
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
