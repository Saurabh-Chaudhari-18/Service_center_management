"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Modal, Button, Input, Select } from "@/components/ui";
import { inventoryApi } from "@/lib/api";

const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  cost_price: z.number().min(0, "Must be positive"),
  selling_price: z.number().min(0, "Must be positive"),
  gst_rate: z.number().min(0).max(100),
  hsn_code: z.string().optional(),
  low_stock_threshold: z.number().min(0),
  unit: z.string().min(1),
  vendor_name: z.string().optional(),
  vendor_contact: z.string().optional(),
});

type ItemFormData = z.infer<typeof itemSchema>;

interface FastCreateInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  branchId: string;
}

export function FastCreateInventoryModal({
  isOpen,
  onClose,
  branchId,
}: FastCreateInventoryModalProps) {
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["inventory-categories"],
    queryFn: () => inventoryApi.listCategories(branchId),
    enabled: isOpen,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      gst_rate: 18,
      low_stock_threshold: 5,
      unit: "PCS",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset({
        name: "",
        sku: "",
        description: "",
        category: "",
        cost_price: 0 as unknown as number,
        selling_price: 0 as unknown as number,
        gst_rate: 18,
        hsn_code: "",
        low_stock_threshold: 5,
        unit: "PCS",
        vendor_name: "",
        vendor_contact: "",
      });
    }
  }, [isOpen, reset]);

  const { mutate, isPending, error: mutationError } = useMutation({
    mutationFn: (data: ItemFormData) => {
      const cleaned = {
        ...data,
        category: data.category ? data.category : undefined,
      };
      return inventoryApi.create({ ...cleaned, branch: branchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["category-stats"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
      reset();
      onClose();
    },
  });

  const categoryOptions = [
    { value: "", label: "— No Category —" },
    ...(Array.isArray(categories) ? categories : []).map((c: { id: string; name: string }) => ({
      value: c.id,
      label: c.name,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Add Inventory Item"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit((d) => mutate(d))} isLoading={isPending}>
            Add Item
          </Button>
        </>
      }
    >
      {mutationError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <strong>Error:</strong> {(mutationError as Error).message}
        </div>
      )}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Item Name" {...register("name")} error={errors.name?.message} required />
          <Input label="SKU" {...register("sku")} />
          <Select label="Category" options={categoryOptions} {...register("category")} />
          <Input label="Unit" {...register("unit")} placeholder="PCS, NOS, SET" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Cost Price (₹)" type="number" step="0.01" {...register("cost_price", { valueAsNumber: true })} error={errors.cost_price?.message} required />
          <Input label="Selling Price (₹)" type="number" step="0.01" {...register("selling_price", { valueAsNumber: true })} error={errors.selling_price?.message} required />
        </div>
      </div>
    </Modal>
  );
}
