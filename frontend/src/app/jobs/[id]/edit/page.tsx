"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  Alert,
  LoadingState,
} from "@/components/ui";
import { jobsApi, branchesApi } from "@/lib/api";
import { ArrowLeft, Check, Save, Printer } from "lucide-react";
import Link from "next/link";
import type { AccessoryType } from "@/types";

// Schema - mostly same as create but all optional basically
const editJobSchema = z.object({
  customer_id: z.string().optional(), // Can edit customer if needed
  device_type: z.string().min(1, "Device type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serial_number: z.string().optional(),
  customer_complaint: z.string().min(10, "Please describe the issue in detail"),
  physical_condition: z
    .string()
    .min(5, "Please describe the physical condition"),
  is_urgent: z.boolean().optional(),
  is_warranty_repair: z.boolean().optional(),
  warranty_details: z.string().optional(),
  diagnosis_notes: z.string().optional(),
  additional_comments: z.string().optional(),
});

type EditJobFormData = z.infer<typeof editJobSchema>;

// Accessories Checklist Component (reused logic)
interface AccessoriesChecklistProps {
  value: Partial<
    Record<AccessoryType, { present: boolean; condition: string }>
  >;
  onChange: (
    value: Partial<
      Record<AccessoryType, { present: boolean; condition: string }>
    >,
  ) => void;
}

function AccessoriesChecklist({ value, onChange }: AccessoriesChecklistProps) {
  const accessories: AccessoryType[] = [
    "CHARGER",
    "BATTERY",
    "BAG",
    "MOUSE",
    "KEYBOARD",
    "POWER_CABLE",
    "USB_CABLE",
    "RAM",
    "HDD",
    "SSD",
  ];

  const toggleAccessory = (acc: AccessoryType) => {
    onChange({
      ...value,
      [acc]: {
        present: !value[acc]?.present,
        condition: value[acc]?.condition || "",
      },
    });
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {accessories.map((acc) => {
        const isChecked = value[acc]?.present || false;
        const label = acc.toLowerCase().replace("_", " ");

        return (
          <button
            key={acc}
            type="button"
            onClick={() => toggleAccessory(acc)}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
              isChecked
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-neutral-50 border-neutral-200 text-neutral-600"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border flex items-center justify-center ${
                isChecked
                  ? "bg-green-500 border-green-500"
                  : "border-neutral-300"
              }`}
            >
              {isChecked && <Check className="w-3 h-3 text-white" />}
            </div>
            <span className="text-sm font-medium capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function EditJobPage() {
  const params = useParams();
  const jobId = params.id as string;
  const router = useRouter();
  const { hasPermission, isRole } = useAuth();
  const queryClient = useQueryClient();

  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});
  const [deviceTypes, setDeviceTypes] = useState<
    { value: string; label: string }[]
  >([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Fetch Branches
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });

  // Fetch Job
  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
  } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  // Fetch Device Types
  const { data: deviceTypesData } = useQuery({
    queryKey: ["device-types"],
    queryFn: jobsApi.getDeviceTypes,
  });

  // Initialize form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<EditJobFormData>({
    resolver: zodResolver(editJobSchema),
  });

  // Populate data when loaded
  useEffect(() => {
    if (job) {
      reset({
        customer_id: job.customer?.id,
        device_type: job.device_type,
        brand: job.brand,
        model: job.model,
        serial_number: job.serial_number || "",
        customer_complaint: job.customer_complaint,
        physical_condition: job.physical_condition,
        is_urgent: job.is_urgent,
        is_warranty_repair: job.is_warranty_repair,
        warranty_details: job.warranty_details || "",
        diagnosis_notes: job.diagnosis_notes || "",
        additional_comments: job.additional_comments || "",
      });

      // Parse accessories
      const accMap: Partial<
        Record<AccessoryType, { present: boolean; condition: string }>
      > = {};
      job.accessories?.forEach((acc) => {
        accMap[acc.accessory_type as AccessoryType] = {
          present: acc.is_present,
          condition: acc.condition || "",
        };
      });
      setAccessories(accMap);

      // Set initial branch
      if (job.branch) {
        setSelectedBranchId(
          typeof job.branch === "string"
            ? job.branch
            : (job.branch as any).id || "",
        );
      } else {
        setSelectedBranchId("universal");
      }
    }
  }, [job, reset]);

  useEffect(() => {
    if (deviceTypesData) setDeviceTypes(deviceTypesData);
  }, [deviceTypesData]);

  // Update mutation
  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: EditJobFormData) => {
      // Format accessories list
      const accessoriesList = Object.entries(accessories)
        .filter(([, value]) => value.present)
        .map(([type, value]) => ({
          accessory_type: type,
          is_present: true,
          condition: value.condition,
        }));

      return jobsApi.update(jobId, {
        ...data,
        branch: selectedBranchId === "universal" ? null : selectedBranchId,
        accessories: accessoriesList, // Send full replacement list
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      router.push(`/jobs/${jobId}`);
    },
  });

  const isWarrantyRepair = watch("is_warranty_repair");

  if (jobLoading) {
    return (
      <AppLayout>
        <LoadingState />
      </AppLayout>
    );
  }

  if (jobError || !job) {
    return (
      <AppLayout>
        <Alert variant="error">Failed to load job details.</Alert>
      </AppLayout>
    );
  }

  // Permission check - strict Owner only per request
  if (!isRole("OWNER", "SUPER_ADMIN")) {
    return (
      <AppLayout>
        <Alert variant="error">
          You do not have permission to edit this job.
        </Alert>
      </AppLayout>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={`Edit Job: ${job.job_number}`}
          subtitle="Modify any job details (Owner Access)"
          actions={
            <div className="flex items-center gap-3">
              <Link href={`/jobs/${jobId}`}>
                <Button
                  variant="secondary"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Cancel
                </Button>
              </Link>
            </div>
          }
        />

        <div className="p-6 max-w-4xl mx-auto">
          <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-6">
            {error && <Alert variant="error">{(error as Error).message}</Alert>}

            {/* Read-only Customer Info (for context) - or edit? User said ANY info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Customer (Read-Only Context)
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-neutral-500">Name</label>
                  <p className="font-medium">
                    {job.customer?.first_name} {job.customer?.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-neutral-500">Mobile</label>
                  <p className="font-medium">{job.customer?.mobile}</p>
                </div>
              </div>
              <p className="text-xs text-neutral-400 mt-2">
                * To change customer, create a new job or implement customer
                re-assignment if critical. Current edit focuses on job details.
              </p>
            </Card>

            {/* Branch Selection (Owners Only) */}
            {hasPermission("canManageBranches") && (
              <Card>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary-500" />
                  Branch Assignment
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select
                    label="Assign to Branch"
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    options={[
                      {
                        value: "universal",
                        label: "🌍 Universal / All Branches",
                      },
                      ...(Array.isArray(branches)
                        ? branches
                        : Object.hasOwn(branches, "results")
                          ? (branches as any).results
                          : []
                      ).map((b: any) => ({ value: b.id, label: b.name })),
                    ]}
                  />
                  <p className="text-sm text-neutral-500 mt-1 col-span-full">
                    Universal jobs are visible across all branches.
                  </p>
                </div>
              </Card>
            )}

            {/* Device Info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Device Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Device Type"
                  options={deviceTypes}
                  {...register("device_type")}
                  error={errors.device_type?.message}
                  required
                />
                <Input
                  label="Brand"
                  {...register("brand")}
                  error={errors.brand?.message}
                  required
                />
                <Input
                  label="Model"
                  {...register("model")}
                  error={errors.model?.message}
                  required
                />
                <Input
                  label="Serial Number (Optional)"
                  {...register("serial_number")}
                  error={errors.serial_number?.message}
                />
              </div>

              <div className="mt-4 pt-4 border-t border-neutral-100">
                <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                  Warranty Information
                </h4>
                <div className="space-y-4">
                  <div className="mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary-600 rounded border-neutral-300 focus:ring-primary-500"
                        {...register("is_warranty_repair")}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        Warranty Repair
                      </span>
                    </label>
                  </div>
                  {isWarrantyRepair && (
                    <div className="mt-4">
                      <Textarea
                        label="Warranty Details"
                        {...register("warranty_details")}
                        placeholder="Enter warranty details..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Accessories & Condition */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Accessories & Condition
              </h3>

              <div className="space-y-6">
                {/* Accessories Subsection */}
                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                    Accessories
                  </h4>
                  <AccessoriesChecklist
                    value={accessories}
                    onChange={setAccessories}
                  />
                </div>

                <div className="border-t border-neutral-100"></div>

                <div>
                  <h4 className="text-sm font-medium text-neutral-700 mb-3 uppercase tracking-wide">
                    Physical Condition
                  </h4>
                  <Textarea
                    label="Physical Condition"
                    {...register("physical_condition")}
                    error={errors.physical_condition?.message}
                    required
                    rows={2}
                  />
                </div>
              </div>
            </Card>

            {/* Problem Info */}
            <Card>
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">
                Problem Description
              </h3>
              <div className="space-y-4">
                <Textarea
                  label="Customer Complaint"
                  {...register("customer_complaint")}
                  error={errors.customer_complaint?.message}
                  required
                  rows={3}
                />

                <Textarea
                  label="Additional Comments"
                  {...register("additional_comments")}
                  placeholder="Extra notes..."
                  rows={2}
                />
              </div>
            </Card>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                size="lg"
                leftIcon={<Save className="w-5 h-5" />}
                isLoading={isPending}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
