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
import { jobsApi, branchesApi, dropdownOptionsApi } from "@/lib/api";
import {
  ArrowLeft,
  Check,
  Save,
  Printer,
  Laptop,
  HelpCircle,
  User,
} from "lucide-react";
import Link from "next/link";
import type { AccessoryType } from "@/types";

// =====================================================
// Validation Schema
// =====================================================

const editJobSchema = z.object({
  customer_id: z.string().optional(),
  device_type: z.string().min(1, "Device type is required"),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  serial_number: z.string().optional(),
  customer_complaint: z.string().min(10, "Please describe the issue in detail"),
  is_urgent: z.boolean().optional(),
  is_warranty_repair: z.boolean().optional(),
  warranty_details: z.string().optional(),
  diagnosis_notes: z.string().optional(),
  additional_comments: z.string().optional(),
});

type EditJobFormData = z.infer<typeof editJobSchema>;

// =====================================================
// Accessories Checklist Component
// =====================================================

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
    <div className="flex flex-wrap gap-2.5">
      {accessories.map((acc) => {
        const isChecked = value[acc]?.present || false;
        const label = acc.toLowerCase().replace("_", " ");

        return (
          <button
            key={acc}
            type="button"
            onClick={() => toggleAccessory(acc)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
              isChecked
                ? "bg-green-50 border-green-400 text-green-800 shadow-sm"
                : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
            }`}
          >
            {isChecked && <Check className="w-3 h-3 text-green-600" />}
            <span className="capitalize">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =====================================================
// Main Edit Job Page
// =====================================================

export default function EditJobPage() {
  const params = useParams();
  const jobId = params.id as string;
  const router = useRouter();
  const { hasPermission, isRole } = useAuth();
  const queryClient = useQueryClient();

  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  // Physical Condition chip state
  const [selectedPhysicalConditions, setSelectedPhysicalConditions] = useState<string[]>([]);
  const [physicalConditionOtherText, setPhysicalConditionOtherText] = useState("");

  // Engineer Diagnosis chip state
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [diagnosisOtherText, setDiagnosisOtherText] = useState("");

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

  // Fetch Dropdown Options for Physical Condition
  const { data: physicalConditionOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "PHYSICAL_CONDITION"],
    queryFn: () => dropdownOptionsApi.list({ category: "PHYSICAL_CONDITION" }),
  });

  // Fetch Dropdown Options for Engineer Diagnosis (device-type aware)
  const watchDeviceType = useForm<EditJobFormData>().watch?.("device_type");
  const { data: diagnosisOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "ENGINEER_DIAGNOSIS", job?.device_type],
    queryFn: () =>
      dropdownOptionsApi.list({
        category: "ENGINEER_DIAGNOSIS",
        device_type: job?.device_type,
      }),
    enabled: !!job?.device_type,
  });

  // Initialize form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<EditJobFormData>({
    resolver: zodResolver(editJobSchema),
  });

  const isWarrantyRepair = watch("is_warranty_repair");
  const currentDeviceType = watch("device_type");

  // Fetch diagnosis options when device type changes in form
  const { data: diagnosisOptionsDynamic = [] } = useQuery({
    queryKey: ["dropdown-options", "ENGINEER_DIAGNOSIS", currentDeviceType],
    queryFn: () =>
      dropdownOptionsApi.list({
        category: "ENGINEER_DIAGNOSIS",
        device_type: currentDeviceType,
      }),
    enabled: !!currentDeviceType,
  });

  const finalDiagnosisOptions =
    diagnosisOptionsDynamic.length > 0 ? diagnosisOptionsDynamic : diagnosisOptions;

  // Populate form when job data loads
  useEffect(() => {
    if (job) {
      reset({
        customer_id: job.customer?.id,
        device_type: job.device_type,
        brand: job.brand,
        model: job.model,
        serial_number: job.serial_number || "",
        customer_complaint: job.customer_complaint,
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
      job.accessories?.forEach((acc: any) => {
        accMap[acc.accessory_type as AccessoryType] = {
          present: acc.is_present,
          condition: acc.condition || "",
        };
      });
      setAccessories(accMap);

      // Parse physical_condition JSON -> chip state
      const pc = job.physical_condition;
      if (pc && typeof pc === "object" && !Array.isArray(pc)) {
        setSelectedPhysicalConditions(pc.selected || []);
        setPhysicalConditionOtherText(pc.other_text || "");
      } else if (typeof pc === "string" && pc) {
        // Legacy plain text — show as other_text
        setPhysicalConditionOtherText(pc);
      }

      // Parse engineer_diagnosis JSON -> chip state
      const ed = job.engineer_diagnosis;
      if (ed && typeof ed === "object" && !Array.isArray(ed)) {
        setSelectedDiagnoses(ed.selected || []);
        setDiagnosisOtherText(ed.other_text || "");
      } else if (typeof ed === "string" && ed) {
        setDiagnosisOtherText(ed);
      }

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

  // Update mutation
  const { mutate, isPending, error } = useMutation({
    mutationFn: async (data: EditJobFormData) => {
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
        accessories: accessoriesList,
        physical_condition: {
          selected: selectedPhysicalConditions,
          other_text: physicalConditionOtherText,
        },
        engineer_diagnosis: {
          selected: selectedDiagnoses,
          other_text: diagnosisOtherText,
        },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      router.push(`/jobs/${jobId}`);
    },
  });

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

  if (!isRole("OWNER", "SUPER_ADMIN")) {
    return (
      <AppLayout>
        <Alert variant="error">
          You do not have permission to edit this job.
        </Alert>
      </AppLayout>
    );
  }

  const deviceTypes = [
    { value: "LAPTOP", label: "Laptop" },
    { value: "DESKTOP", label: "Desktop" },
    { value: "ALL_IN_ONE", label: "All-in-One" },
    { value: "MONITOR", label: "Monitor" },
    { value: "PRINTER", label: "Printer" },
    { value: "UPS", label: "UPS" },
    { value: "OTHER", label: "Other" },
  ];

  return (
    <ProtectedRoute requiredPermission="canViewJobCards">
      <AppLayout>
        <Header
          title={`Edit Job: ${job.job_number}`}
          subtitle="Modify job details — Owner Access"
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

        <div className="p-6 w-full max-w-[1920px] mx-auto">
          {error && (
            <Alert variant="error" className="mb-6">
              {(error as Error).message}
            </Alert>
          )}

          <form onSubmit={handleSubmit((d) => mutate(d))}>
            {/* 2-Column Layout matching create form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 xl:gap-8">

              {/* LEFT COLUMN */}
              <div className="space-y-6">

                {/* Customer Info (Read-Only) */}
                <Card className="border border-neutral-200 shadow-sm p-5">
                  <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-500" />
                    Customer (Read-Only)
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-neutral-500 text-xs uppercase tracking-wide">Name</label>
                      <p className="font-semibold text-neutral-800 mt-0.5">
                        {job.customer?.first_name} {job.customer?.last_name}
                      </p>
                    </div>
                    <div>
                      <label className="text-neutral-500 text-xs uppercase tracking-wide">Mobile</label>
                      <p className="font-semibold text-neutral-800 mt-0.5">{job.customer?.mobile}</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 mt-3 border-t border-neutral-100 pt-2">
                    To change the customer, create a new job card.
                  </p>
                </Card>

                {/* Branch Selection (Owners Only) */}
                {hasPermission("canManageBranches") && (
                  <Card className="border border-neutral-200 shadow-sm p-5">
                    <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <Printer className="w-5 h-5 text-primary-500" />
                      Branch Assignment
                    </h3>
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
                    <p className="text-sm text-neutral-500 mt-1">
                      Universal jobs are visible across all branches.
                    </p>
                  </Card>
                )}

                {/* Device Details */}
                <Card className="border border-neutral-200 shadow-sm p-5 flex-1">
                  <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                    <Laptop className="w-5 h-5 text-primary-500" />
                    Device Specifications
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
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
                    />
                  </div>

                  <div className="mt-6 pt-5 border-t border-neutral-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <span className="text-sm font-semibold text-neutral-800">Is this a warranty repair?</span>
                      <div className="flex bg-neutral-100/80 rounded-lg p-1 border border-neutral-200/50">
                        <button
                          type="button"
                          className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
                            isWarrantyRepair === true
                              ? "bg-white text-primary-700 shadow-sm ring-1 ring-black/5"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                          onClick={() => setValue("is_warranty_repair", true)}
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${
                            !isWarrantyRepair
                              ? "bg-white text-neutral-800 shadow-sm ring-1 ring-black/5"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                          onClick={() => setValue("is_warranty_repair", false)}
                        >
                          No
                        </button>
                      </div>
                    </div>
                    {isWarrantyRepair && (
                      <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                        <Input
                          placeholder="Enter warranty card #, dates, coverage details..."
                          {...register("warranty_details")}
                        />
                      </div>
                    )}
                  </div>
                </Card>

              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-6">

                {/* Accessories & Physical Condition */}
                <Card className="border border-neutral-200 shadow-sm p-5">
                  <h3 className="text-base font-bold text-neutral-900 mb-4">
                    Items &amp; Condition
                  </h3>

                  <div className="space-y-6">
                    {/* Accessories */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Included Accessories
                      </h4>
                      <AccessoriesChecklist
                        value={accessories}
                        onChange={setAccessories}
                      />
                    </div>

                    <div className="border-t border-neutral-100" />

                    {/* Physical Condition Chips */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Physical Condition
                      </h4>
                      {physicalConditionOptions.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {physicalConditionOptions.map((option: any) => {
                              const isChecked = selectedPhysicalConditions.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPhysicalConditions((prev) =>
                                      isChecked
                                        ? prev.filter((id) => id !== option.id)
                                        : [...prev, option.id],
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                    isChecked
                                      ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 text-amber-600" />}
                                  <span>{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {selectedPhysicalConditions.some((id) =>
                            physicalConditionOptions.find(
                              (o: any) => o.id === id && o.has_text_input,
                            ),
                          ) && (
                            <div className="mt-3 animate-in fade-in">
                              <Input
                                placeholder="Please describe 'Other' physical condition..."
                                value={physicalConditionOtherText}
                                onChange={(e) =>
                                  setPhysicalConditionOtherText(e.target.value)
                                }
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-neutral-500 font-medium bg-neutral-100 p-3 rounded-lg border border-neutral-200">
                          No quick-select presets available.
                        </p>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Problem Description & Diagnosis */}
                <Card className="border border-neutral-200 shadow-sm p-5 flex-1">
                  <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-primary-500" />
                    Diagnosis &amp; Remarks
                  </h3>

                  <div className="space-y-5">
                    <Textarea
                      label="Customer Complaint"
                      {...register("customer_complaint")}
                      error={errors.customer_complaint?.message}
                      required
                      rows={3}
                      className="text-sm"
                    />

                    {/* Engineer Diagnosis Chips */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Engineer Diagnosis {currentDeviceType ? `(${currentDeviceType})` : ""}
                      </h4>
                      {finalDiagnosisOptions.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {finalDiagnosisOptions.map((option: any) => {
                              const isChecked = selectedDiagnoses.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDiagnoses((prev) =>
                                      isChecked
                                        ? prev.filter((id) => id !== option.id)
                                        : [...prev, option.id],
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                    isChecked
                                      ? "bg-blue-50 border-blue-300 text-blue-800 shadow-sm"
                                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  <span>{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                          {selectedDiagnoses.some((id) =>
                            finalDiagnosisOptions.find(
                              (o: any) => o.id === id && o.has_text_input,
                            ),
                          ) && (
                            <div className="mt-3 animate-in fade-in">
                              <Input
                                placeholder="Specify other diagnosis..."
                                value={diagnosisOtherText}
                                onChange={(e) => setDiagnosisOtherText(e.target.value)}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-neutral-500 font-medium bg-neutral-100 p-3 rounded-lg border border-neutral-200">
                          No quick-select presets available for{" "}
                          {currentDeviceType?.toLowerCase() || "this device type"}.
                        </p>
                      )}
                    </div>

                    <Textarea
                      label="Internal Notes"
                      {...register("additional_comments")}
                      placeholder="Extra notes (optional)..."
                      rows={2}
                      className="text-sm bg-neutral-50"
                    />
                  </div>
                </Card>

              </div>
            </div>

            {/* Sticky Bottom Footer */}
            <div className="mt-8 bg-white border border-neutral-200 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 sticky bottom-6 z-10 ring-4 ring-neutral-50/50">
              <div className="flex items-center gap-6 w-full sm:w-auto">
                <label className="relative inline-flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    {...register("is_urgent")}
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 group-hover:after:shadow-sm" />
                  <span className="ml-3 text-sm font-bold text-neutral-700 group-hover:text-red-600 transition-colors uppercase tracking-wider">
                    Emergency / Urgent
                  </span>
                </label>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <Link href={`/jobs/${jobId}`} className="w-full sm:w-auto">
                  <Button variant="secondary" type="button" className="w-full font-semibold">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  size="lg"
                  leftIcon={<Save className="w-5 h-5" />}
                  isLoading={isPending}
                  className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 shadow-md font-bold px-8"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
