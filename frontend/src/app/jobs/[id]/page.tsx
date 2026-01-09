"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  JobStatusBadge,
  LoadingState,
  Modal,
  Alert,
  Badge,
} from "@/components/ui";
import { jobsApi } from "@/lib/api";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Laptop,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Camera,
  MessageSquare,
  Package,
  DollarSign,
  Send,
  UserCheck,
  Wrench,
  Truck,
  History,
  Plus,
  Trash2,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobCard, JobStatus, JobStatusHistoryItem } from "@/types";
import { JOB_STATUS_CONFIG, ROLE_PERMISSIONS } from "@/types";

// =====================================================
// Timeline Component
// =====================================================

interface TimelineProps {
  history: JobStatusHistoryItem[];
}

function StatusTimeline({ history }: TimelineProps) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-neutral-500 text-center py-4">
        No status history available
      </p>
    );
  }

  return (
    <div className="timeline">
      {history.map((item, index) => {
        const toConfig = JOB_STATUS_CONFIG[item.to_status as JobStatus];

        return (
          <div key={item.id} className="timeline-item">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-neutral-900">
                    {toConfig?.label}
                  </span>
                  {item.is_override && (
                    <Badge variant="warning" size="sm">
                      Override
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  by {item.changed_by_name || "System"}
                </p>
                {item.notes && (
                  <p className="text-sm text-neutral-600 mt-2 italic">
                    &quot;{item.notes}&quot;
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {format(new Date(item.created_at), "MMM dd, yyyy h:mm a")}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================
// Action Modals
// =====================================================

interface AssignTechnicianModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  branchId?: string;
}

function AssignTechnicianModal({
  isOpen,
  onClose,
  jobId,
  branchId,
}: AssignTechnicianModalProps) {
  const queryClient = useQueryClient();
  const [technicianId, setTechnicianId] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch real technicians from API
  const { data: techniciansData } = useQuery({
    queryKey: ["technicians", branchId],
    queryFn: () =>
      jobsApi.list({ branch: branchId }).then(() =>
        // Fetch users with TECHNICIAN role
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001/api"
          }/core/users/?role=TECHNICIAN${branchId ? `&branch=${branchId}` : ""
          }`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem(
                "scm_access_token"
              )}`,
              "Content-Type": "application/json",
            },
          }
        ).then((res) => res.json())
      ),
    enabled: isOpen,
  });

  const technicians =
    techniciansData?.results?.map(
      (user: { id: string; first_name: string; last_name: string }) => ({
        value: user.id,
        label: `${user.first_name} ${user.last_name}`,
      })
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

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  currentStatus: JobStatus;
}

function UpdateStatusModal({
  isOpen,
  onClose,
  jobId,
  currentStatus,
}: UpdateStatusModalProps) {
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

  // Define allowed transitions based on current status
  const allowedTransitions: Record<string, string[]> = {
    RECEIVED: ["DIAGNOSIS"],
    DIAGNOSIS: ["ESTIMATE_SHARED"],
    ESTIMATE_SHARED: ["APPROVED", "REJECTED"],
    APPROVED: ["WAITING_FOR_PARTS", "REPAIR_IN_PROGRESS"],
    WAITING_FOR_PARTS: ["REPAIR_IN_PROGRESS"],
    REPAIR_IN_PROGRESS: ["WAITING_FOR_PARTS", "READY_FOR_DELIVERY"],
    READY_FOR_DELIVERY: ["DELIVERED", "REPAIR_IN_PROGRESS"],
  };

  const availableStatuses = (allowedTransitions[currentStatus] || []).map(
    (status) => ({
      value: status,
      label: JOB_STATUS_CONFIG[status as JobStatus]?.label || status,
    })
  );

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

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  initialData?: JobCard;
}

function DiagnosisModal({ isOpen, onClose, jobId, initialData }: DiagnosisModalProps) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [parts, setParts] = useState<
    Array<{ name: string; price: string; warranty_days: string; quantity: string }>
  >([]);

  useEffect(() => {
    if (isOpen && initialData) {
      setDiagnosis(initialData.diagnosis_notes || "");
      setEstimatedCost(initialData.estimated_cost ? String(initialData.estimated_cost) : "");
      setEstimatedDate(initialData.estimated_completion_date || "");

      if (initialData.diagnosis_parts) {
        setParts(initialData.diagnosis_parts.map(p => ({
          name: p.name,
          price: String(p.price),
          warranty_days: String(p.warranty_days),
          quantity: String(p.quantity)
        })));
      } else {
        setParts([]);
      }
    }
  }, [isOpen, initialData]);


  // Calculate total from parts
  const totalPartsPrice = parts.reduce((sum, part) => {
    return sum + (parseFloat(part.price) || 0) * (parseInt(part.quantity) || 1);
  }, 0);

  const handleAddPart = () => {
    setParts([...parts, { name: "", price: "", warranty_days: "0", quantity: "1" }]);
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handlePartChange = (
    index: number,
    field: keyof (typeof parts)[0],
    value: string
  ) => {
    const newParts = [...parts];
    newParts[index][field] = value;
    setParts(newParts);
  };


  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      jobsApi.addDiagnosis(
        jobId,
        diagnosis,
        estimatedCost ? parseFloat(estimatedCost) : undefined,
        estimatedDate || undefined,
        parts.map((p) => ({
          name: p.name,
          price: parseFloat(p.price) || 0,
          warranty_days: parseInt(p.warranty_days) || 0,
          quantity: parseInt(p.quantity) || 1,
        }))
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      onClose();
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Diagnosis"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            isLoading={isPending}
            disabled={!diagnosis}
          >
            Save Diagnosis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Textarea
          label="Diagnosis Notes"
          placeholder="Describe the issue found and recommended repairs..."
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
          rows={4}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Estimated Cost (₹)"
            type="number"
            placeholder="0.00"
            value={estimatedCost}
            onChange={(e) => setEstimatedCost(e.target.value)}
            leftIcon={<DollarSign className="w-4 h-4" />}
          />
          <Input
            label="Estimated Completion Date"
            type="date"
            value={estimatedDate}
            onChange={(e) => setEstimatedDate(e.target.value)}
          />
        </div>

        {/* Spare Parts Section */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-neutral-900">Spare Parts</h4>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={handleAddPart}
            >
              Add Part
            </Button>
          </div>

          <div className="space-y-3">
            {parts.length > 0 && (
              <div className="grid grid-cols-[1fr_6rem_5rem_8rem_2.5rem] gap-3 text-sm font-medium text-neutral-500 px-1 mb-2">
                <div>Part Name</div>
                <div>Price</div>
                <div>Qty</div>
                <div>Warranty</div>
                <div></div>
              </div>
            )}
            {parts.map((part, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_6rem_5rem_8rem_2.5rem] gap-3 items-start"
              >
                <div>
                  <Input
                    placeholder="Part Name"
                    value={part.name}
                    onChange={(e) =>
                      handlePartChange(index, "name", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Price"
                    value={part.price}
                    onChange={(e) =>
                      handlePartChange(index, "price", e.target.value)
                    }
                    className="h-9"

                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={part.quantity}
                    onChange={(e) =>
                      handlePartChange(index, "quantity", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="0"
                    value={part.warranty_days}
                    onChange={(e) =>
                      handlePartChange(index, "warranty_days", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => handleRemovePart(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {parts.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-2 bg-neutral-50 rounded-lg border border-dashed border-neutral-200">
                No parts added. Click &quot;Add Part&quot; to include spares.
              </p>
            )}

            {parts.length > 0 && (
              <div className="flex justify-end pt-2">
                <p className="text-sm font-medium">Total Parts Cost: <span className="text-green-600">₹{totalPartsPrice.toFixed(2)}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// Job Detail Page
// =====================================================

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, hasPermission, isRole } = useAuth();

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);

  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <ProtectedRoute requiredPermission="canViewJobCards">
        <AppLayout>
          <LoadingState />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (error || !job) {
    return (
      <ProtectedRoute requiredPermission="canViewJobCards">
        <AppLayout>
          <div className="p-6">
            <Alert variant="error" title="Error">
              Failed to load job card details.
            </Alert>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  const isTerminalStatus = ["DELIVERED", "CANCELLED", "REJECTED"].includes(
    job.status
  );
  const canEdit = hasPermission("canEditJobCards") && !isTerminalStatus;

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={job.job_number}
          subtitle={`${job.brand} ${job.model}`}
          actions={
            <div className="flex items-center gap-3">
              <Link href="/jobs">
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Jobs
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6">
          {/* Status Bar */}
          <Card padding="md" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <JobStatusBadge status={job.status} />
                {job.is_urgent && <Badge variant="danger">URGENT</Badge>}
                {job.is_warranty_repair && (
                  <Badge variant="info">Warranty Repair</Badge>
                )}
              </div>

              {/* Quick Actions */}
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  {job.status === "RECEIVED" && isRole("OWNER", "MANAGER") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<UserCheck className="w-4 h-4" />}
                      onClick={() => setShowAssignModal(true)}
                    >
                      Assign Technician
                    </Button>
                  )}

                  {job.status === "DIAGNOSIS" &&
                    (isRole("TECHNICIAN") ||
                      hasPermission("canEditJobCards")) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Wrench className="w-4 h-4" />}
                        onClick={() => setShowDiagnosisModal(true)}
                      >
                        Add Diagnosis
                      </Button>
                    )}

                  <Button
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setShowStatusModal(true)}
                  >
                    Update Status
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary-500" />
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Name</p>
                    <p className="font-medium text-neutral-900">
                      {job.customer?.first_name} {job.customer?.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Mobile</p>
                    <p className="font-medium text-neutral-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-neutral-400" />
                      {job.customer?.mobile}
                    </p>
                  </div>
                  {job.customer?.email && (
                    <div>
                      <p className="text-sm text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-neutral-400" />
                        {job.customer.email}
                      </p>
                    </div>
                  )}
                  {job.customer?.city && (
                    <div>
                      <p className="text-sm text-neutral-500">Location</p>
                      <p className="font-medium text-neutral-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-neutral-400" />
                        {job.customer.city}, {job.customer.state}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Device Information */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-primary-500" />
                  Device Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-neutral-500">Device Type</p>
                    <p className="font-medium text-neutral-900 capitalize">
                      {job.device_type?.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500">Brand & Model</p>
                    <p className="font-medium text-neutral-900">
                      {job.brand} {job.model}
                    </p>
                  </div>
                  {job.serial_number && (
                    <div>
                      <p className="text-sm text-neutral-500">Serial Number</p>
                      <p className="font-mono text-sm text-neutral-900">
                        {job.serial_number}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Problem & Diagnosis */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  Problem Description
                </h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 mb-1">
                      Customer Complaint
                    </p>
                    <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                      {job.customer_complaint}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-neutral-500 mb-1">
                      Physical Condition
                    </p>
                    <p className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                      {job.physical_condition || "Not documented"}
                    </p>
                  </div>

                  {job.diagnosis_notes && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-1">
                        Diagnosis Notes
                      </p>
                      <p className="text-neutral-900 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        {job.diagnosis_notes}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Diagnosis Parts Display */}
              {job.diagnosis_parts && job.diagnosis_parts.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary-500" />
                    Spare Parts Required
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-neutral-50 px-4 py-2 border-b flex gap-4 text-sm font-medium text-neutral-500 text-xs uppercase tracking-wider">
                      <div className="flex-1">Part Name</div>
                      <div className="w-24 text-right">Price</div>
                      <div className="w-16 text-center">Qty</div>
                      <div className="w-24">Warranty</div>
                      <div className="w-24 text-right">Total</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {job.diagnosis_parts.map((part) => (
                        <div key={part.id} className="px-4 py-2 flex gap-4 text-sm text-neutral-900 hover:bg-neutral-50/50 transition-colors">
                          <div className="flex-1 font-medium">{part.name}</div>
                          <div className="w-24 text-right font-mono text-neutral-600">₹{Number(part.price).toFixed(2)}</div>
                          <div className="w-16 text-center">{part.quantity}</div>
                          <div className="w-24 text-neutral-600">{part.warranty_days ? `${part.warranty_days} Days` : '-'}</div>
                          <div className="w-24 text-right font-mono font-medium">₹{(Number(part.price) * part.quantity).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-neutral-50 px-4 py-3 flex justify-end gap-3 border-t">
                      <span className="text-sm font-medium text-neutral-600">Total Parts Cost:</span>
                      <span className="text-sm font-bold text-green-600 font-mono text-base">₹{Number(job.total_parts_cost || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Accessories */}
              {job.accessories && job.accessories.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-500" />
                    Accessories Received
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {job.accessories.map((acc) => (
                      <div
                        key={acc.id}
                        className={`p-3 rounded-lg border ${acc.is_present
                          ? "bg-green-50 border-green-200"
                          : "bg-neutral-50 border-neutral-200"
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          {acc.is_present ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-neutral-400" />
                          )}
                          <span className="text-sm font-medium capitalize">
                            {acc.accessory_type.toLowerCase().replace("_", " ")}
                          </span>
                        </div>
                        {acc.condition && (
                          <p className="text-xs text-neutral-500 mt-1 ml-6">
                            {acc.condition}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-6">
              {/* Job Details */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                  Job Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Job Number</span>
                    <span className="font-mono text-sm font-medium">
                      {job.job_number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Created</span>
                    <span className="text-sm">
                      {format(new Date(job.created_at), "MMM dd, yyyy")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">
                      Received By
                    </span>
                    <span className="text-sm">
                      {job.received_by_name || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Technician</span>
                    <span className="text-sm">
                      {job.assigned_technician_name || "Not assigned"}
                    </span>
                  </div>
                  {job.estimated_cost && (
                    <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                      <span className="text-sm text-neutral-500">
                        Estimated Cost
                      </span>
                      <span className="text-sm font-medium text-green-600">
                        ₹{job.estimated_cost.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                  {job.estimated_completion_date && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-neutral-500">
                        Est. Completion
                      </span>
                      <span className="text-sm">
                        {format(
                          new Date(job.estimated_completion_date),
                          "MMM dd, yyyy"
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Status History */}
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-primary-500" />
                  Status History
                </h3>
                <StatusTimeline history={job.status_history || []} />
              </Card>

              {/* Intake Photos */}
              {job.photos && job.photos.length > 0 && (
                <Card>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-primary-500" />
                    Photos
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {job.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square rounded-lg bg-neutral-100 overflow-hidden"
                      >
                        <img
                          src={photo.photo}
                          alt={photo.description || "Job photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        <AssignTechnicianModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          jobId={jobId}
          branchId={job.branch}
        />
        <UpdateStatusModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          jobId={jobId}
          currentStatus={job.status}
        />
        <DiagnosisModal
          isOpen={showDiagnosisModal}
          onClose={() => setShowDiagnosisModal(false)}
          jobId={jobId}
          initialData={job}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
