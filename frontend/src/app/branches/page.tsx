"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Button, Input, Badge, Modal, LoadingState } from "@/components/ui"; // Assuming Modal exists, if not I'll need to check or build a simple one
import { branchesApi } from "@/lib/api";
import { Branch } from "@/types";
import { Plus, Edit2, MapPin, Phone, Mail, Hash } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// =====================================================
// Branch Form Schema
// =====================================================

const branchSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  address_line1: z.string().min(1, "Address is required"),
  address_line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(6, "Invalid pincode"),
  gstin: z.string().optional().or(z.literal("")),
  state_code: z.string().optional().or(z.literal("")),
  invoice_prefix: z.string().min(1, "Invoice prefix is required"),
  jobcard_prefix: z.string().min(1, "Job card prefix is required"),
  default_gst_rate: z.coerce.number().min(0).max(100),
  sms_enabled: z.boolean().default(false),
  whatsapp_enabled: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type BranchFormData = z.infer<typeof branchSchema>;

// =====================================================
// Branch Modal Component
// =====================================================

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  branch?: Branch | null;
}

function BranchModal({ isOpen, onClose, branch }: BranchModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!branch;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema) as Resolver<BranchFormData>,
    defaultValues: branch
      ? {
          ...branch,
          default_gst_rate: Number(branch.default_gst_rate),
          address_line2: branch.address_line2 || "",
          gstin: branch.gstin || "",
          state_code: branch.state_code || "",
          invoice_prefix: branch.invoice_prefix || "",
          jobcard_prefix: branch.jobcard_prefix || "",
        }
      : {
          default_gst_rate: 18,
          sms_enabled: false,
          whatsapp_enabled: false,
          is_active: true,
          invoice_prefix: "INV",
          jobcard_prefix: "JC",
          gstin: "",
          state_code: "",
        },
  });

  const mutation = useMutation({
    mutationFn: (data: BranchFormData) => {
      // Clean up empty optional fields so they don't fail backend validation
      const payload = { ...data };
      if (!payload.gstin) delete payload.gstin;
      if (!payload.state_code) delete payload.state_code;
      if (!payload.address_line2) delete payload.address_line2;

      if (isEditing && branch) {
        return branchesApi.update(branch.id, payload);
      }
      return branchesApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      toast.success(isEditing ? "Branch updated" : "Branch created");
      onClose();
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save branch");
    },
  });

  // Reset form when branch changes
  React.useEffect(() => {
    if (isOpen) {
      reset(
        branch
          ? {
              ...branch,
              default_gst_rate: Number(branch.default_gst_rate),
              address_line2: branch.address_line2 || "",
              gstin: branch.gstin || "",
              state_code: branch.state_code || "",
              invoice_prefix: branch.invoice_prefix || "",
              jobcard_prefix: branch.jobcard_prefix || "",
            }
          : {
              default_gst_rate: 18,
              sms_enabled: false,
              whatsapp_enabled: false,
              is_active: true,
              invoice_prefix: "INV",
              jobcard_prefix: "JC",
              gstin: "",
              state_code: "",
            },
      );
    }
  }, [branch, isOpen, reset]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Branch" : "Add New Branch"}
      size="xl"
    >
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <Input
              label="Branch Name"
              {...register("name")}
              error={errors.name?.message}
            />
          </div>
          <div className="col-span-2 md:col-span-1">
            <Input
              label="Branch Code"
              {...register("code")}
              error={errors.code?.message}
            />
          </div>

          <Input
            label="Email"
            type="email"
            {...register("email")}
            error={errors.email?.message}
          />
          <Input
            label="Phone"
            {...register("phone")}
            error={errors.phone?.message}
          />

          <div className="col-span-2 text-neutral-900 font-medium pb-2 border-b">
            Address Details
          </div>

          <div className="col-span-2">
            <Input
              label="Address Line 1"
              {...register("address_line1")}
              error={errors.address_line1?.message}
            />
          </div>
          <div className="col-span-2">
            <Input
              label="Address Line 2"
              {...register("address_line2")}
              error={errors.address_line2?.message}
            />
          </div>
          <Input
            label="City"
            {...register("city")}
            error={errors.city?.message}
          />
          <Input
            label="State"
            {...register("state")}
            error={errors.state?.message}
          />
          <Input
            label="Pincode"
            {...register("pincode")}
            error={errors.pincode?.message}
          />

          <div className="col-span-2 text-neutral-900 font-medium pb-2 border-b mt-2">
            Configurations
          </div>

          <Input
            label="GSTIN"
            placeholder="e.g. 27ABCDE1234F1Z5"
            {...register("gstin")}
            error={errors.gstin?.message}
          />
          <Input
            label="State Code"
            placeholder="e.g. 27 for Maharashtra"
            {...register("state_code")}
            error={errors.state_code?.message}
          />
          <Input
            label="Default GST Rate (%)"
            type="number"
            {...register("default_gst_rate")}
            error={errors.default_gst_rate?.message}
          />
          <Input
            label="Invoice Prefix"
            {...register("invoice_prefix")}
            error={errors.invoice_prefix?.message}
          />
          <Input
            label="Job Card Prefix"
            {...register("jobcard_prefix")}
            error={errors.jobcard_prefix?.message}
          />
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("sms_enabled")}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Enable SMS</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("whatsapp_enabled")}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Enable WhatsApp</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              {...register("is_active")}
              className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEditing ? "Update Branch" : "Create Branch"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =====================================================
// Branch List Row
// =====================================================

function BranchRow({
  branch,
  onEdit,
}: {
  branch: Branch;
  onEdit: (branch: Branch) => void;
}) {
  return (
    <div className="p-4 border border-neutral-200 rounded-lg hover:border-primary-200 transition-colors bg-white">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-neutral-900">{branch.name}</h3>
            <Badge variant={branch.is_active ? "success" : "default"}>
              {branch.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-neutral-500 flex items-center gap-1">
            <Hash className="w-3 h-3" /> {branch.code}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(branch)}
          leftIcon={<Edit2 className="w-3 h-3" />}
        >
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-neutral-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neutral-400" />
          <span className="truncate">
            {branch.city}, {branch.state}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-neutral-400" />
          <span>{branch.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-neutral-400" />
          <span className="truncate">{branch.email}</span>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main Branches Page
// =====================================================

export default function BranchesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
  });

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setSelectedBranch(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedBranch(null);
  };

  return (
    <ProtectedRoute requiredPermission="canManageBranches">
      <AppLayout>
        <Header
          title="Branch Management"
          subtitle="Manage your service center branches"
          actions={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
              Add Branch
            </Button>
          }
        />

        <div className="p-6">
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.results.map((branch) => (
                <BranchRow
                  key={branch.id}
                  branch={branch}
                  onEdit={handleEdit}
                />
              ))}

              {(!data?.results || data.results.length === 0) && (
                <div className="col-span-full text-center py-12 text-neutral-500 bg-neutral-50 rounded-lg border border-dashed border-neutral-300">
                  No branches found. Click &quot;Add Branch&quot; to create one.
                </div>
              )}
            </div>
          )}
        </div>

        <BranchModal
          isOpen={isModalOpen}
          onClose={handleClose}
          branch={selectedBranch}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
