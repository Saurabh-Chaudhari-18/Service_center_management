"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { Button, Input, Select } from "@/components/ui";
import { customersApi, branchesApi } from "@/lib/api";

const customerSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  address_line1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter valid 6-digit pincode")
    .optional()
    .or(z.literal("")),
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
}

export function CustomerCreateForm({
  initialBranchId,
  onSuccess,
  actionsMode,
  onCancel,
}: CustomerCreateFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
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
      customersApi.create({
        ...data,
        branch: selectedBranchId === "universal" ? undefined : selectedBranchId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      reset();
      onSuccess();
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
                { value: "universal", label: "🌍 Universal / All Branches" },
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
        <div className="md:col-span-2">
          <Input label="Address" {...register("address_line1")} />
        </div>
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
        <Input
          label="Pincode"
          {...register("pincode")}
          error={errors.pincode?.message}
          placeholder="6-digit pincode"
        />
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
              onClick={() => router.push("/customers")}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isPending}>
              Add Customer
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
