"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppLayout, Header } from "@/components/layout/Layout";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { enquiriesApi } from "@/lib/api/services";
import { Modal, Button, Input, Select, Textarea, EmptyState, LoadingState, Badge } from "@/components/ui";
import {
  Plus, UserSearch, Phone, Calendar, ArrowRightCircle,
  XCircle, Search, RefreshCw,
  AlertCircle,
} from "lucide-react";
import { formatDateLong, formatPhone } from "@/lib/formatters";
import { ENQUIRY_STATUS_CONFIG } from "@/types";
import type { Enquiry, EnquiryStatus } from "@/types";
import { SemanticStatusBadge, getEnquiryStatusPresentation } from "@/platform/semantics";
import {
  ActionBar,
  EntityCards,
  FormSection,
  OperationalSectionLabel,
  PageShell,
  PaginationFooter,
  RegisterToolbar,
} from "@/components/shell";
import { EnquiryStatsStrip } from "@/components/domain/enquiries/EnquiryStatsStrip";

const LEAD_SOURCES = [
  { value: "WALK_IN", label: "Walk-in" },
  { value: "PHONE_CALL", label: "Phone Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "WEBSITE", label: "Website" },
  { value: "GOOGLE", label: "Google Search" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "REFERRAL", label: "Referral" },
  { value: "JUSTDIAL", label: "JustDial" },
  { value: "SULEKHA", label: "Sulekha" },
  { value: "OTHER", label: "Other" },
];

// =====================================================
// Enquiry Create Form — Schema
// =====================================================

const enquirySchema = z.object({
  customer_name:       z.string().min(1, "Customer name is required"),
  customer_mobile:     z.string().min(10, "Enter a valid 10-digit mobile number"),
  customer_email:      z.string().email("Invalid email").optional().or(z.literal("")),
  device_type:         z.string().optional(),
  brand:               z.string().optional(),
  model_name:          z.string().optional(),
  problem_description: z.string().min(1, "Problem description is required"),
  quoted_price:        z.string().optional(),
  source:              z.string().min(1, "Lead source is required"),
  follow_up_date:      z.string().optional(),
  notes:               z.string().optional(),
});

type EnquiryFormData = z.infer<typeof enquirySchema>;

const isOverdue = (followUpDate: string | null, status: string) => {
  if (!followUpDate || ["CONVERTED", "LOST", "CLOSED"].includes(status)) return false;
  return new Date(followUpDate) < new Date(new Date().setHours(0, 0, 0, 0));
};

type EnquiryStatsShape = {
  total?: number;
  conversion_rate?: number;
  today_followups?: number;
  overdue_followups?: number;
};

const EMPTY_STATS: EnquiryStatsShape = {
  total: 0,
  conversion_rate: 0,
  today_followups: 0,
  overdue_followups: 0,
};

const ENQUIRY_CREATE_FORM_ID = "enquiry-create-form";

export default function EnquiriesPage() {
  const { currentBranch } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 20;
  const [convertTarget, setConvertTarget] = useState<string | null>(null);
  const [lostTarget, setLostTarget] = useState<string | null>(null);
  const [lostReason, setLostReason] = useState("");

  const {
    register: registerEnquiry,
    handleSubmit: handleEnquirySubmit,
    reset: resetEnquiryForm,
    formState: { errors: enquiryErrors },
  } = useForm<EnquiryFormData>({
    resolver: zodResolver(enquirySchema),
    defaultValues: { source: "WALK_IN" },
  });

  const listQueryKey = useMemo(
    () => ["enquiries", "list", currentBranch?.id, search, statusFilter, page] as const,
    [currentBranch?.id, search, statusFilter, page],
  );

  const errorToastRef = React.useRef(false);

  const {
    data,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useQuery({
    queryKey: listQueryKey,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (currentBranch) params.branch = currentBranch.id;
      if (search) params.search = search;
      // Server-side overdue filter — backend should honour `overdue=true`
      if (statusFilter === "OVERDUE") {
        params.overdue = "true";
      } else if (statusFilter) {
        params.status = statusFilter;
      }
      // Always paginate so counts and page navigation are accurate
      params.page = String(page);
      params.page_size = String(PAGE_SIZE);
      const res = await enquiriesApi.list(params);
      const rows = (res.results || []) as Enquiry[];
      return { rows, count: res.count ?? 0 };
    },
    staleTime: 15_000,
  });

  const enquiries = data?.rows ?? [];
  const totalCount = data?.count ?? 0;

  const {
    data: stats = EMPTY_STATS,
    isError: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["enquiries", "stats", currentBranch?.id] as const,
    queryFn: async (): Promise<EnquiryStatsShape> => {
      const params: Record<string, string> = {};
      if (currentBranch) params.branch = currentBranch.id;
      const res = await enquiriesApi.getStats(params);
      return (res ?? {}) as EnquiryStatsShape;
    },
    staleTime: 15_000,
  });

  const statusFilterOptions = useMemo(
    () => [
      {
        value: "OVERDUE",
        label: `Overdue ${
          (stats.overdue_followups ?? 0) > 0 ? `(${stats.overdue_followups})` : ""
        }`,
      },
      ...Object.entries(ENQUIRY_STATUS_CONFIG).map(([key, val]) => ({
        value: key,
        label: val.label,
      })),
    ],
    [stats.overdue_followups],
  );

  React.useEffect(() => {
    if ((listError || statsError) && !errorToastRef.current) {
      errorToastRef.current = true;
      toast.error("Failed to load enquiries. Pull to refresh or try again.");
    }
    if (!listError && !statsError) errorToastRef.current = false;
  }, [listError, statsError, toast]);

  const invalidateEnquiries = () =>
    queryClient.invalidateQueries({ queryKey: ["enquiries"] });

  const createMutation = useMutation({
    mutationFn: async (data: EnquiryFormData) => {
      await enquiriesApi.create({
        ...data,
        quoted_price: data.quoted_price ? parseFloat(data.quoted_price) : null,
        branch: currentBranch?.id,
      });
    },
    onSuccess: () => {
      setShowForm(false);
      resetEnquiryForm();
      toast.success("Enquiry created successfully.");
      void invalidateEnquiries();
    },
    onError: () => {
      toast.error("Failed to create enquiry. Please try again.");
    },
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => enquiriesApi.convertToJob(id),
    onSuccess: (res) => {
      toast.success(res.message || "Converted to job successfully.");
      void invalidateEnquiries();
    },
    onError: () => {
      toast.error("Failed to convert enquiry. Please try again.");
    },
  });

  const markLostMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      enquiriesApi.markLost(id, reason),
    onSuccess: () => {
      toast.success("Enquiry marked as lost.");
      void invalidateEnquiries();
    },
    onError: () => {
      toast.error("Failed to mark enquiry as lost. Please try again.");
    },
  });

  const handleRefresh = () => {
    void Promise.all([refetchList(), refetchStats()]).catch(() => {
      toast.error("Failed to refresh.");
    });
  };

  return (
    <AppLayout>
      <Header
        title="Enquiries"
        subtitle="Track leads, follow-ups & conversions"
        actions={
          <Button
            type="button"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setShowForm(true)}
          >
            New Enquiry
          </Button>
        }
      />

      <PageShell width="fluid">
        <EnquiryStatsStrip
          total={stats?.total}
          conversion_rate={stats?.conversion_rate}
          today_followups={stats?.today_followups}
          overdue_followups={stats?.overdue_followups}
        />

        <RegisterToolbar
          filters={
            <Select
              aria-label="Filter by status"
              placeholder="All Statuses"
              value={statusFilter}
              options={statusFilterOptions}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-sm py-2"
            />
          }
          search={
            <Input
              type="text"
              placeholder="Search by name, mobile, brand..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              leftIcon={<Search className="h-4 w-4" />}
              aria-label="Search enquiries"
              className="py-2 text-sm"
            />
          }
          secondaryActions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="shrink-0 rounded-xl border border-neutral-200 p-2 dark:border-slate-700"
              aria-label="Refresh enquiries"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          }
        />

        <div>
          <OperationalSectionLabel title="Lead queue" hint="Triage &amp; actions" />

          {listLoading ? (
            <LoadingState message="Loading enquiries…" />
          ) : listError ? (
            <EmptyState
              icon={<UserSearch className="h-8 w-8 text-neutral-400" />}
              title="Couldn’t load enquiries"
              description="Check your connection and try again."
              action={
                <Button type="button" onClick={() => void refetchList()}>
                  Retry
                </Button>
              }
            />
          ) : enquiries.length === 0 ? (
            <EmptyState
              icon={<UserSearch className="h-8 w-8 text-neutral-400" />}
              title="No enquiries found"
              description="Create your first lead to get started."
              action={
                <Button type="button" onClick={() => setShowForm(true)} leftIcon={<Plus className="h-4 w-4" />}>
                  New Enquiry
                </Button>
              }
            />
          ) : (
            <EntityCards columns="single" compact>
            {enquiries.map((enq) => {
              return (
                <div
                  key={enq.id}
                  className={`card p-3 ${
                    isOverdue(enq.follow_up_date ?? null, enq.status)
                      ? "border-l-[3px] border-l-red-500"
                      : ""
                  }`}
                >
                  <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 dark:text-white">{enq.customer_name}</h3>
                        <SemanticStatusBadge
                          presentation={getEnquiryStatusPresentation(enq.status as EnquiryStatus)}
                          size="sm"
                        />
                        {enq.source_display && (
                          <Badge size="sm">{enq.source_display}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(enq.customer_mobile)}</span>
                        {enq.brand && <span>{enq.brand} {enq.model_name}</span>}
                        {enq.follow_up_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Follow-up: {formatDateLong(enq.follow_up_date)}
                          </span>
                        )}
                        {isOverdue(enq.follow_up_date ?? null, enq.status) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/20">
                            <AlertCircle className="h-3 w-3" />
                            Follow-up Overdue
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">{enq.problem_description}</p>
                      {enq.quoted_price && (
                        <p className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                          Quoted: ₹{Number(enq.quoted_price).toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>

                    <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                      {enq.status !== "CONVERTED" && enq.status !== "LOST" && enq.status !== "CLOSED" && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            leftIcon={<ArrowRightCircle className="h-4 w-4" />}
                            onClick={() => setConvertTarget(enq.id)}
                            className="w-full justify-center gap-1.5 rounded-lg bg-green-50 text-sm font-semibold text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 sm:w-auto"
                          >
                            Convert
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            leftIcon={<XCircle className="h-4 w-4" />}
                            onClick={() => setLostTarget(enq.id)}
                            className="w-full justify-center gap-1.5 rounded-lg bg-red-50 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 sm:w-auto"
                          >
                            Lost
                          </Button>
                        </>
                      )}
                      {enq.converted_job_number && (
                        <Badge variant="success" size="sm">
                          → Job #{enq.converted_job_number}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </EntityCards>
          )}
          {totalCount > PAGE_SIZE && (
            <PaginationFooter
              page={page}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              onPrevious={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => p + 1)}
            />
          )}
        </div>
      </PageShell>

      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetEnquiryForm(); }}
        title="New Enquiry / Lead"
        size="lg"
        footer={
          <div className="w-full min-w-[min(100%,24rem)]">
            <ActionBar
              className="border-transparent border-t-0 pt-0 pb-0"
              secondary={
                <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => { setShowForm(false); resetEnquiryForm(); }}>
                  Cancel
                </Button>
              }
              primary={
                <Button
                  type="submit"
                  form={ENQUIRY_CREATE_FORM_ID}
                  isLoading={createMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Create Lead
                </Button>
              }
            />
          </div>
        }
      >
        <form
          id={ENQUIRY_CREATE_FORM_ID}
          onSubmit={handleEnquirySubmit((data: EnquiryFormData) => createMutation.mutate(data))}
          className="space-y-6"
        >
          <FormSection title="Customer" fieldGap="tight">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  type="text"
                  label="Customer Name"
                  {...registerEnquiry("customer_name")}
                  placeholder="Full name"
                  className="text-sm"
                />
                {enquiryErrors.customer_name && (
                  <p className="mt-1 text-xs text-red-500">{enquiryErrors.customer_name.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="tel"
                  label="Mobile"
                  {...registerEnquiry("customer_mobile")}
                  placeholder="+91..."
                  className="text-sm"
                />
                {enquiryErrors.customer_mobile && (
                  <p className="mt-1 text-xs text-red-500">{enquiryErrors.customer_mobile.message}</p>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title="Device" fieldGap="tight">
            <div className="grid grid-cols-3 gap-4">
              <Input
                type="text"
                label="Device"
                {...registerEnquiry("device_type")}
                placeholder="Laptop"
                className="text-sm"
              />
              <Input
                type="text"
                label="Brand"
                {...registerEnquiry("brand")}
                placeholder="HP, Dell..."
                className="text-sm"
              />
              <Input
                type="text"
                label="Model"
                {...registerEnquiry("model_name")}
                placeholder="Model name"
                className="text-sm"
              />
            </div>
          </FormSection>

          <FormSection title="Request" fieldGap="tight">
            <Textarea
              label="Problem Description"
              {...registerEnquiry("problem_description")}
              rows={3}
              placeholder="What the customer described..."
              className="resize-none text-sm"
            />
            {enquiryErrors.problem_description && (
              <p className="mt-1 text-xs text-red-500">{enquiryErrors.problem_description.message}</p>
            )}
          </FormSection>

          <FormSection title="Quote & follow-up" fieldGap="tight">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                step="0.01"
                label="Quoted Price (₹)"
                {...registerEnquiry("quoted_price")}
                placeholder="0.00"
                className="text-sm"
              />
              <Select
                label="Lead Source"
                options={LEAD_SOURCES}
                {...registerEnquiry("source")}
                className="text-sm py-2"
              />
            </div>
            <Input
              type="date"
              label="Follow-up Date"
              {...registerEnquiry("follow_up_date")}
              className="text-sm"
            />
          </FormSection>
        </form>
      </Modal>

      {convertTarget && (
        <Modal
          isOpen={true}
          onClose={() => setConvertTarget(null)}
          title="Convert to Job Card"
          footer={
            <div className="w-full min-w-[min(100%,24rem)]">
              <ActionBar
                className="border-transparent border-t-0 pt-0 pb-0"
                secondary={
                  <Button variant="secondary" type="button" className="w-full sm:w-auto" onClick={() => setConvertTarget(null)}>
                    Cancel
                  </Button>
                }
                primary={
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    isLoading={convertMutation.isPending}
                    onClick={() => {
                      convertMutation.mutate(convertTarget, {
                        onSettled: () => setConvertTarget(null),
                      });
                    }}
                  >
                    Convert to Job
                  </Button>
                }
              />
            </div>
          }
        >
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This will create a new job card from this enquiry. The enquiry will be
            marked as Converted. Continue?
          </p>
        </Modal>
      )}

      {lostTarget && (
        <Modal
          isOpen={true}
          onClose={() => {
            setLostTarget(null);
            setLostReason("");
          }}
          title="Mark as Lost"
          footer={
            <div className="w-full min-w-[min(100%,24rem)]">
              <ActionBar
                className="border-transparent border-t-0 pt-0 pb-0"
                secondary={
                  <Button
                    variant="secondary"
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setLostTarget(null);
                      setLostReason("");
                    }}
                  >
                    Cancel
                  </Button>
                }
                primary={
                  <Button
                    variant="danger"
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={!lostReason.trim()}
                    isLoading={markLostMutation.isPending}
                    onClick={() => {
                      if (!lostTarget) return;
                      markLostMutation.mutate(
                        { id: lostTarget, reason: lostReason },
                        {
                          onSettled: () => {
                            setLostTarget(null);
                            setLostReason("");
                          },
                        },
                      );
                    }}
                  >
                    Mark as Lost
                  </Button>
                }
              />
            </div>
          }
        >
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
            Please provide a reason for marking this enquiry as lost.
          </p>
          <Textarea
            label="Reason"
            placeholder="e.g. Customer went to competitor, price too high..."
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            rows={3}
          />
        </Modal>
      )}
    </AppLayout>
  );
}
