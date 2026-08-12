"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Button, Checkbox, Input, Select } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { customersApi, branchesApi } from "@/lib/api";
import type { Customer } from "@/types";

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  alternate_mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number").optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter valid 6-digit pincode")
    .optional()
    .or(z.literal("")),
  state_code: z.string().regex(/^\d{2}$/, "Enter a 2-digit state code").optional().or(z.literal("")),
  company_name: z.string().optional(),
  gstin: z.string().regex(/^[0-9A-Z]{15}$/, "Enter a valid 15-character GSTIN").optional().or(z.literal("")),
  sms_enabled: z.boolean(),
  whatsapp_enabled: z.boolean(),
  notes: z.string().optional(),
  branch: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;

type ActionsMode = "modal" | "page";

interface CustomerCreateFormProps {
  initialBranchId: string;
  onSuccess: () => void;
  actionsMode: ActionsMode;
  onCancel?: () => void;
  customerId?: string;
  initialValues?: Partial<CustomerFormData>;
}

export function CustomerCreateForm({
  initialBranchId,
  onSuccess,
  actionsMode,
  onCancel,
  customerId,
  initialValues,
}: CustomerCreateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, isRole } = useAuth();
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      sms_enabled: true,
      whatsapp_enabled: true,
      ...initialValues,
      branch: initialBranchId,
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
    enabled: hasPermission("canManageBranches"),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CustomerFormData) =>
      customerId
        ? customersApi.update(customerId, {
            ...data,
            branch: selectedBranchId === "universal" ? undefined : selectedBranchId,
          } as Partial<Customer>)
        : customersApi.create({
            ...data,
            branch: selectedBranchId === "universal" ? undefined : selectedBranchId,
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      }
      toast.success(customerId ? "Customer updated successfully." : "Customer created successfully.");
      reset();
      onSuccess();
    },
    onError: (error: { response?: { data?: { detail?: string } }; message?: string }) => {
      toast.error(
        `Failed to ${customerId ? "update" : "create"} customer: ` +
          (error.response?.data?.detail || error.message || "Unknown error"),
      );
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {hasPermission("canManageBranches") && (
          <div className="md:col-span-2">
            <Select
              label="Assign to Branch"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              options={[
                ...(isRole("SUPER_ADMIN") ? [{ value: "universal", label: "🌍 Universal / All Branches" }] : []),
                ...(Array.isArray(branches)
                  ? branches
                  : Object.hasOwn(branches, "results")
                    ? (branches as { results: { id: string; name: string }[] }).results
                    : []
                ).map((b: { id: string; name: string }) => ({
                  value: b.id,
                  label: b.name,
                })),
              ]}
            />
          </div>
        )}
        <Input
          label="First Name"
          {...register("first_name")}
          error={errors.first_name?.message}
          required
        />
        <Input label="Last Name" {...register("last_name")} />
        <Input
          label="Mobile Number"
          {...register("mobile")}
          error={errors.mobile?.message}
          required
          placeholder="10-digit number"
        />
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input
          label="Alternate Mobile"
          {...register("alternate_mobile")}
          error={errors.alternate_mobile?.message}
          placeholder="10-digit number"
        />
        <Input label="Company Name" {...register("company_name")} />
        <div className="md:col-span-2">
          <Input label="Address line 1" {...register("address_line1")} />
        </div>
        <div className="md:col-span-2"><Input label="Address line 2" {...register("address_line2")} /></div>
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
        <Input
          label="Pincode"
          {...register("pincode")}
          error={errors.pincode?.message}
          placeholder="6-digit pincode"
        />
        <Input label="State Code" {...register("state_code")} error={errors.state_code?.message} placeholder="e.g. 27" />
        <Input label="GSTIN" {...register("gstin")} error={errors.gstin?.message} placeholder="15-character GSTIN" />
        <div className="md:col-span-2 grid gap-3 sm:grid-cols-2">
          <Checkbox
            label="Allow service updates by SMS"
            containerClassName="rounded-lg border border-neutral-200 p-3 dark:border-slate-700"
            {...register("sms_enabled")}
          />
          <Checkbox
            label="Allow service updates by WhatsApp"
            containerClassName="rounded-lg border border-neutral-200 p-3 dark:border-slate-700"
            {...register("whatsapp_enabled")}
          />
        </div>
        <div className="md:col-span-2">
          <Input
            label="Notes"
            {...register("notes")}
            placeholder="Internal notes"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-100">
        {actionsMode === "modal" ? (
          <>
            <Button variant="secondary" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Add Customer
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              type="button"
              onClick={() => customerId ? router.push(`/customers/${customerId}`) : router.push("/customers")}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              {customerId ? "Save Changes" : "Add Customer"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
