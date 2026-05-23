"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { Button, Badge, LoadingState, EmptyState, ConfirmDialog } from "@/components/ui";
import { CardTitle } from "@/components/ui";
import {
  PageShell,
  RecordLayout,
  WorkspaceSurface,
} from "@/components/shell";
import { customersApi } from "@/lib/api";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Building2,
  Hash,
  MessageSquare,
  Briefcase,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { formatPhone, formatDateLong } from "@/lib/formatters";
import type { JobCard } from "@/types";

// =====================================================
// Overflow Menu (destructive action hidden here)
// =====================================================

function MoreMenu({ onErase }: { onErase: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button
        variant="secondary"
        aria-label="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="w-4 h-4" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[11rem] rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg py-1 overflow-hidden">
            <button
              onClick={() => { setOpen(false); onErase(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Erase Customer Data
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================
// Service History Row
// =====================================================

function ServiceHistoryRow({ job }: { job: JobCard }) {
  const statusVariant =
    job.status === "DELIVERED"
      ? "success"
      : job.status === "CANCELLED"
        ? "danger"
        : job.status === "READY_FOR_DELIVERY"
          ? "warning"
          : "default";

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex items-start justify-between gap-4 rounded-lg border border-neutral-100 dark:border-slate-700 p-3 transition-colors hover:border-primary-200 dark:hover:border-primary-500/40 hover:bg-primary-50/40 dark:hover:bg-primary-500/5"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {job.job_number}
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">·</span>
          <span className="text-sm text-neutral-600 dark:text-neutral-300">
            {job.brand} {job.model}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-sm text-neutral-500 dark:text-neutral-400">
          {job.customer_complaint}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
          {formatDateLong(job.created_at)}
        </p>
      </div>
      <Badge variant={statusVariant} size="sm" className="mt-0.5 shrink-0">
        {job.status.replace(/_/g, " ")}
      </Badge>
    </Link>
  );
}

// =====================================================
// Sidebar detail row (label + value, flat)
// =====================================================

function DetailRow({
  label,
  value,
  icon,
  mono = false,
}: {
  label: string;
  value?: string | number | null;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-neutral-100 dark:border-slate-700/60 last:border-0">
      <span className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide shrink-0">
        {icon}
        {label}
      </span>
      <span className={`text-sm text-neutral-900 dark:text-neutral-100 text-right ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// =====================================================
// Main Page
// =====================================================

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isRole } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customersApi.get(id),
    enabled: !!id,
  });

  const { data: serviceHistory, isLoading: loadingHistory } = useQuery({
    queryKey: ["customer-history", id],
    queryFn: () => customersApi.getServiceHistory(id),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => customersApi.requestDeletion(id),
    onSuccess: () => {
      toast.success("Customer data anonymised. Redirecting…");
      router.push("/customers");
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      toast.error(
        err.response?.data?.error || err.message || "Failed to delete customer data.",
      );
    },
  });

  const initials =
    customer
      ? `${customer.first_name?.[0] ?? ""}${customer.last_name?.[0] ?? ""}`.toUpperCase() || "?"
      : "?";

  const fullName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : "Customer";

  const location = [customer?.city, customer?.state, customer?.pincode]
    .filter(Boolean)
    .join(", ");

  const canErase = isRole("OWNER", "MANAGER");

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title={loadingCustomer ? "Loading…" : fullName}
          subtitle={customer?.mobile ? formatPhone(customer.mobile) : undefined}
          actions={
            <>
              <Button
                variant="ghost"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                onClick={() => router.back()}
              >
                Customers
              </Button>
              {customer && (
                <>
                  <Link href={`/jobs/new?customer=${customer.id}`}>
                    <Button leftIcon={<Hash className="h-4 w-4" />}>
                      New Job Card
                    </Button>
                  </Link>
                  <Link href={`/customers/${customer.id}/edit`}>
                    <Button variant="secondary" leftIcon={<Pencil className="h-4 w-4" />}>
                      Edit
                    </Button>
                  </Link>
                  {canErase && (
                    <MoreMenu onErase={() => setShowDeleteDialog(true)} />
                  )}
                </>
              )}
            </>
          }
        />

        <PageShell width="fluid">
          {loadingCustomer ? (
            <div className="py-12">
              <LoadingState />
            </div>
          ) : !customer ? (
            <div className="py-12">
              <EmptyState
                icon={<User className="h-8 w-8 text-neutral-400" />}
                title="Customer not found"
                description="This customer may have been removed or the link is invalid."
                action={
                  <Button onClick={() => router.push("/customers")}>
                    Back to Customers
                  </Button>
                }
              />
            </div>
          ) : (
            <RecordLayout
              main={
                <WorkspaceSurface>
                  <div className="p-4 md:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <CardTitle icon={<FileText className="h-4 w-4 text-primary-500" />}>
                        Service History
                      </CardTitle>
                      {serviceHistory && serviceHistory.length > 0 && (
                        <span className="text-sm text-neutral-400 dark:text-neutral-500">
                          {serviceHistory.length} job{serviceHistory.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {loadingHistory ? (
                      <LoadingState />
                    ) : serviceHistory && serviceHistory.length > 0 ? (
                      <div className="space-y-2">
                        {serviceHistory.map((job) => (
                          <ServiceHistoryRow key={job.id} job={job} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={<Briefcase className="h-7 w-7 text-neutral-300 dark:text-slate-600" />}
                        title="No service history"
                        description="This customer has no job cards yet."
                      />
                    )}
                  </div>
                </WorkspaceSurface>
              }
              sidebar={
                <>
                  {/* Customer Info */}
                  <WorkspaceSurface>
                    <div className="p-4">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-neutral-100 dark:border-slate-700/60">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-lg font-semibold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {fullName}
                          </p>
                          {customer.company_name && (
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                              {customer.company_name}
                            </p>
                          )}
                          {customer.pending_jobs_count && customer.pending_jobs_count > 0 ? (
                            <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                              {customer.pending_jobs_count} pending job{customer.pending_jobs_count !== 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Contact & meta */}
                      <div>
                        <DetailRow
                          label="Mobile"
                          icon={<Phone className="h-3 w-3" />}
                          value={formatPhone(customer.mobile)}
                        />
                        {customer.alternate_mobile && (
                          <DetailRow
                            label="Alternate"
                            icon={<Phone className="h-3 w-3" />}
                            value={formatPhone(customer.alternate_mobile)}
                          />
                        )}
                        <DetailRow
                          label="Email"
                          icon={<Mail className="h-3 w-3" />}
                          value={customer.email}
                        />
                        <DetailRow
                          label="Location"
                          icon={<MapPin className="h-3 w-3" />}
                          value={location || undefined}
                        />
                        <DetailRow
                          label="GSTIN"
                          icon={<Building2 className="h-3 w-3" />}
                          value={customer.gstin}
                        />
                        {customer.total_spent ? (
                          <DetailRow
                            label="Total Spent"
                            value={`₹${customer.total_spent.toLocaleString("en-IN")}`}
                          />
                        ) : null}
                      </div>
                    </div>
                  </WorkspaceSurface>

                  {/* Notes */}
                  {customer.notes && (
                    <WorkspaceSurface>
                      <div className="p-4">
                        <CardTitle
                          icon={<MessageSquare className="h-4 w-4 text-neutral-400" />}
                          className="mb-3"
                        >
                          Notes
                        </CardTitle>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-line border-l-2 border-neutral-200 dark:border-neutral-600 pl-3 py-0.5">
                          {customer.notes}
                        </p>
                      </div>
                    </WorkspaceSurface>
                  )}
                </>
              }
            />
          )}
        </PageShell>

        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={() => deleteMutation.mutate()}
          title="Erase Customer Data"
          message={`This will permanently anonymise all personal information for ${fullName}. Job history and invoices are retained for GST compliance but the customer's name, mobile, and address will be replaced with placeholders. This cannot be undone.`}
          confirmText="Erase Data"
          cancelText="Cancel"
          variant="danger"
          isLoading={deleteMutation.isPending}
        />
      </AppLayout>
    </ProtectedRoute>
  );
}
