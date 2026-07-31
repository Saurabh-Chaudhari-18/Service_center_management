"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Select,
  LoadingState,
  Badge,
  Alert,
} from "@/components/ui";
import { outsourcedRepairsApi, outsourceVendorsApi } from "@/lib/api";
import {
  ExternalLink,
  Search,
  Building2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Plus,
  RefreshCw,
  ArrowRight,
  FileText,
  Phone,
  User,
  MapPin,
  Calendar,
  XCircle,
  Truck,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { formatDateLong } from "@/lib/formatters";
import type { OutsourcedRepair, OutsourceVendor } from "@/types";
import { OutsourceReturnModal } from "@/components/jobs/OutsourceReturnModal";
import { OutsourceWarrantyRepairModal } from "@/components/jobs/OutsourceWarrantyRepairModal";

// =====================================================
// Vendor Directory Modal (View & Add Vendors)
// =====================================================

function VendorDirectoryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: vendorsData, isLoading } = useQuery({
    queryKey: ["outsourceVendors"],
    queryFn: () => outsourceVendorsApi.list(),
    enabled: isOpen,
  });

  const vendors = useMemo(() => {
    if (!vendorsData) return [];
    return Array.isArray(vendorsData) ? vendorsData : vendorsData.results || [];
  }, [vendorsData]);

  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    try {
      setIsSubmitting(true);
      await outsourceVendorsApi.create({
        name: name.trim(),
        contact_person: contactPerson.trim() || undefined,
        phone: phone.trim(),
        city: city.trim() || undefined,
        specialization: specialization.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["outsourceVendors"] });
      setName("");
      setContactPerson("");
      setPhone("");
      setCity("");
      setSpecialization("");
      setNotes("");
      setShowAddForm(false);
    } catch (err) {
      console.error("Failed to add vendor", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 dark:border-slate-800">
        <div className="p-5 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              Outsource Vendor Directory
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              External service partners for specialized repair jobs
            </p>
          </div>
          <Button
            size="sm"
            variant={showAddForm ? "secondary" : "primary"}
            onClick={() => setShowAddForm((v) => !v)}
            leftIcon={showAddForm ? undefined : <Plus className="w-4 h-4" />}
          >
            {showAddForm ? "Cancel" : "Add Vendor"}
          </Button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {showAddForm && (
            <form
              onSubmit={handleAddVendor}
              className="p-4 bg-neutral-50 dark:bg-slate-800/50 rounded-xl border border-neutral-200 dark:border-slate-700 space-y-3"
            >
              <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                New Outsource Vendor
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Vendor / Business Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. MicroChip Solutions"
                />
                <Input
                  label="Phone Number *"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="e.g. +91 98765 43210"
                />
                <Input
                  label="Contact Person"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                />
                <Input
                  label="City / Location"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                />
                <Input
                  label="Specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Motherboard BGA Rework"
                />
                <Input
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 10% discount on bulk"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  disabled={!name.trim() || !phone.trim()}
                >
                  Save Vendor
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <LoadingState message="Loading vendor list…" />
          ) : vendors.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              <Building2 className="w-10 h-10 mx-auto text-neutral-300 mb-2" />
              <p>No outsource vendors found.</p>
              <p className="text-xs mt-1">Click "Add Vendor" to register your first partner.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendors.map((vendor: OutsourceVendor) => (
                <div
                  key={vendor.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">
                        {vendor.name}
                      </span>
                      {vendor.specialization && (
                        <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 px-2 py-0.5 rounded font-medium">
                          {vendor.specialization}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {vendor.contact_person && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {vendor.contact_person}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-neutral-400" /> {vendor.phone}
                      </span>
                      {vendor.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {vendor.city}
                        </span>
                      )}
                    </div>
                    {vendor.notes && (
                      <p className="text-xs text-neutral-400 italic mt-1">{vendor.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-100 dark:border-slate-800 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main Outsourcing List Page Component
// =====================================================

export default function OutsourcingPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("ALL");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("ALL");

  // Modal controls
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [returnModalJobId, setReturnModalJobId] = useState<string | null>(null);
  const [returnModalOutsourceId, setReturnModalOutsourceId] = useState<string | null>(null);

  // Fetch Outsource Vendors for dropdown filter
  const { data: vendorsData } = useQuery({
    queryKey: ["outsourceVendors"],
    queryFn: () => outsourceVendorsApi.list(),
  });

  const vendors = useMemo(() => {
    if (!vendorsData) return [];
    return Array.isArray(vendorsData) ? vendorsData : vendorsData.results || [];
  }, [vendorsData]);

  // Fetch Outsourced Repairs List
  const { data: repairsData, isLoading, refetch } = useQuery({
    queryKey: [
      "outsourcedRepairs",
      searchTerm,
      statusFilter,
      outcomeFilter,
      selectedVendorId,
    ],
    queryFn: () =>
      outsourcedRepairsApi.list({
        search: searchTerm.trim() || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        repair_outcome: outcomeFilter !== "ALL" ? outcomeFilter : undefined,
        vendor: selectedVendorId !== "ALL" ? selectedVendorId : undefined,
      }),
  });

  const repairs: OutsourcedRepair[] = useMemo(() => {
    if (!repairsData) return [];
    return Array.isArray(repairsData) ? repairsData : repairsData.results || [];
  }, [repairsData]);

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = repairs.length;
    const sent = repairs.filter((r) => r.status === "SENT");
    const returned = repairs.filter((r) => r.status === "RETURNED");
    const cancelled = repairs.filter((r) => r.status === "CANCELLED");

    const today = new Date().toISOString().split("T")[0];
    const overdue = sent.filter(
      (r) => r.expected_return_date && r.expected_return_date < today
    ).length;

    const totalCost = returned.reduce(
      (sum, r) => sum + (Number(r.actual_cost) || 0),
      0
    );

    return {
      total,
      sentCount: sent.length,
      returnedCount: returned.length,
      cancelledCount: cancelled.length,
      overdueCount: overdue,
      totalCost,
    };
  }, [repairs]);

  const handleOpenReturn = (jobId: string | null | undefined, outsourceId: string) => {
    setReturnModalJobId(jobId || null);
    setReturnModalOutsourceId(outsourceId);
  };

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title="Outsourced Repairs"
          subtitle="Track and manage all repair jobs sent to external third-party service vendors"
          breadcrumbs={[
            { label: "Job Cards", href: "/jobs" },
            { label: "Outsourcing " },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowVendorModal(true)}
                leftIcon={<Building2 className="w-4 h-4" />}
              >
                Vendor Directory
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowWarrantyModal(true)}
                leftIcon={<Wrench className="w-4 h-4" />}
              >
                Outsource Warranty Repair
              </Button>
            </div>
          }
        />

        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                  Total Outsourced
                </p>
                <p className="text-2xl font-extrabold text-neutral-900 dark:text-neutral-100">
                  {metrics.total}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                  Pending Jobs
                  {metrics.overdueCount > 0 && (
                    <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-1.5 py-0.2 rounded font-bold">
                      {metrics.overdueCount} Overdue
                    </span>
                  )}
                </p>
                <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                  {metrics.sentCount}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                  Returned Back
                </p>
                <p className="text-2xl font-extrabold text-green-600 dark:text-green-400">
                  {metrics.returnedCount}
                </p>
              </div>
            </Card>

            <Card className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-xl">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">
                  Total Vendor Expense
                </p>
                <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                  ₹{metrics.totalCost.toLocaleString("en-IN")}
                </p>
              </div>
            </Card>
          </div>

          {/* Overdue Banner Warning */}
          {metrics.overdueCount > 0 && (
            <Alert variant="warning" title="Vendor Overdue Alert">
              You have {metrics.overdueCount} repair job{metrics.overdueCount > 1 ? "s" : ""} past the expected return date. Please contact the respective vendors to verify completion status.
            </Alert>
          )}

          {/* Filters Bar */}
          <Card className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <Input
                  placeholder="Search by Job #, Customer, Vendor, Invoice #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>

              {/* Select Vendor */}
              <div className="w-full md:w-56">
                <Select
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Vendors" },
                    ...vendors.map((v: OutsourceVendor) => ({
                      value: v.id,
                      label: v.name,
                    })),
                  ]}
                />
              </div>

              {/* Select Outcome */}
              <div className="w-full md:w-52">
                <Select
                  value={outcomeFilter}
                  onChange={(e) => setOutcomeFilter(e.target.value)}
                  options={[
                    { value: "ALL", label: "All Outcomes" },
                    { value: "REPAIRED", label: "Repaired" },
                    { value: "PARTIALLY_REPAIRED", label: "Partially Repaired" },
                    { value: "NOT_REPAIRED", label: "Not Repaired" },
                  ]}
                />
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-2 border-t border-neutral-100 dark:border-slate-800 pt-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mr-2">
                Status:
              </span>
              {[
                { id: "ALL", label: "All Records", count: metrics.total },
                { id: "SENT", label: "Pending", count: metrics.sentCount },
                { id: "RETURNED", label: "Returned", count: metrics.returnedCount },
                { id: "CANCELLED", label: "Cancelled", count: metrics.cancelledCount },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    statusFilter === pill.id
                      ? "bg-primary-600 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-800 dark:text-neutral-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {pill.label}
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      statusFilter === pill.id
                        ? "bg-white/20 text-white"
                        : "bg-neutral-200 text-neutral-700 dark:bg-slate-700 dark:text-neutral-300"
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Outsourced Jobs Table */}
          <Card padding="none" className="overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="p-8">
                <LoadingState message="Loading outsourced repairs list…" />
              </div>
            ) : repairs.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                <Truck className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">
                  No outsourced repair records found
                </h3>
                <p className="text-sm text-neutral-500 max-w-md mx-auto mt-1">
                  {searchTerm || statusFilter !== "ALL" || selectedVendorId !== "ALL"
                    ? "Try adjusting your search terms or status filters."
                    : "To outsource a job card, open any Job Card details page and click 'Outsource Repair'."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 dark:bg-slate-800/80 text-xs uppercase font-semibold text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Job & Device</th>
                      <th className="py-3 px-4">Vendor Partner</th>
                      <th className="py-3 px-4">Reason & Notes</th>
                      <th className="py-3 px-4">Timeline</th>
                      <th className="py-3 px-4">Est / Actual Cost</th>
                      <th className="py-3 px-4">Status & Outcome</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-slate-800 text-neutral-800 dark:text-neutral-200">
                    {repairs.map((item) => {
                      const today = new Date().toISOString().split("T")[0];
                      const isOverdue =
                        item.status === "SENT" &&
                        item.expected_return_date &&
                        item.expected_return_date < today;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-neutral-50/80 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          {/* Job & Device */}
                          <td className="py-3 px-4 align-top">
                            {item.job ? (
                              <Link
                                href={`/jobs/${item.job}`}
                                className="font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-1"
                              >
                                {item.job_number || "View Job"}
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  {item.job_number || "WARRANTY"}
                                </span>
                              </div>
                            )}
                            {item.customer_name && (
                              <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5">
                                {item.customer_name}
                              </p>
                            )}
                            {item.customer_mobile && (
                              <p className="text-[11px] text-neutral-500 font-mono">
                                {item.customer_mobile}
                              </p>
                            )}
                            {item.device_summary && (
                              <p className="text-[11px] text-neutral-400 mt-0.5">
                                {item.device_summary}
                              </p>
                            )}
                          </td>

                          {/* Vendor Partner */}
                          <td className="py-3 px-4 align-top">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                              {item.vendor_name}
                            </span>
                            {item.vendor_phone && (
                              <span className="text-xs text-neutral-500 font-mono block">
                                📞 {item.vendor_phone}
                              </span>
                            )}
                            {item.vendor_city && (
                              <span className="text-xs text-neutral-400 block">
                                📍 {item.vendor_city}
                              </span>
                            )}
                          </td>

                          {/* Reason & Notes */}
                          <td className="py-3 px-4 align-top max-w-xs">
                            <p className="text-xs text-neutral-800 dark:text-neutral-200 font-medium line-clamp-2">
                              {item.reason}
                            </p>
                            {item.notes && (
                              <p className="text-[11px] text-neutral-400 italic mt-0.5 line-clamp-1">
                                Note: {item.notes}
                              </p>
                            )}
                            {item.vendor_notes && (
                              <p className="text-[11px] text-green-700 dark:text-green-400 font-medium mt-0.5 line-clamp-1">
                                Vendor: {item.vendor_notes}
                              </p>
                            )}
                          </td>

                          {/* Timeline */}
                          <td className="py-3 px-4 align-top text-xs space-y-1">
                            <div>
                              <span className="text-neutral-400">Sent:</span>{" "}
                              <span className="font-medium">{formatDateLong(item.sent_date)}</span>
                            </div>
                            {item.status === "SENT" ? (
                              <div>
                                <span className="text-neutral-400">Expected:</span>{" "}
                                <span
                                  className={`font-medium ${
                                    isOverdue ? "text-red-600 dark:text-red-400 font-bold" : ""
                                  }`}
                                >
                                  {item.expected_return_date
                                    ? formatDateLong(item.expected_return_date)
                                    : "Not specified"}
                                </span>
                                {isOverdue && (
                                  <span className="ml-1 px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-bold rounded">
                                    Overdue
                                  </span>
                                )}
                              </div>
                            ) : (
                              item.return_date && (
                                <div>
                                  <span className="text-neutral-400">Returned:</span>{" "}
                                  <span className="font-medium text-green-700 dark:text-green-400">
                                    {formatDateLong(item.return_date)}
                                  </span>
                                </div>
                              )
                            )}
                          </td>

                          {/* Est / Actual Cost */}
                          <td className="py-3 px-4 align-top text-xs">
                            {item.estimated_cost != null && (
                              <p className="text-neutral-500">
                                Est: ₹{Number(item.estimated_cost).toLocaleString("en-IN")}
                              </p>
                            )}
                            {item.actual_cost != null ? (
                              <p className="font-bold text-purple-700 dark:text-purple-400 text-sm mt-0.5">
                                Actual: ₹{Number(item.actual_cost).toLocaleString("en-IN")}
                              </p>
                            ) : (
                              <p className="text-neutral-400 italic">Pending return</p>
                            )}
                            {item.vendor_invoice_number && (
                              <p className="text-[10px] text-neutral-400 font-mono mt-0.5">
                                Bill: {item.vendor_invoice_number}
                              </p>
                            )}
                          </td>

                          {/* Status & Outcome */}
                          <td className="py-3 px-4 align-top space-y-1">
                            <div>
                              {item.status === "SENT" ? (
                                <Badge variant="warning" size="sm">
                                  Pending
                                </Badge>
                              ) : item.status === "RETURNED" ? (
                                <Badge variant="success" size="sm">
                                  Returned
                                </Badge>
                              ) : (
                                <Badge variant="default" size="sm">
                                  Cancelled
                                </Badge>
                              )}
                            </div>
                            {item.repair_outcome_display && (
                              <div className="text-xs font-semibold">
                                {item.repair_outcome === "REPAIRED" ? (
                                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {item.repair_outcome_display}
                                  </span>
                                ) : item.repair_outcome === "PARTIALLY_REPAIRED" ? (
                                  <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {item.repair_outcome_display}
                                  </span>
                                ) : (
                                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5" />
                                    {item.repair_outcome_display}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 align-top text-right">
                            {item.status === "SENT" ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenReturn(item.job || null, item.id)}
                                leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                              >
                                Mark Returned
                              </Button>
                            ) : item.job ? (
                              <Link
                                href={`/jobs/${item.job}`}
                                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 underline"
                              >
                                View Job Card
                              </Link>
                            ) : (
                              <span className="text-xs text-neutral-400 font-medium">Warranty Item</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Vendor Directory Modal */}
        <VendorDirectoryModal
          isOpen={showVendorModal}
          onClose={() => setShowVendorModal(false)}
        />

        {/* Outsource Warranty Repair Modal */}
        <OutsourceWarrantyRepairModal
          isOpen={showWarrantyModal}
          onClose={() => setShowWarrantyModal(false)}
        />

        {/* Return Outsource Modal */}
        {returnModalOutsourceId && (
          <OutsourceReturnModal
            isOpen={!!returnModalOutsourceId}
            onClose={() => {
              setReturnModalJobId(null);
              setReturnModalOutsourceId(null);
              queryClient.invalidateQueries({ queryKey: ["outsourcedRepairs"] });
              refetch();
            }}
            jobId={returnModalJobId}
            outsourceId={returnModalOutsourceId}
          />
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
