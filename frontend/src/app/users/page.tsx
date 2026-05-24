"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Button,
  Badge,
  Input,
  Select,
  LoadingState,
  Modal,
  EmptyState,
} from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";
import { RegisterToolbar } from "@/components/shell/RegisterToolbar";
import { WorkspaceSurface } from "@/components/shell";
import { usersApi, branchesApi } from "@/lib/api";
import { formatDateLong } from "@/lib/formatters";
import {
  UserPlus,
  Search,
  Edit3,
  Trash2,
  Shield,
  Mail,
  Phone,
  MapPin,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from "lucide-react";
import type { User } from "@/types";

// =====================================================
// Role Badge Colors
// =====================================================

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SUPER_ADMIN:  { bg: "bg-slate-100",   text: "text-slate-700",   label: "Super Admin"  },
  OWNER:        { bg: "bg-purple-100",  text: "text-purple-700",  label: "Owner"        },
  MANAGER:      { bg: "bg-blue-100",    text: "text-blue-700",    label: "Manager"      },
  TECHNICIAN:   { bg: "bg-emerald-100", text: "text-emerald-700", label: "Technician"   },
  RECEPTIONIST: { bg: "bg-orange-100",  text: "text-orange-700",  label: "Receptionist" },
  ACCOUNTANT:   { bg: "bg-teal-100",    text: "text-teal-700",    label: "Accountant"   },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_COLORS[role] || { bg: "bg-neutral-100", text: "text-neutral-700", label: role };
  return (
    <span className={`badge ${config.bg} ${config.text} inline-flex items-center gap-1`}>
      <Shield className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// =====================================================
// Create/Edit User Modal
// =====================================================

const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "TECHNICIAN",
  "RECEPTIONIST",
  "ACCOUNTANT",
] as const;

const makeUserSchema = (isEditing: boolean) =>
  z
    .object({
      first_name: z.string().min(1, "First name is required"),
      last_name: z.string().min(1, "Last name is required"),
      email: isEditing
        ? z.string().optional()
        : z.string().min(1, "Email is required").email("Invalid email"),
      phone: z.string().optional(),
      password: z.string().optional(),
      password_confirm: z.string().optional(),
      role: z.enum(ROLES),
      branch_ids: z.array(z.string()),
      is_active: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (!isEditing) {
        if (!data.password || data.password.length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Password must be at least 8 characters",
            path: ["password"],
          });
        }
        if (data.password !== data.password_confirm) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Passwords do not match",
            path: ["password_confirm"],
          });
        }
      }
    });

type UserFormData = {
  first_name: string;
  last_name: string;
  email: string | undefined;
  phone?: string;
  password?: string;
  password_confirm?: string;
  role: (typeof ROLES)[number];
  branch_ids: string[];
  is_active: boolean;
};

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

function UserFormModal({ isOpen, onClose, user }: UserFormModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!user;

  const schema = useMemo(() => makeUserSchema(isEditing), [isEditing]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<UserFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      email: user?.email || "",
      phone: user?.phone || "",
      password: "",
      password_confirm: "",
      role: ((user?.role as (typeof ROLES)[number]) || "TECHNICIAN"),
      branch_ids:
        (user?.branches as unknown as Array<{ id: string }>)?.map(
          (b) => b.id,
        ) || [],
      is_active: user?.is_active !== false,
    },
  });

  const branchIds = watch("branch_ids");
  const isActive = watch("is_active");

  const { data: branchesData } = useQuery({
    queryKey: ["branches-list"],
    queryFn: () => branchesApi.list(),
  });

  const branches =
    branchesData?.results || (Array.isArray(branchesData) ? branchesData : []);

  const parseAndSetApiErrors = (error: unknown): boolean => {
    const raw = (error as { response?: { data?: unknown } })?.response?.data;
    if (!raw || typeof raw !== "object") return false;
    const data = raw as Record<string, unknown>;
    const errBlock = data.error as Record<string, unknown> | undefined;
    const fieldErrors =
      (errBlock?.fields as Record<string, unknown> | undefined) ||
      (errBlock?.field_errors as Record<string, unknown> | undefined) ||
      (data.fields as Record<string, unknown> | undefined) ||
      (data.field_errors as Record<string, unknown> | undefined);

    if (
      fieldErrors &&
      typeof fieldErrors === "object" &&
      !Array.isArray(fieldErrors)
    ) {
      let hasFields = false;
      Object.entries(fieldErrors).forEach(([key, val]) => {
        const msg = Array.isArray(val) ? val.join(", ") : String(val);
        setError(key as keyof UserFormData, { type: "server", message: msg });
        hasFields = true;
      });
      if (hasFields) return true;
    }

    const msg = errBlock?.message ?? data.detail ?? data.message;
    if (msg != null) {
      setError("root", { type: "server", message: String(msg) });
      return true;
    }
    return false;
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      usersApi.create(data as Partial<User> & { password: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      toast.success("Staff member created successfully.");
    },
    onError: (error: unknown) => {
      if (!parseAndSetApiErrors(error)) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to create user: " + msg);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: Record<string, unknown> }) =>
      usersApi.update(data.id, data.payload as Partial<User>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      toast.success("Staff member updated successfully.");
    },
    onError: (error: unknown) => {
      if (!parseAndSetApiErrors(error)) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error("Failed to update user: " + msg);
      }
    },
  });

  const onSubmit = (data: UserFormData) => {
    if (isEditing && user) {
      updateMutation.mutate({
        id: user.id,
        payload: {
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          role: data.role,
          branch_ids: data.branch_ids,
          is_active: data.is_active,
        },
      });
    } else {
      createMutation.mutate({
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        password: data.password,
        password_confirm: data.password_confirm,
        role: data.role,
        branch_ids: data.branch_ids,
      });
    }
  };

  const toggleBranch = (branchId: string) => {
    setValue(
      "branch_ids",
      branchIds.includes(branchId)
        ? branchIds.filter((id) => id !== branchId)
        : [...branchIds, branchId],
    );
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Warn before closing tab/navigating away with unsaved changes
  React.useEffect(() => {
    if (!isOpen || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isOpen, isDirty]);

  const USER_FORM_ID = "user-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Staff Member" : "Add New Staff Member"}
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={USER_FORM_ID} isLoading={isSubmitting}>
            {isEditing ? "Update Staff" : "Create Staff"}
          </Button>
        </>
      }
    >
      <form id={USER_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              First Name *
            </label>
            <Input {...register("first_name")} placeholder="John" />
            {errors.first_name && (
              <p className="text-red-500 text-xs mt-1">
                {errors.first_name.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Last Name *
            </label>
            <Input {...register("last_name")} placeholder="Doe" />
            {errors.last_name && (
              <p className="text-red-500 text-xs mt-1">
                {errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        {/* Email - only for create */}
        {!isEditing && (
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Email Address *
            </label>
            <Input
              type="email"
              {...register("email")}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
        )}

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Phone Number
          </label>
          <Input {...register("phone")} placeholder="+91 9876543210" />
        </div>

        {/* Password - only for create */}
        {!isEditing && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Password *
              </label>
              <Input
                type="password"
                {...register("password")}
                placeholder="Min 8 characters"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Confirm Password *
              </label>
              <Input
                type="password"
                {...register("password_confirm")}
                placeholder="Re-enter password"
              />
              {errors.password_confirm && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password_confirm.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Role *
          </label>
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                options={[
                  { value: "TECHNICIAN", label: "Technician" },
                  { value: "RECEPTIONIST", label: "Receptionist" },
                  { value: "ACCOUNTANT", label: "Accountant" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "SUPER_ADMIN", label: "Super Admin" },
                  { value: "OWNER", label: "Owner" },
                ]}
              />
            )}
          />
        </div>

        {/* Branch Assignment */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Assign Branches
          </label>
          <div className="border border-neutral-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
            {branches.length === 0 ? (
              <p className="text-sm text-neutral-400">No branches available</p>
            ) : (
              branches.map(
                (branch: { id: string; name: string; city?: string }) => (
                  <label
                    key={branch.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={branchIds.includes(branch.id)}
                      onChange={() => toggleBranch(branch.id)}
                      className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-800">
                        {branch.name}
                      </span>
                      {branch.city && (
                        <span className="text-xs text-neutral-400 ml-2">
                          ({branch.city})
                        </span>
                      )}
                    </div>
                  </label>
                ),
              )
            )}
          </div>
        </div>

        {/* Active Toggle - only for edit */}
        {isEditing && (
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-neutral-700">
                Account Status
              </p>
              <p className="text-xs text-neutral-500">
                {isActive
                  ? "User can login and access the system"
                  : "User is deactivated"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setValue("is_active", !isActive)}
              className="focus:outline-none"
            >
              {isActive ? (
                <ToggleRight className="w-8 h-8 text-green-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-neutral-400" />
              )}
            </button>
          </div>
        )}

        {/* Root / server errors */}
        {errors.root && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {errors.root.message}
          </div>
        )}

        {/* Actions */}
      </form>
    </Modal>
  );
}

// =====================================================
// Delete Confirmation Modal
// =====================================================

interface DeleteConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

function DeleteConfirmModal({ isOpen, onClose, user }: DeleteConfirmProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      if (!user) return;
      const userId = user.id;
      const userName = `${user.first_name} ${user.last_name}`;
      toast.success(`${userName} deactivated.`, {
        label: "Undo",
        onClick: () => {
          void usersApi
            .update(userId, { is_active: true } as Partial<User>)
            .then(() => {
              void queryClient.invalidateQueries({ queryKey: ["users"] });
              toast.success(`${userName} reactivated.`);
            })
            .catch(() => {
              toast.error("Failed to reactivate. Please edit the user manually.");
            });
        },
      });
    },
    onError: (error: {
      response?: { data?: { detail?: string } };
      message?: string;
    }) => {
      toast.error(
        "Failed to deactivate: " +
          (error.response?.data?.detail || error.message || "Unknown error"),
      );
    },
  });

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deactivate Staff Member">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Are you sure you want to deactivate this user?
            </p>
            <p className="text-sm text-amber-700 mt-1">
              <strong>
                {user.first_name} {user.last_name}
              </strong>{" "}
              ({user.email}) will no longer be able to login. This can be
              reversed by reactivating the account.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteMutation.mutate(user.id)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Deactivating..." : "Deactivate User"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================
// User Card Component
// =====================================================

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

function UserCard({ user, onEdit, onDelete }: UserCardProps) {
  const initials =
    `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div
      className={`p-5 bg-white border rounded-xl transition-all hover:shadow-md ${!user.is_active ? "opacity-60 border-neutral-200" : "border-neutral-200"}`}
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${user.is_active ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-500"}`}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-semibold text-neutral-900 leading-tight">
                {user.first_name} {user.last_name}
              </h4>
              {!user.is_active && <Badge variant="danger" size="sm">Inactive</Badge>}
            </div>
            <RoleBadge role={user.role} />
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="md"
            className="w-full justify-center sm:w-auto"
            onClick={() => onEdit(user)}
            leftIcon={<Edit3 className="w-4 h-4" />}
          >
            Edit
          </Button>
          {user.is_active && (
            <Button
              variant="ghost"
              size="md"
              className="w-full justify-center text-red-600 hover:bg-red-50 sm:w-auto"
              onClick={() => onDelete(user)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-neutral-600">
          <Mail className="w-3.5 h-3.5 text-neutral-400" />
          <span className="truncate">{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex items-center gap-2 text-neutral-600">
            <Phone className="w-3.5 h-3.5 text-neutral-400" />
            <span>{user.phone}</span>
          </div>
        )}
        {user.branches && user.branches.length > 0 && (
          <div className="flex items-start gap-2 text-neutral-600">
            <MapPin className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-1">
              {(
                user.branches as unknown as Array<{ id: string; name: string }>
              ).map((b) => (
                <span
                  key={b.id}
                  className="text-xs px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600"
                >
                  {b.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {user.last_login && (
        <p className="text-xs text-neutral-400 mt-3">
          Last login:{" "}
          {formatDateLong(user.last_login)}
        </p>
      )}
    </div>
  );
}

// =====================================================
// Main Staff Management Page
// =====================================================

export default function StaffManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const { hasPermission } = useAuth();
  const canManageBranches = hasPermission("canManageBranches");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: branchesData } = useQuery({
    queryKey: ["branches-list"],
    queryFn: () => branchesApi.list(),
  });

  const branchesList =
    branchesData?.results || (Array.isArray(branchesData) ? branchesData : []);

  const { data, isLoading } = useQuery({
    queryKey: ["users", roleFilter, statusFilter, branchFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.is_active = statusFilter;
      if (branchFilter) params.branch = branchFilter;
      return usersApi.list(params as { role?: string; branch?: string });
    },
  });

  const users: User[] = data?.results || (Array.isArray(data) ? data : []);

  // Client-side search filter
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      user.first_name?.toLowerCase().includes(q) ||
      user.last_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q)
    );
  });

  // Count by role
  const roleCounts = users.reduce((acc: Record<string, number>, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <ProtectedRoute requiredPermission="canManageUsers">
      <AppLayout>
        <Header
          title="Staff Management"
          subtitle="Manage your team members, roles, and permissions"
          actions={
            <Button
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => setShowCreateModal(true)}
            >
              Add Staff
            </Button>
          }
        />

        <PageShell>
          {/* Role filter chips */}
          <WorkspaceSurface className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <button
                type="button"
                aria-pressed={!roleFilter}
                className={`p-4 rounded-xl border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${!roleFilter ? "bg-primary-50 border-primary-200" : "bg-white border-neutral-200 hover:border-primary-200"}`}
                onClick={() => setRoleFilter("")}
              >
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                  {users.length}
                </p>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
                  All Staff
                </p>
              </button>
              {Object.entries(ROLE_COLORS).map(([role, config]) => (
                <button
                  key={role}
                  type="button"
                  aria-pressed={roleFilter === role}
                  className={`p-4 rounded-xl border transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${roleFilter === role ? `${config.bg} border-current` : "bg-white border-neutral-200 hover:border-neutral-300"}`}
                  onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
                >
                  <p className={`text-2xl font-bold ${config.text} dark:text-neutral-100`}>
                    {roleCounts[role] || 0}
                  </p>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
                    {config.label}s
                  </p>
                </button>
              ))}
            </div>
          </WorkspaceSurface>

          {/* Search & Filters */}
          <RegisterToolbar
            search={
              <Input
                placeholder="Search by name, email, or phone..."
                leftIcon={<Search className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            }
            secondaryActions={
              <>
                {canManageBranches && (
                  <Select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="w-48"
                    placeholder="All Branches"
                    options={[
                      { value: "", label: "All Branches" },
                      ...branchesList.map((b: { id: string; name: string }) => ({
                        value: b.id,
                        label: b.name,
                      })),
                    ]}
                  />
                )}
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-40"
                  placeholder="All Status"
                  options={[
                    { value: "true", label: "Active" },
                    { value: "false", label: "Inactive" },
                  ]}
                />
              </>
            }
          />

          {/* Users Grid */}
          {isLoading ? (
            <LoadingState message="Loading staff…" />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={<UserPlus className="w-8 h-8 text-neutral-400" />}
              title={
                searchQuery || roleFilter
                  ? "No matching staff found"
                  : "No staff members yet"
              }
              description={
                searchQuery || roleFilter
                  ? "Try adjusting your search or filters"
                  : "Click 'Add Staff' to invite your team members"
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  onEdit={(u) => setEditingUser(u)}
                  onDelete={(u) => setDeletingUser(u)}
                />
              ))}
            </div>
          )}

          {/* Result Count */}
          {!isLoading && filteredUsers.length > 0 && (
            <p className="text-sm text-neutral-500 text-center">
              Showing {filteredUsers.length} of {users.length} staff members
              {roleFilter &&
                ` · Filtered by ${ROLE_COLORS[roleFilter]?.label || roleFilter}`}
            </p>
          )}
        </PageShell>

        {/* Modals */}
        {showCreateModal && (
          <UserFormModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
          />
        )}

        {editingUser && (
          <UserFormModal
            isOpen={!!editingUser}
            onClose={() => setEditingUser(null)}
            user={editingUser}
          />
        )}

        <DeleteConfirmModal
          isOpen={!!deletingUser}
          onClose={() => setDeletingUser(null)}
          user={deletingUser}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
