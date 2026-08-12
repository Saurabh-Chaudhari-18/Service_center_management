"use client";

// Interactive feature island rendered by the server route entry.

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Switch,
} from "@/components/ui";
import { PageShell } from "@/components/shell";
import { jobsApi, branchesApi, dropdownOptionsApi } from "@/lib/api";
import {
  ArrowLeft,
  User,
  Laptop,
  HelpCircle,
  Check,
  AlertCircle,
  Building2,
  ChevronRight,
  ChevronLeft,
  Wrench,
} from "lucide-react";
import type { Customer, DeviceType, AccessoryType } from "@/types";
import { createJobSchema, type CreateJobFormData, STEP1_FIELDS } from "./schema";
import {
  AccessoriesChecklist,
  CustomerSearch,
  IntakeSummary,
  StepIndicator,
} from "./components";
import { cleanDropdownLabel } from "@/lib/formatters";

// =====================================================
// Validation Schema
// =====================================================

export default function CreateJobCardPage() {
  const router = useRouter();
  const { currentBranch, hasPermission, isRole } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [accessories, setAccessories] = useState<
    Partial<Record<AccessoryType, { present: boolean; condition: string }>>
  >({});

  const [serviceCharge, setServiceCharge] = useState("");
  const [accessoryManualDetails, setAccessoryManualDetails] = useState("");

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    trigger,
  } = useForm<CreateJobFormData>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      device_type: "LAPTOP",
      is_urgent: false,
      is_warranty_repair: false,
      physical_condition: { selected: [], other_text: "" },
      engineer_diagnosis: { selected: [], other_text: "" },
      received_date: getLocalDateString(),
    },
  });

  const [selectedPhysicalConditions, setSelectedPhysicalConditions] = useState<string[]>([]);
  const [physicalConditionOtherText, setPhysicalConditionOtherText] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const [diagnosisOtherText, setDiagnosisOtherText] = useState("");

  const { data: physicalConditionOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "PHYSICAL_CONDITION"],
    queryFn: () => dropdownOptionsApi.list({ category: "PHYSICAL_CONDITION" }),
  });

  const watchDeviceType = watch("device_type");

  const { data: diagnosisOptions = [] } = useQuery({
    queryKey: ["dropdown-options", "ENGINEER_DIAGNOSIS", watchDeviceType],
    queryFn: () => dropdownOptionsApi.list({ category: "ENGINEER_DIAGNOSIS", device_type: watchDeviceType }),
    enabled: !!watchDeviceType,
  });

  useEffect(() => {
    setSelectedDiagnoses([]);
    setDiagnosisOtherText("");
  }, [watchDeviceType]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const hasUnsavedData = isDirty || selectedCustomer !== null || serviceCharge !== "";
    if (!hasUnsavedData) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, selectedCustomer, serviceCharge]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });

  useEffect(() => {
    if (currentBranch?.id && !selectedBranchId) {
      setSelectedBranchId(currentBranch.id);
    }
  }, [currentBranch, selectedBranchId]);

  useEffect(() => {
    const presentAccessories = Object.entries(accessories)
      .filter(([, v]) => v.present)
      .map(([k]) => {
        const labels: Record<string, string> = {
          CHARGER: "Charger/Adapter",
          BATTERY: "Battery",
          BAG: "Laptop Bag",
          MOUSE: "Mouse",
          KEYBOARD: "Keyboard",
          POWER_CABLE: "Power Cable",
          USB_CABLE: "USB Cable",
          HDMI_CABLE: "HDMI Cable",
          RAM: "RAM Module",
          HDD: "Hard Drive",
          SSD: "SSD",
          OTHER: "Other",
        };
        return labels[k] || k;
      });

    if (presentAccessories.length > 0) {
      setAccessoryManualDetails((prev) => {
        const lines = prev.split("\n");
        let newText = prev;

        presentAccessories.forEach((label) => {
          const hasLabel = lines.some((line) =>
            line.toLowerCase().includes(label.toLowerCase())
          );
          if (!hasLabel) {
            newText += (newText ? "\n" : "") + `${label}: `;
          }
        });
        return newText;
      });
    }
  }, [accessories]);

  React.useEffect(() => {
    if (selectedCustomer) {
      setValue("customer_id", selectedCustomer.id, { shouldValidate: true });
    } else {
      setValue("customer_id", "");
    }
  }, [selectedCustomer, setValue]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateJobFormData) =>
      jobsApi.create({
        ...data,
        branch: selectedBranchId === "universal" ? null : selectedBranchId,
        device_type: data.device_type as DeviceType,
        estimated_cost: serviceCharge ? parseFloat(serviceCharge) : undefined,
        physical_condition: {
          selected: selectedPhysicalConditions,
          other_text: physicalConditionOtherText,
        },
        engineer_diagnosis: {
          selected: selectedDiagnoses,
          other_text: diagnosisOtherText,
        },
        accessories: Object.entries(accessories)
          .filter(([, v]) => v.present)
          .map(([type, v]) => {
            const label =
              type === "CHARGER"
                ? "Charger/Adapter"
                : type === "BATTERY"
                  ? "Battery"
                  : type === "BAG"
                    ? "Laptop Bag"
                    : type === "SSD"
                      ? "SSD"
                      : type === "HDD"
                        ? "Hard Drive"
                        : type === "RAM"
                          ? "RAM Module"
                          : type;

            const lines = accessoryManualDetails.split("\n");
            const matchingLine = lines.find((line) =>
              line.toLowerCase().includes(label.toLowerCase())
            );
            const description = matchingLine
              ? matchingLine.replace(new RegExp(`^.*?${label}:?\\s*`, "i"), "")
              : v.condition;

            return {
              accessory_type: type as AccessoryType,
              is_present: true,
              condition: v.condition,
              description: description || v.condition,
            };
          }),
        diagnosis_notes: data.diagnosis_notes || undefined,
      }),
    onSuccess: (job) => {
      router.push(`/jobs/${job.id}`);
    },
  });

  const deviceTypes = [
    { value: "LAPTOP", label: "Laptop" },
    { value: "DESKTOP", label: "Desktop" },
    { value: "ALL_IN_ONE", label: "All-in-One" },
    { value: "MONITOR", label: "Monitor" },
    { value: "PRINTER", label: "Printer" },
    { value: "UPS", label: "UPS" },
    { value: "OTHER", label: "Other" },
  ];

  // Validate Step 1 required fields before advancing
  const handleNextStep = async () => {
    const valid = await trigger(STEP1_FIELDS as unknown as (keyof CreateJobFormData)[]);
    if (valid) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!currentBranch) {
    return (
      <ProtectedRoute requiredPermission="canCreateJobCards">
        <AppLayout>
          <PageShell width="wizard">
            <Alert variant="error">
              Please select a branch to create a job card.
            </Alert>
          </PageShell>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="canCreateJobCards">
      <AppLayout>
        <Header
          title="Create Job Card"
          subtitle="Register a new device for service"
          breadcrumbs={[
            { label: "Job Cards", href: "/jobs" },
            { label: "New Job Card" },
          ]}
          actions={
            <Button
              variant="ghost"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => router.push("/jobs")}
            >
              Go Back
            </Button>
          }
        />

        <PageShell width="wizard" className="pb-32 sm:pb-6">
          {error && (
            <Alert variant="error" className="mb-6" title="Error">
              {error.message}
            </Alert>
          )}

          <StepIndicator step={step} />

          <form onSubmit={handleSubmit((d) => mutate(d))}>

            {/* ── STEP 1: INTAKE ── */}
            {step === 1 && (
              <div className="space-y-6">

                  <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                    <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary-500" />
                      Intake Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {hasPermission("canManageBranches") ? (
                        <Select
                          label="Assign to Branch"
                          value={selectedBranchId}
                          onChange={(e) => setSelectedBranchId(e.target.value)}
                          options={[
                            ...(isRole("SUPER_ADMIN")
                              ? [{
                                  value: "universal",
                                  label: "🌍 Universal / All Branches",
                                }]
                              : []),
                            ...(Array.isArray(branches)
                              ? branches
                              : Object.hasOwn(branches, "results")
                                ? (branches as { results: { id: string; name: string }[] }).results
                                : []
                            ).map((b: { id: string; name: string }) => ({ value: b.id, label: b.name })),
                          ]}
                        />
                      ) : (
                        <Input
                          label="Branch"
                          value={currentBranch.name}
                          disabled
                          readOnly
                        />
                      )}
                      <Input
                        type="date"
                        label="Received Date"
                        {...register("received_date")}
                        error={errors.received_date?.message}
                        required
                      />
                    </div>
                  </Card>

                  <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                    <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <User className="w-5 h-5 text-primary-500" />
                      Customer Details
                    </h3>
                    <CustomerSearch
                      onSelect={setSelectedCustomer}
                      selectedCustomer={selectedCustomer}
                      branchId={currentBranch.id}
                    />
                    {errors.customer_id && (
                      <p className="mt-3 text-sm text-red-600 flex items-center gap-1.5 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-100">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errors.customer_id.message}
                      </p>
                    )}
                  </Card>

                  <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
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
                        placeholder="e.g., Dell, Apple"
                        {...register("brand")}
                        error={errors.brand?.message}
                        required
                      />
                      <Input
                        label="Model"
                        placeholder="e.g., XPS 15"
                        {...register("model")}
                        error={errors.model?.message}
                        required
                      />
                      <Input
                        label="Serial Number"
                        placeholder="Optional"
                        {...register("serial_number")}
                      />
                      <div className="sm:col-span-2">
                        <Input
                          label="Device Password"
                          type="text"
                          placeholder="Login passcode (if applicable)"
                          {...register("device_password")}
                          helperText="Stored securely, visible only to authorized staff."
                        />
                      </div>
                    </div>

                    <div className="mt-6 pt-5 border-t border-neutral-100">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold text-neutral-800">Is this a warranty repair?</span>
                        <div className="flex bg-neutral-100/80 rounded-lg p-1 border border-neutral-200/50">
                          <button type="button" className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${watch("is_warranty_repair") === true ? "bg-white text-primary-700 shadow-sm ring-1 ring-black/5" : "text-neutral-500 hover:text-neutral-700"}`} onClick={() => setValue("is_warranty_repair", true)}>Yes</button>
                          <button type="button" className={`px-5 py-1.5 text-sm font-bold rounded-md transition-all ${!watch("is_warranty_repair") ? "bg-white text-neutral-800 shadow-sm ring-1 ring-black/5" : "text-neutral-500 hover:text-neutral-700"}`} onClick={() => setValue("is_warranty_repair", false)}>No</button>
                        </div>
                      </div>
                      {watch("is_warranty_repair") && (
                        <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                          <Input placeholder="Warranty card #, dates, coverage details..." {...register("warranty_details")} />
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                    <h3 className="text-base font-bold text-neutral-900 mb-3 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-primary-500" />
                      Customer Complaint <span className="text-red-500 ml-0.5">*</span>
                    </h3>
                    <Textarea
                      placeholder="Describe the issue reported by the customer..."
                      {...register("customer_complaint")}
                      error={errors.customer_complaint?.message}
                      rows={3}
                      className="text-sm shadow-inner bg-white"
                    />
                  </Card>

              </div>
            )}

            {/* ── STEP 2: DIAGNOSIS ── */}
            {step === 2 && (
              <div className="max-w-2xl mx-auto space-y-6">

                <IntakeSummary
                  customer={selectedCustomer}
                  brand={watch("brand")}
                  model={watch("model")}
                  complaint={watch("customer_complaint")}
                  isUrgent={!!watch("is_urgent")}
                  onEdit={handleBack}
                />

                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                  <h3 className="text-base font-bold text-neutral-900 mb-4">
                    Items & Condition
                  </h3>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Included Accessories
                      </h4>
                      <AccessoriesChecklist
                        value={accessories}
                        onChange={setAccessories}
                      />
                      {Object.values(accessories).some(a => a?.present) && (
                        <div className="mt-3 animate-in fade-in">
                          <Textarea
                            placeholder="Add Serial Numbers or specific notes for accessories..."
                            value={accessoryManualDetails}
                            onChange={(e) => setAccessoryManualDetails(e.target.value)}
                            rows={2}
                            className="text-sm bg-neutral-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="border-t border-neutral-100" />

                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Physical Condition
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {physicalConditionOptions.map((option) => {
                          const isChecked = selectedPhysicalConditions.includes(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => {
                                setSelectedPhysicalConditions(prev =>
                                  isChecked
                                    ? prev.filter(id => id !== option.id)
                                    : [...prev, option.id]
                                );
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                isChecked
                                  ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                                  : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5 text-amber-600" />}
                              <span>{cleanDropdownLabel(option.label)}</span>
                            </button>
                          );
                        })}
                      </div>
                      {selectedPhysicalConditions.some(id =>
                        physicalConditionOptions.find(o => o.id === id && o.has_text_input)
                      ) && (
                        <div className="mt-3 animate-in fade-in">
                          <Input
                            placeholder="Please describe 'Other' physical condition..."
                            value={physicalConditionOtherText}
                            onChange={(e) => setPhysicalConditionOtherText(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="border border-neutral-200 shadow-sm p-5 hover:border-neutral-300 transition-colors">
                  <h3 className="text-base font-bold text-neutral-900 mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary-500" />
                    Diagnosis & Remarks
                    <span className="text-xs font-normal text-neutral-400 ml-1">(optional — can be filled later)</span>
                  </h3>

                  <div className="space-y-5">
                    {/* Engineer Diagnosis Chips */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-500 mb-2.5 uppercase tracking-wider">
                        Initial Diagnosis ({watchDeviceType})
                      </h4>
                      {diagnosisOptions.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {diagnosisOptions.map((option) => {
                              const isChecked = selectedDiagnoses.includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDiagnoses(prev =>
                                      isChecked
                                        ? prev.filter(id => id !== option.id)
                                        : [...prev, option.id]
                                    );
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold cursor-pointer ${
                                    isChecked
                                      ? "bg-blue-50 border-blue-300 text-blue-800 shadow-sm"
                                      : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300"
                                  }`}
                                >
                                  {isChecked && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                  <span>{cleanDropdownLabel(option.label)}</span>
                                </button>
                              );
                            })}
                          </div>
                          {selectedDiagnoses.some(id =>
                            diagnosisOptions.find(o => o.id === id && o.has_text_input)
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
                          No quick-select presets available for {watchDeviceType.toLowerCase()}.
                        </p>
                      )}
                    </div>

                    <Textarea
                      label="Internal Notes"
                      placeholder="Additional comments (optional)..."
                      {...register("additional_comments")}
                      rows={2}
                      className="text-sm bg-neutral-50"
                    />
                  </div>
                </Card>

              </div>
            )}

            {/* ── STICKY FOOTER ── */}
            <div className="mt-8 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 fixed sm:sticky bottom-0 sm:bottom-6 left-0 right-0 sm:left-auto sm:right-auto z-10 sm:ring-4 ring-neutral-50/50 dark:ring-slate-900/40 sm:mx-0 mx-4">

              {step === 1 && (
                <>
                  <div className="flex items-center gap-6 w-full sm:w-auto">
                    <Switch
                      label="Emergency / Urgent"
                      {...register("is_urgent")}
                    />

                    <div className="w-[200px]">
                      <Input
                        placeholder="Cost Estimate"
                        value={serviceCharge}
                        onChange={(e) => setServiceCharge(e.target.value)}
                        leftIcon={<span className="text-neutral-500 font-bold px-1">₹</span>}
                        className="bg-neutral-50 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      variant="secondary"
                      type="button"
                      className="w-full font-semibold"
                      onClick={() => router.push("/jobs")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNextStep}
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                      className="w-full sm:w-auto font-bold px-8 text-base"
                    >
                      Next: Diagnosis
                    </Button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <p className="text-sm text-neutral-500 hidden sm:block">
                    All fields on this step are optional — submit now or add diagnosis details above.
                  </p>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleBack}
                      leftIcon={<ChevronLeft className="w-4 h-4" />}
                      className="w-full sm:w-auto font-semibold"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      isLoading={isPending}
                      className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 shadow-md font-bold px-8 text-base"
                    >
                      Save Job Card
                    </Button>
                  </div>
                </>
              )}

            </div>

          </form>
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
