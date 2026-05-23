"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Button,
  Input,
  Badge,
  Modal,
  LoadingState,
  EmptyState,
  StatsCard,
} from "@/components/ui";
import { PageShell } from "@/components/shell/PageShell";
import { RegisterToolbar } from "@/components/shell/RegisterToolbar";
import { formatDateLong } from "@/lib/formatters";
import { organizationsApi, branchesApi, usersApi } from "@/lib/api";
import type { Organization, Branch, User } from "@/types";
import {
  Plus,
  Edit2,
  Building2,
  Users,
  MapPin,
  Phone,
  Mail,
  Globe,
  Shield,
  Search,
  Eye,
  Store,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// =====================================================
// Organization Form Schema
// =====================================================

const orgSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  legal_name: z.string().min(1, "Legal name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  website: z.string().optional().or(z.literal("")),
  address_line1: z.string().min(1, "Address is required"),
  address_line2: z.string().optional().or(z.literal("")),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().min(6, "Invalid pincode"),
  country: z.string().min(1, "Country is required"),
  pan_number: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

type OrgFormData = z.infer<typeof orgSchema>;

// =====================================================
// Organization Form Modal
// =====================================================

interface OrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  org?: Organization | null;
}

function OrgModal({ isOpen, onClose, org }: OrgModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isEditing = !!org;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema) as Resolver<OrgFormData>,
    defaultValues: org
      ? {
          ...org,
          website: org.website || "",
          address_line2: org.address_line2 || "",
          pan_number: org.pan_number || "",
          country: org.country || "India",
        }
      : {
          country: "India",
          is_active: true,
        },
  });

  const mutation = useMutation({
    mutationFn: (data: OrgFormData) => {
      const payload = { ...data };
      if (!payload.website) delete (payload as Record<string, unknown>).website;
      if (!payload.address_line2)
        delete (payload as Record<string, unknown>).address_line2;
      if (!payload.pan_number)
        delete (payload as Record<string, unknown>).pan_number;

      if (isEditing && org) {
        return organizationsApi.update(org.id, payload);
      }
      return organizationsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success(isEditing ? "Organization updated" : "Organization created");
      onClose();
      reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save organization");
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      reset(
        org
          ? {
              ...org,
              website: org.website || "",
              address_line2: org.address_line2 || "",
              pan_number: org.pan_number || "",
              country: org.country || "India",
            }
          : {
              country: "India",
              is_active: true,
            },
      );
    }
  }, [org, isOpen, reset]);

  const ORG_FORM_ID = "org-form";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Organization" : "Add New Organization"}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" form={ORG_FORM_ID} isLoading={mutation.isPending}>
            {isEditing ? "Update Organization" : "Create Organization"}
          </Button>
        </>
      }
    >
      <form
        id={ORG_FORM_ID}
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 text-neutral-900 font-medium pb-2 border-b">
            Basic Information
          </div>
          <Input
            label="Organization Name"
            {...register("name")}
            error={errors.name?.message}
          />
          <Input
            label="Legal Name"
            {...register("legal_name")}
            error={errors.legal_name?.message}
          />
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
          <Input
            label="Website"
            {...register("website")}
            error={errors.website?.message}
          />
          <Input
            label="PAN Number"
            {...register("pan_number")}
            error={errors.pan_number?.message}
          />

          <div className="col-span-2 text-neutral-900 font-medium pb-2 border-b mt-2">
            Address
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
          <Input
            label="Country"
            {...register("country")}
            error={errors.country?.message}
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register("is_active")}
            className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Active</span>
        </label>

      </form>
    </Modal>
  );
}

// =====================================================
// Organization Detail Drawer
// =====================================================

interface OrgDetailProps {
  org: Organization;
  onClose: () => void;
  onEdit: (org: Organization) => void;
}

function OrgDetailDrawer({ org, onClose, onEdit }: OrgDetailProps) {
  // Fetch branches for this org
  const { data: branchesData } = useQuery({
    queryKey: ["branches"],
    queryFn: () => branchesApi.list(),
  });

  // Fetch users for this org
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const orgBranches =
    branchesData?.results?.filter((b: Branch) => b.organization === org.id) ||
    [];
  const orgUsers =
    usersData?.results?.filter((u: User) => u.organization === org.id) || [];

  const ownerCount = orgUsers.filter((u: User) => u.role === "OWNER").length;
  const staffCount = orgUsers.filter((u: User) => u.role !== "OWNER").length;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={org.name}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            leftIcon={<Edit2 className="w-4 h-4" />}
            onClick={() => { onEdit(org); onClose(); }}
          >
            Edit Organization
          </Button>
        </>
      }
    >
        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={org.is_active ? "success" : "default"}>
              {org.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <Store className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-700">
                {orgBranches.length}
              </p>
              <p className="text-xs text-blue-600">Branches</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 text-center">
              <Shield className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-purple-700">{ownerCount}</p>
              <p className="text-xs text-purple-600">Owners</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-700">
                {staffCount}
              </p>
              <p className="text-xs text-emerald-600">Staff</p>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Contact Details
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-700">{org.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-700">{org.phone}</span>
              </div>
              {org.website && (
                <div className="flex items-center gap-3 text-sm">
                  <Globe className="w-4 h-4 text-neutral-400" />
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {org.website}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-neutral-400" />
                <span className="text-neutral-700">
                  {org.address_line1}
                  {org.address_line2 ? `, ${org.address_line2}` : ""},{" "}
                  {org.city}, {org.state} - {org.pincode}
                </span>
              </div>
            </div>
          </div>

          {/* PAN */}
          {org.pan_number && (
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-2">
                Tax Information
              </h3>
              <p className="text-sm text-neutral-700">
                PAN:{" "}
                <span className="font-mono font-medium">{org.pan_number}</span>
              </p>
            </div>
          )}

          {/* Branches List */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Branches ({orgBranches.length})
            </h3>
            {orgBranches.length > 0 ? (
              <div className="space-y-2">
                {orgBranches.map((branch: Branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {branch.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {branch.city}, {branch.state} • Code: {branch.code}
                      </p>
                    </div>
                    <Badge
                      variant={branch.is_active ? "success" : "default"}
                      className="text-xs"
                    >
                      {branch.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic">No branches yet</p>
            )}
          </div>

          {/* Owners List */}
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider mb-3">
              Owners ({ownerCount})
            </h3>
            {orgUsers.filter((u: User) => u.role === "OWNER").length > 0 ? (
              <div className="space-y-2">
                {orgUsers
                  .filter((u: User) => u.role === "OWNER")
                  .map((user: User) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-100"
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-medium text-xs">
                        {user.first_name?.[0]}
                        {user.last_name?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic">No owners found</p>
            )}
          </div>

          {/* Timestamps */}
          <div className="border-t pt-4 text-xs text-neutral-400">
            <p>Created: {formatDateLong(org.created_at)}</p>
            <p>Updated: {formatDateLong(org.updated_at)}</p>
          </div>
        </div>
    </Modal>
  );
}

// =====================================================
// Organization Card Component
// =====================================================

function OrgCard({
  org,
  onView,
  onEdit,
}: {
  org: Organization;
  onView: (org: Organization) => void;
  onEdit: (org: Organization) => void;
}) {
  return (
    <div
      className="group p-5 border border-neutral-200 rounded-xl hover:border-primary-300 hover:shadow-lg transition-all duration-200 bg-white cursor-pointer"
      onClick={() => onView(org)}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {org.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors">
              {org.name}
            </h3>
            <p className="text-xs text-neutral-500">{org.legal_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={org.is_active ? "success" : "default"}>
            {org.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>

      <div className="space-y-2 text-sm text-neutral-600 mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="truncate">
            {org.city}, {org.state}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span>{org.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="truncate">{org.email}</span>
        </div>
      </div>

      {/* Footer with action */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-1 text-xs text-neutral-400">
          <span>Created {formatDateLong(org.created_at)}</span>
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(org)}
            leftIcon={<Edit2 className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(org)}
            leftIcon={<Eye className="w-3 h-3" />}
          >
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main Organizations Page
// =====================================================

export default function OrganizationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [viewOrg, setViewOrg] = useState<Organization | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsApi.list(),
  });

  const orgs = data?.results || [];
  const filteredOrgs = searchQuery
    ? orgs.filter(
        (o) =>
          o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          o.email?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : orgs;

  const activeCount = orgs.filter((o) => o.is_active).length;
  const inactiveCount = orgs.filter((o) => !o.is_active).length;

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    setIsModalOpen(true);
    setViewOrg(null);
  };

  const handleAdd = () => {
    setSelectedOrg(null);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedOrg(null);
  };

  return (
    <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
      <AppLayout>
        <Header
          title="Organizations"
          subtitle="Manage all service center organizations"
          actions={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
              Add Organization
            </Button>
          }
        />

        <PageShell>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              label="Total Organizations"
              value={orgs.length}
              icon={<Building2 className="w-5 h-5" />}
              variant="accent"
            />
            <StatsCard
              label="Active"
              value={activeCount}
              icon={<Shield className="w-5 h-5" />}
              variant="success"
            />
            <StatsCard
              label="Inactive"
              value={inactiveCount}
              icon={<Building2 className="w-5 h-5" />}
              variant="warning"
            />
          </div>

          {/* Search */}
          <RegisterToolbar
            search={
              <Input
                placeholder="Search organizations by name, city, or email..."
                leftIcon={<Search className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            }
          />

          {/* Organization Cards */}
          {isLoading ? (
            <LoadingState />
          ) : filteredOrgs.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-8 h-8 text-neutral-400" />}
              title={searchQuery ? "No organizations match your search" : "No organizations yet"}
              description={!searchQuery ? 'Click "Add Organization" to create the first one.' : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrgs.map((org) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  onView={setViewOrg}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </PageShell>

        {/* Modals */}
        <OrgModal
          isOpen={isModalOpen}
          onClose={handleClose}
          org={selectedOrg}
        />

        {/* Detail Drawer */}
        {viewOrg && (
          <OrgDetailDrawer
            org={viewOrg}
            onClose={() => setViewOrg(null)}
            onEdit={handleEdit}
          />
        )}
      </AppLayout>
    </ProtectedRoute>
  );
}
