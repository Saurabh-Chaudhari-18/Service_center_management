"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Button, Badge, LoadingState, EmptyState } from "@/components/ui";
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
} from "lucide-react";
import Link from "next/link";
import { formatPhone, formatDateLong } from "@/lib/formatters";
import type { JobCard } from "@/types";

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
      className="flex items-start justify-between gap-4 rounded-lg border border-neutral-100 p-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40 dark:border-slate-700 dark:hover:bg-slate-700/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {job.job_number}
          </span>
          <span className="text-neutral-400 dark:text-neutral-500">·</span>
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
// Info Row helper
// =====================================================

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null | number;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-neutral-400 dark:text-neutral-500">{icon}</span>
      <div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {value}
        </p>
      </div>
    </div>
  );
}

// =====================================================
// Main Page
// =====================================================

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

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

  return (
    <ProtectedRoute requiredPermission="canViewPickups">
      <AppLayout>
        <Header
          title={loadingCustomer ? "Loading…" : fullName}
          subtitle={customer?.mobile ? formatPhone(customer.mobile) : undefined}
          actions={
            <Button
              variant="secondary"
              leftIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={() => router.back()}
            >
              Back
            </Button>
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
                <>
                  {/* Service History */}
                  <WorkspaceSurface>
                    <div className="p-4 md:p-6">
                      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        <FileText className="h-4 w-4 text-primary-500" />
                        Service History
                        {serviceHistory && serviceHistory.length > 0 && (
                          <span className="ml-auto text-sm font-normal text-neutral-500">
                            {serviceHistory.length} job{serviceHistory.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </h2>

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
                </>
              }
              sidebar={
                <>
                  {/* Profile card */}
                  <WorkspaceSurface>
                    <div className="p-4">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-xl font-semibold text-white">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-neutral-900 dark:text-neutral-100">
                            {fullName}
                          </p>
                          {customer.company_name && (
                            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                              {customer.company_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <InfoRow
                          icon={<Phone className="h-4 w-4" />}
                          label="Mobile"
                          value={formatPhone(customer.mobile)}
                        />
                        {customer.alternate_mobile && (
                          <InfoRow
                            icon={<Phone className="h-4 w-4" />}
                            label="Alternate"
                            value={formatPhone(customer.alternate_mobile)}
                          />
                        )}
                        <InfoRow
                          icon={<Mail className="h-4 w-4" />}
                          label="Email"
                          value={customer.email}
                        />
                        <InfoRow
                          icon={<MapPin className="h-4 w-4" />}
                          label="Location"
                          value={location || undefined}
                        />
                        <InfoRow
                          icon={<Building2 className="h-4 w-4" />}
                          label="GSTIN"
                          value={customer.gstin}
                        />
                      </div>

                      {customer.total_spent ? (
                        <div className="mt-4 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                          <p className="mb-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                            Total Spent
                          </p>
                          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                            ₹{customer.total_spent.toLocaleString("en-IN")}
                          </p>
                        </div>
                      ) : null}

                      {customer.pending_jobs_count && customer.pending_jobs_count > 0 ? (
                        <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                          <span className="text-sm text-amber-700 dark:text-amber-400">
                            Pending jobs
                          </span>
                          <Badge variant="warning" size="sm">
                            {customer.pending_jobs_count}
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  </WorkspaceSurface>

                  {/* Notes */}
                  {customer.notes && (
                    <WorkspaceSurface>
                      <div className="p-4">
                        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                          <MessageSquare className="h-4 w-4" />
                          Notes
                        </h3>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400 whitespace-pre-line">
                          {customer.notes}
                        </p>
                      </div>
                    </WorkspaceSurface>
                  )}

                  {/* Actions */}
                  <div className="space-y-2">
                    <Link href={`/jobs/new?customer=${customer.id}`} className="block">
                      <Button className="w-full" leftIcon={<Hash className="h-4 w-4" />}>
                        New Job Card
                      </Button>
                    </Link>
                    <Link href={`/customers/${customer.id}/edit`} className="block">
                      <Button variant="secondary" className="w-full" leftIcon={<User className="h-4 w-4" />}>
                        Edit Customer
                      </Button>
                    </Link>
                  </div>
                </>
              }
            />
          )}
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
