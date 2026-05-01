"use client";

import React, { useState, useEffect, useRef, startTransition } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
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
import { jobsApi, API_BASE_URL } from "@/lib/api";
import {
  ArrowLeft,
  Edit,
  User,
  Phone,
  Mail,
  MapPin,
  Laptop,
  FileText,
  CheckCircle2,
  AlertCircle,
  Camera,
  Package,
  DollarSign,
  UserCheck,
  Wrench,
  History,
  Plus,
  Trash2,
  Settings,
  Receipt,
  Printer,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { JobCard, JobStatus, JobStatusHistoryItem } from "@/types";
import { JOB_STATUS_CONFIG } from "@/types";

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
      {history.map((item) => {
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
          `${API_BASE_URL}/core/users/?role=TECHNICIAN${
            branchId ? `&branch=${branchId}` : ""
          }`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem(
                "scm_access_token",
              )}`,
              "Content-Type": "application/json",
            },
          },
        ).then((res) => res.json()),
      ),
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
    }),
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

function DiagnosisModal({
  isOpen,
  onClose,
  jobId,
  initialData,
}: DiagnosisModalProps) {
  const queryClient = useQueryClient();
  const [diagnosis, setDiagnosis] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [parts, setParts] = useState<
    Array<{
      name: string;
      price: string;
      warranty_months: string;
      quantity: string;
    }>
  >([]);
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [photoDescriptions, setPhotoDescriptions] = useState<string[]>([]);
  const prevIsOpenRef = useRef(false);

  // Initialize/reset form state when modal opens/closes
  // This pattern is necessary for modal forms that need to initialize from props
  useEffect(() => {
    // Only initialize/reset when modal state changes
    if (isOpen && !prevIsOpenRef.current) {
      // Modal just opened - initialize from initialData
      if (initialData) {
        // Use startTransition to batch state updates and avoid linter warnings
        startTransition(() => {
          setDiagnosis(initialData.diagnosis_notes || "");
          setEstimatedCost(
            initialData.estimated_cost
              ? String(initialData.estimated_cost)
              : "",
          );
          setEstimatedDate(initialData.estimated_completion_date || "");
          setParts(
            initialData.diagnosis_parts
              ? initialData.diagnosis_parts.map((p) => ({
                  name: p.name,
                  price: String(p.price),
                  warranty_months: String(p.warranty_months),
                  quantity: String(p.quantity),
                }))
              : [],
          );
        });
      }
    } else if (!isOpen && prevIsOpenRef.current) {
      // Modal just closed - reset state
      startTransition(() => {
        setDiagnosis("");
        setEstimatedCost("");
        setEstimatedDate("");
        setParts([]);
        setDamagePhotos([]);
        setPhotoDescriptions([]);
      });
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, initialData]);

  // Calculate total from parts
  const totalPartsPrice = parts.reduce((sum, part) => {
    return sum + (parseFloat(part.price) || 0) * (parseInt(part.quantity) || 1);
  }, 0);

  const handleAddPart = () => {
    setParts([
      ...parts,
      { name: "", price: "", warranty_months: "0", quantity: "1" },
    ]);
  };

  const handleRemovePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handlePartChange = (
    index: number,
    field: keyof (typeof parts)[0],
    value: string,
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
          warranty_months: parseInt(p.warranty_months) || 0,
          quantity: parseInt(p.quantity) || 1,
        })),
      ),
    onSuccess: async () => {
      // Upload any attached damage photos
      if (damagePhotos.length > 0) {
        try {
          for (let i = 0; i < damagePhotos.length; i++) {
            if (damagePhotos[i]) {
                await jobsApi.uploadPhoto(
                  jobId,
                  damagePhotos[i],
                  "DAMAGE",
                  photoDescriptions[i] || "Damage during diagnosis"
                );
            }
          }
        } catch (e) {
          console.error("Failed to upload damage photos", e);
        }
      }
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

        {/* Diagnosis Photos Section */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h4 className="font-medium text-neutral-900 flex items-center gap-2">
            <Camera className="w-4 h-4" /> Diagnosis Photos
          </h4>
          <p className="text-xs text-neutral-500">
            Upload images of any physical damage found during diagnosis. These may be visible to the customer.
          </p>
          <div className="space-y-3">
            {damagePhotos.map((photo, index) => (
              <div key={index} className="flex items-start gap-3 bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-medium px-1 truncate">{photo.name}</div>
                  <Input
                    placeholder="Description (e.g. Scratched screen)"
                    value={photoDescriptions[index] || ""}
                    onChange={(e) => {
                      const newDesc = [...photoDescriptions];
                      newDesc[index] = e.target.value;
                      setPhotoDescriptions(newDesc);
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 mt-7"
                  type="button"
                  onClick={() => {
                    const newPhotos = [...damagePhotos];
                    const newDesc = [...photoDescriptions];
                    newPhotos.splice(index, 1);
                    newDesc.splice(index, 1);
                    setDamagePhotos(newPhotos);
                    setPhotoDescriptions(newDesc);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="damage-photo-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setDamagePhotos([...damagePhotos, file]);
                    setPhotoDescriptions([...photoDescriptions, ""]);
                    e.target.value = ''; // Reset input
                  }
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => document.getElementById("damage-photo-upload")?.click()}
                leftIcon={<Upload className="w-4 h-4" />}
                type="button"
              >
                Add Photo
              </Button>
            </div>
          </div>
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
                    value={part.warranty_months}
                    onChange={(e) =>
                      handlePartChange(index, "warranty_months", e.target.value)
                    }
                    className="h-9"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50"
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
                <p className="text-sm font-medium">
                  Total Parts Cost:{" "}
                  <span className="text-green-600">
                    ₹{totalPartsPrice.toFixed(2)}
                  </span>
                </p>
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

// =====================================================
// Print Portal Component
// =====================================================

const PrintPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof window === "undefined") return null;
  return createPortal(
    <div id="print-portal-root">{children}</div>,
    document.body,
  );
};

// Simple Brand Logo Component
function BrandLogo({ brand }: { brand: "HP" | "DELL" | "ASUS" | "LENOVO" }) {
  switch (brand) {
    case "HP":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle cx="50" cy="50" r="45" fill="#0096D6" />
          <text
            x="50"
            y="65"
            fontSize="40"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            style={{ fontStyle: "italic", fontFamily: "serif" }}
          >
            hp
          </text>
        </svg>
      );
    case "DELL":
      return (
        <svg viewBox="0 0 100 100" className="w-8 h-8">
          <circle
            cx="50"
            cy="50"
            r="48"
            fill="none"
            stroke="#007DB8"
            strokeWidth="4"
          />
          <text
            x="50"
            y="60"
            fontSize="24"
            fontWeight="bold"
            fill="#007DB8"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            DELL
          </text>
        </svg>
      );
    case "ASUS":
      return (
        <svg viewBox="0 0 100 30" className="w-12 h-6">
          <text
            x="50"
            y="22"
            fontSize="24"
            fontWeight="bold"
            fill="#00539B"
            textAnchor="middle"
            style={{ letterSpacing: "2px" }}
          >
            ASUS
          </text>
        </svg>
      );
    case "LENOVO":
      return (
        <svg viewBox="0 0 100 40" className="w-16 h-8">
          <rect width="100" height="40" fill="#E2231A" />
          <text
            x="50"
            y="28"
            fontSize="20"
            fontWeight="bold"
            fill="white"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            Lenovo
          </text>
        </svg>
      );
  }
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { hasPermission, isRole } = useAuth();

  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showPrintView, setShowPrintView] = useState(false);

  // Hide print portal after printing is done
  useEffect(() => {
    const handleAfterPrint = () => setShowPrintView(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

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
    job.status,
  );
  // Allow Owner/Manager to edit even if terminal
  const canEdit =
    (hasPermission("canEditJobCards") && !isTerminalStatus) ||
    isRole("OWNER", "SUPER_ADMIN", "MANAGER");

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={job.job_number}
          subtitle={`${job.brand} ${job.model}`}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                leftIcon={<Printer className="w-4 h-4" />}
                onClick={() => {
                  setShowPrintView(true);
                  setTimeout(() => window.print(), 500);
                }}
              >
                Print Job Card
              </Button>
              {isRole("OWNER", "SUPER_ADMIN") && (
                <Link href={`/jobs/${jobId}/edit`}>
                  <Button
                    variant="secondary"
                    leftIcon={<Edit className="w-4 h-4" />}
                  >
                    Edit Job
                  </Button>
                </Link>
              )}
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
              <div className="flex items-center gap-2 flex-wrap">
                {/* Invoice Button - Always visible for valid statuses */}
                {[
                  "APPROVED",
                  "REPAIR_IN_PROGRESS",
                  "READY_FOR_DELIVERY",
                  "DELIVERED",
                ].includes(job.status) && (
                  <Link href={`/billing/new?jobId=${job.id}`}>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Receipt className="w-4 h-4" />}
                    >
                      Create Invoice
                    </Button>
                  </Link>
                )}
                {(job.status === "RECEIVED" ||
                  (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
                  isRole("OWNER", "SUPER_ADMIN", "MANAGER") && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<UserCheck className="w-4 h-4" />}
                      onClick={() => setShowAssignModal(true)}
                    >
                      Assign Technician
                    </Button>
                  )}

                {(job.status === "DIAGNOSIS" ||
                  (isTerminalStatus && isRole("OWNER", "SUPER_ADMIN"))) &&
                  (isRole("TECHNICIAN") ||
                    hasPermission("canEditJobCards") ||
                    isRole("OWNER", "SUPER_ADMIN")) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Wrench className="w-4 h-4" />}
                      onClick={() => setShowDiagnosisModal(true)}
                    >
                      Add Diagnosis
                    </Button>
                  )}

                {canEdit && (
                  <Button
                    size="sm"
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setShowStatusModal(true)}
                  >
                    Update Status
                  </Button>
                )}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content - 2 columns */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-500" />
                    Customer Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Customer Name
                      </p>
                      <p className="font-semibold text-neutral-900 text-lg">
                        {job.customer?.first_name} {job.customer?.last_name}
                      </p>
                    </div>
                  </div>

                  {/* Mobile */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Mobile Number
                      </p>
                      <p className="font-medium text-neutral-900 font-mono">
                        {job.customer?.mobile}
                      </p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">
                        Email Address
                      </p>
                      <p className="font-medium text-neutral-900 break-all">
                        {job.customer?.email || (
                          <span className="text-neutral-400 italic">
                            Not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-500 mb-1">Location</p>
                      <p className="font-medium text-neutral-900">
                        {job.customer?.city ? (
                          `${job.customer.city}${
                            job.customer.state ? `, ${job.customer.state}` : ""
                          }`
                        ) : (
                          <span className="text-neutral-400 italic">
                            Not provided
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
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
                      {(job as any).physical_condition_display || "Not documented"}
                    </p>
                  </div>

                  {(job as any).engineer_diagnosis_display && (
                    <div>
                      <p className="text-sm font-medium text-neutral-500 mb-1">
                        Engineer Diagnosis
                      </p>
                      <p className="text-neutral-900 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        {(job as any).engineer_diagnosis_display}
                      </p>
                    </div>
                  )}

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
                        <div
                          key={part.id}
                          className="px-4 py-2 flex gap-4 text-sm text-neutral-900 hover:bg-neutral-50/50 transition-colors"
                        >
                          <div className="flex-1 font-medium">{part.name}</div>
                          <div className="w-24 text-right font-mono text-neutral-600">
                            ₹{Number(part.price).toFixed(2)}
                          </div>
                          <div className="w-16 text-center">
                            {part.quantity}
                          </div>
                          <div className="w-24 text-neutral-600">
                            {part.warranty_months
                              ? `${part.warranty_months} Months`
                              : "-"}
                          </div>
                          <div className="w-24 text-right font-mono font-medium">
                            ₹{(Number(part.price) * part.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-neutral-50 px-4 py-3 flex justify-end gap-3 border-t">
                      <span className="text-sm font-medium text-neutral-600">
                        Total Parts Cost:
                      </span>
                      <span className="text-sm font-bold text-green-600 font-mono text-base">
                        ₹{Number(job.total_parts_cost || 0).toFixed(2)}
                      </span>
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
                        className={`p-3 rounded-lg border ${
                          acc.is_present
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
                          "MMM dd, yyyy",
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
                  <div className="grid grid-cols-2 gap-3">
                    {job.photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={photo.photo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block aspect-square rounded-xl bg-neutral-100 overflow-hidden relative border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photo}
                          alt={photo.description || "Job photo"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {photo.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                            <p className="text-xs text-white truncate">{photo.description}</p>
                          </div>
                        )}
                      </a>
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

        {/* PRINT-ONLY: Job Card Printable Template */}
        {showPrintView && (
          <PrintPortal>
            <div className="bg-white p-6 text-[10pt] leading-[1.3] text-black h-screen flex flex-col justify-between">
              <div className="space-y-3">
                {/* Shop Header */}
                <div className="print-section border-2 border-black p-2 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-4 items-center">
                      <BrandLogo brand="HP" />
                      <BrandLogo brand="DELL" />
                      <BrandLogo brand="ASUS" />
                      <BrandLogo brand="LENOVO" />
                    </div>
                    <div className="text-right">
                      <h1 className="text-2xl font-bold uppercase tracking-wider">
                        SHIVANGI INFOTECH
                      </h1>
                      <p className="text-[10pt] font-semibold">
                        HP | DELL | ASUS Authorised Partner
                      </p>
                    </div>
                  </div>
                  <div className="text-center mt-2 pt-2 border-t-2 border-black">
                    <p className="text-[10pt] font-medium">
                      Shop No.1&2, Krupalu Hsg. Soc, Paud Road, Near Vespa
                      Showroom, Pune-411038
                    </p>
                    <p className="text-[10pt] font-bold mt-1">
                      Mobile: 9890888295, 9850292673
                    </p>
                  </div>
                  <div className="text-center mt-2 pt-2 border-t-2 border-black">
                    <p className="font-bold text-lg uppercase tracking-wide">
                      JOB CARD: {job.job_number}
                    </p>
                    <p className="text-[11pt] font-medium">
                      Date: {format(new Date(job.created_at), "dd MMM yyyy")}
                    </p>
                    <p className="text-[10pt] font-medium text-neutral-600">
                      Status: {job.status?.replace(/_/g, " ")}
                    </p>
                  </div>
                </div>

                {/* Customer & Device */}
                <div className="print-grid print-section grid grid-cols-2 gap-4 mb-2">
                  <div className="border border-black p-2">
                    <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                      CUSTOMER DETAILS
                    </p>
                    <div className="space-y-1">
                      <p>
                        <b>Name:</b> {job.customer?.first_name}{" "}
                        {job.customer?.last_name}
                      </p>
                      <p>
                        <b>Mobile:</b> {job.customer?.mobile}
                      </p>
                      {job.customer?.email && (
                        <p>
                          <b>Email:</b> {job.customer.email}
                        </p>
                      )}
                      {job.customer?.city && (
                        <p>
                          <b>Address:</b> {job.customer.city}
                          {job.customer?.state ? `, ${job.customer.state}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="border border-black p-2">
                    <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                      DEVICE DETAILS
                    </p>
                    <div className="space-y-1">
                      <p>
                        <b>Type:</b> {job.device_type}
                      </p>
                      <p>
                        <b>Brand/Model:</b> {job.brand} {job.model}
                      </p>
                      {job.serial_number && (
                        <p>
                          <b>Serial:</b> {job.serial_number}
                        </p>
                      )}
                      {job.is_urgent && (
                        <p className="text-red-600 font-bold text-[11pt] mt-1">
                          ⚠ URGENT REPAIR
                        </p>
                      )}
                      <p>
                        <b>Warranty:</b> {job.is_warranty_repair ? "YES" : "NO"}
                      </p>
                      {job.is_warranty_repair && job.warranty_details && (
                        <p>
                          <b>Warranty Details:</b> {job.warranty_details}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Accessories */}
                <div className="print-section border border-black p-2 mb-2">
                  <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                    ACCESSORIES
                  </p>
                  <div className="space-y-2">
                    {job.accessories && job.accessories.length > 0 ? (
                      <p>
                        <b>Accessories:</b>{" "}
                        {job.accessories
                          .filter((a) => a.is_present)
                          .map((a) =>
                            a.accessory_type.toLowerCase().replace("_", " "),
                          )
                          .join(", ")}
                      </p>
                    ) : (
                      <p className="text-neutral-400">
                        No accessories submitted
                      </p>
                    )}
                    <p>
                      <b>Physical Condition:</b>{" "}
                      {(job as any).physical_condition_display || "Not documented"}
                    </p>
                  </div>
                </div>

                {/* Issue Details */}
                <div className="print-section border border-black p-2 mb-2">
                  <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                    ISSUE DETAILS
                  </p>
                  <div className="space-y-2">
                    <p>
                      <b>Customer Complaint:</b> {job.customer_complaint}
                    </p>
                    {job.diagnosis_notes && (
                      <p>
                        <b>Diagnosis Notes:</b> {job.diagnosis_notes}
                      </p>
                    )}
                    {job.additional_comments && (
                      <p>
                        <b>Additional Comments:</b> {job.additional_comments}
                      </p>
                    )}
                  </div>
                </div>

                {/* Terms & Conditions */}
                <div className="print-section border border-black p-2 terms-text mb-2">
                  <p className="font-bold text-[10pt] mb-1 uppercase underline">
                    TERMS & CONDITIONS
                  </p>
                  <div className="space-y-2 text-[9pt] leading-[1.4] text-justify">
                    <p>
                      <b>1. Condition:</b> In case of hard disk failure,
                      formatting may be required which may lead to data loss.
                      Customers are advised to backup important data. Only
                      recommended OS with drivers will be installed.
                      Physical/water/burn damage not covered under warranty. For
                      warranty claims, provide purchase invoice. Defective parts
                      not returned. Product may become non-functional during
                      repair - we will not be responsible.
                    </p>
                    <p>
                      <b>2. Note:</b> Customer must confirm repair within 48
                      hours of estimate, else repair will proceed automatically.
                      Defective parts not returned. Complaints must be reported
                      within 24 hours of delivery. Collect product within 45
                      days or it will be scrapped. After 45 days, ₹500/month
                      handling charge applies.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {/* Authorization & Charges */}
                <div className="print-grid print-section grid grid-cols-2 gap-4">
                  <div className="border border-black p-2 h-full flex flex-col justify-between">
                    <div>
                      <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                        CUSTOMER AUTHORIZATION
                      </p>
                      <p className="text-[10pt] mb-4 italic">
                        I hereby authorize Shivangi Infotech to provide
                        necessary repair & service. I have taken backup of all
                        important data.
                      </p>
                    </div>
                    <div className="mt-8 pt-2 border-t border-dashed border-black">
                      <p className="font-bold mb-2">
                        {job.customer?.first_name} {job.customer?.last_name}
                      </p>
                      <p className="font-bold">
                        Customer Signature: _________________
                      </p>
                    </div>
                  </div>
                  <div className="border border-black p-2">
                    <p className="font-bold border-b border-black text-[11pt] mb-2 uppercase bg-slate-100">
                      APPROX REPAIR CHARGES
                    </p>
                    <div className="space-y-3 text-[11pt]">
                      <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                        <span>Service Charges:</span>
                        <span className="w-24 border-b border-black text-right px-1">
                          {job.estimated_cost
                            ? `₹ ${Number(job.estimated_cost).toFixed(0)}`
                            : "₹"}
                        </span>
                      </p>
                      <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                        <span>Parts/Spares:</span>
                        <span className="w-24 border-b border-black text-right px-1">
                          {job.total_parts_cost
                            ? `₹ ${Number(job.total_parts_cost).toFixed(0)}`
                            : "₹"}
                        </span>
                      </p>
                      <p className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                        <span>Discount:</span>
                        <span className="w-24 border-b border-black">₹</span>
                      </p>
                      <p className="flex justify-between font-bold text-lg pt-1">
                        <span>FINAL COST:</span>
                        <span className="w-24 border-b-2 border-black">₹</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="footer-text text-center mt-2 pt-2 border-t-2 border-black text-[9pt]">
                  <p>
                    All estimates without taxes. GST are Extra as applicable.
                    Diagnosis: Laptop ₹750, Mobile/Tablet ₹500, Desktop ₹350-550
                  </p>
                  <p className="font-bold text-[10pt] mt-1">
                    NON-WARRANTY PRODUCTS HAVE NO WARRANTY ON REPAIRING
                  </p>
                </div>
              </div>
            </div>
          </PrintPortal>
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
