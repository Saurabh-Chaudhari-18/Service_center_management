"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Input,
  Select,
  LoadingState,
  Badge,
  Modal,
  EmptyState,
} from "@/components/ui";
import { usersApi, branchesApi } from "@/lib/api";
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
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { User, UserRole } from "@/types";

// =====================================================
// Role Badge Colors
// =====================================================

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> =
  {
    OWNER: { bg: "bg-purple-100", text: "text-purple-700", label: "Owner" },
    MANAGER: { bg: "bg-blue-100", text: "text-blue-700", label: "Manager" },
    TECHNICIAN: {
      bg: "bg-green-100",
      text: "text-green-700",
      label: "Technician",
    },
    RECEPTIONIST: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      label: "Receptionist",
    },
    ACCOUNTANT: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      label: "Accountant",
    },
  };

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_COLORS[role] || {
    bg: "bg-gray-100",
    text: "text-gray-700",
    label: role,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}
    >
      <Shield className="w-3 h-3" />
      {config.label}
    </span>
  );
}

// =====================================================
// Create/Edit User Modal
// =====================================================

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  password: string;
  password_confirm: string;
  role: UserRole;
  branch_ids: string[];
  is_active: boolean;
}

const EMPTY_FORM: UserFormData = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  password: "",
  password_confirm: "",
  role: "TECHNICIAN" as UserRole,
  branch_ids: [],
  is_active: true,
};

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

function UserFormModal({ isOpen, onClose, user }: UserFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!user;

  const [form, setForm] = useState<UserFormData>(() => {
    if (user) {
      return {
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        password: "",
        password_confirm: "",
        role: (user.role as UserRole) || "TECHNICIAN",
        branch_ids:
          (user.branches as unknown as Array<{ id: string }>)?.map(
            (b) => b.id,
          ) || [],
        is_active: user.is_active !== false,
      };
    }
    return { ...EMPTY_FORM };
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch branches for the multi-select
  const { data: branchesData } = useQuery({
    queryKey: ["branches-list"],
    queryFn: () => branchesApi.list(),
  });

  const branches =
    branchesData?.results || (Array.isArray(branchesData) ? branchesData : []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseApiErrors = (error: any): Record<string, string> => {
    const apiErrors: Record<string, string> = {};
    const data = error?.response?.data;
    if (!data) return apiErrors;

    // Backend format: { error: { field_errors: { field: [msgs] } } }
    const fieldErrors = data?.error?.field_errors || data?.field_errors || data;
    if (fieldErrors && typeof fieldErrors === "object") {
      Object.entries(fieldErrors).forEach(([key, val]) => {
        apiErrors[key] = Array.isArray(val) ? val.join(", ") : String(val);
      });
    }

    // Capture general message if no field errors found
    if (Object.keys(apiErrors).length === 0) {
      const msg = data?.error?.message || data?.detail || data?.message;
      if (msg) apiErrors.detail = String(msg);
    }

    return apiErrors;
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      usersApi.create(data as Partial<User> & { password: string }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      alert("Staff member created successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      const parsed = parseApiErrors(error);
      if (Object.keys(parsed).length > 0) {
        setErrors(parsed);
      } else {
        alert("Failed to create user: " + (error.message || "Unknown error"));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: Record<string, unknown> }) =>
      usersApi.update(data.id, data.payload as Partial<User>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      alert("Staff member updated successfully!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      const parsed = parseApiErrors(error);
      if (Object.keys(parsed).length > 0) {
        setErrors(parsed);
      } else {
        alert("Failed to update user: " + (error.message || "Unknown error"));
      }
    },
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.first_name.trim())
      newErrors.first_name = "First name is required";
    if (!form.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!isEditing) {
      if (!form.email.trim()) newErrors.email = "Email is required";
      if (!form.password) newErrors.password = "Password is required";
      if (form.password.length < 8)
        newErrors.password = "Password must be at least 8 characters";
      if (form.password !== form.password_confirm)
        newErrors.password_confirm = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    if (isEditing && user) {
      updateMutation.mutate({
        id: user.id,
        payload: {
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          role: form.role,
          branch_ids: form.branch_ids,
          is_active: form.is_active,
        },
      });
    } else {
      createMutation.mutate({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        password: form.password,
        password_confirm: form.password_confirm,
        role: form.role,
        branch_ids: form.branch_ids,
      });
    }
  };

  const toggleBranch = (branchId: string) => {
    setForm((prev) => ({
      ...prev,
      branch_ids: prev.branch_ids.includes(branchId)
        ? prev.branch_ids.filter((id) => id !== branchId)
        : [...prev.branch_ids, branchId],
    }));
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Staff Member" : "Add New Staff Member"}
      size="lg"
    >
      <div className="space-y-5">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              First Name *
            </label>
            <Input
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              placeholder="John"
            />
            {errors.first_name && (
              <p className="text-red-500 text-xs mt-1">{errors.first_name}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Last Name *
            </label>
            <Input
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              placeholder="Doe"
            />
            {errors.last_name && (
              <p className="text-red-500 text-xs mt-1">{errors.last_name}</p>
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
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>
        )}

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Phone Number
          </label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 9876543210"
          />
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
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Confirm Password *
              </label>
              <Input
                type="password"
                value={form.password_confirm}
                onChange={(e) =>
                  setForm({ ...form, password_confirm: e.target.value })
                }
                placeholder="Re-enter password"
              />
              {errors.password_confirm && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.password_confirm}
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
          <Select
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as UserRole })
            }
            options={[
              { value: "TECHNICIAN", label: "Technician" },
              { value: "RECEPTIONIST", label: "Receptionist" },
              { value: "ACCOUNTANT", label: "Accountant" },
              { value: "MANAGER", label: "Manager" },
              { value: "OWNER", label: "Owner" },
            ]}
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
                      checked={form.branch_ids.includes(branch.id)}
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
                {form.is_active
                  ? "User can login and access the system"
                  : "User is deactivated"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className="focus:outline-none"
            >
              {form.is_active ? (
                <ToggleRight className="w-8 h-8 text-green-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-neutral-400" />
              )}
            </button>
          </div>
        )}

        {/* API Errors */}
        {errors.non_field_errors && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {errors.non_field_errors}
          </div>
        )}
        {errors.detail && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {errors.detail}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
                ? "Update Staff"
                : "Create Staff"}
          </Button>
        </div>
      </div>
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
      alert("Staff member deactivated successfully!");
    },
    onError: (error: {
      response?: { data?: { detail?: string } };
      message?: string;
    }) => {
      alert(
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
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${user.is_active ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-500"}`}
          >
            {initials}
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">
              {user.first_name} {user.last_name}
            </h4>
            <RoleBadge role={user.role} />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!user.is_active && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium mr-2">
              Inactive
            </span>
          )}
          <button
            onClick={() => onEdit(user)}
            className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          {user.is_active && (
            <button
              onClick={() => onDelete(user)}
              className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Deactivate"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
          {new Date(user.last_login).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", roleFilter, statusFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (roleFilter) params.role = roleFilter;
      if (statusFilter) params.is_active = statusFilter;
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

        <div className="p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div
              className={`p-4 rounded-xl border transition-all cursor-pointer ${!roleFilter ? "bg-primary-50 border-primary-200" : "bg-white border-neutral-200 hover:border-primary-200"}`}
              onClick={() => setRoleFilter("")}
            >
              <p className="text-2xl font-bold text-neutral-900">
                {users.length}
              </p>
              <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
                All Staff
              </p>
            </div>
            {Object.entries(ROLE_COLORS).map(([role, config]) => (
              <div
                key={role}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${roleFilter === role ? `${config.bg} border-current` : "bg-white border-neutral-200 hover:border-neutral-300"}`}
                onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
              >
                <p className={`text-2xl font-bold ${config.text}`}>
                  {roleCounts[role] || 0}
                </p>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
                  {config.label}s
                </p>
              </div>
            ))}
          </div>

          {/* Search & Filters */}
          <Card padding="md">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

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
            </div>
          </Card>

          {/* Users Grid */}
          {isLoading ? (
            <LoadingState />
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
        </div>

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
