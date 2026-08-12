"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, ProtectedRoute } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { Button, Input, Select, LoadingState, EmptyState } from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";
import { RegisterToolbar } from "@/components/shell/RegisterToolbar";
import { WorkspaceSurface } from "@/components/shell";
import { usersApi, branchesApi } from "@/lib/api";
import { UserPlus, Search } from "lucide-react";
import type { User } from "@/types";
import {
  DeleteConfirmModal,
  ROLE_COLORS,
  UserCard,
  UserFormModal,
} from "./UserManagementComponents";

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
