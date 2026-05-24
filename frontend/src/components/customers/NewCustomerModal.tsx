"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "@/lib/api";
import { Modal, Button, Input, Alert } from "@/components/ui";
import type { Customer } from "@/types";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().optional(),
  mobile: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  city: z.string().optional(),
  state: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  branchId: string;
  initialMobile?: string;
}

export function NewCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
  branchId,
  initialMobile = "",
}: NewCustomerModalProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { mobile: initialMobile.replace(/\D/g, "").slice(-10) },
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: FormData) =>
      customersApi.create({ ...data, branch: branchId }),
    onSuccess: (customer: Customer) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCustomerCreated(customer);
      reset();
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Customer"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((d) => mutate(d))} isLoading={isPending}>
            Add Customer
          </Button>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {(error as Error).message}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="First Name"
          {...register("first_name")}
          error={errors.first_name?.message}
          required
        />
        <Input label="Last Name" {...register("last_name")} error={errors.last_name?.message} />
        <Input
          label="Mobile Number"
          {...register("mobile")}
          error={errors.mobile?.message}
          required
          placeholder="10-digit mobile number"
        />
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
        />
        <Input label="City" {...register("city")} />
        <Input label="State" {...register("state")} />
      </div>
    </Modal>
  );
}
