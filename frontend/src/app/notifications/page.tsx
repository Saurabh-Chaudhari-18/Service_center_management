"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context/ToastContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  Card,
  Button,
  Badge,
  LoadingState,
  EmptyState,
  Select,
} from "@/components/ui";
import { notificationsApi } from "@/lib/api";
import type { NotificationLog } from "@/types";
import {
  Bell,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Smartphone,
  Mail,
  Settings,
} from "lucide-react";
import { formatDateLong } from "@/lib/formatters";

// ─── helpers ────────────────────────────────────────────────────────────────

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  SMS: Smartphone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "danger" | "warning" }
> = {
  SENT: { label: "Sent", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  PENDING: { label: "Pending", variant: "warning" },
};

function humanType(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Templates tab ──────────────────────────────────────────────────────────

function TemplatesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: () => notificationsApi.listTemplates(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      notificationsApi.updateTemplate(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast.success("Template updated.");
    },
    onError: () => toast.error("Failed to update template."),
  });

  const textMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      notificationsApi.updateTemplate(id, { is_active: true, template_text: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast.success("Template text saved.");
      setEditingId(null);
    },
    onError: () => toast.error("Failed to save template text."),
  });

  const initMutation = useMutation({
    mutationFn: () => notificationsApi.createDefaultTemplates(""),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast.success("Default templates created.");
    },
    onError: () => toast.error("Failed to create default templates."),
  });

  if (isLoading) return <LoadingState />;

  if (!templates || templates.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={<Bell className="w-8 h-8 text-neutral-400" />}
          title="No notification templates"
          description="Create default templates to start sending automated SMS and WhatsApp notifications to customers."
          action={
            <Button
              onClick={() => initMutation.mutate()}
              isLoading={initMutation.isPending}
            >
              Create Default Templates
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        Customize the messages sent to customers at each stage of the repair.
        Use placeholders like <code className="bg-neutral-100 px-1 rounded text-xs">{"{{customer_name}}"}</code>,{" "}
        <code className="bg-neutral-100 px-1 rounded text-xs">{"{{job_number}}"}</code>,{" "}
        <code className="bg-neutral-100 px-1 rounded text-xs">{"{{otp}}"}</code>.
      </p>

      {templates.map((template) => {
        const ChannelIcon = CHANNEL_ICONS[template.channel] ?? Bell;
        const isEditing = editingId === template.id;

        return (
          <Card key={template.id} padding="md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <ChannelIcon className="w-4 h-4 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 text-sm">
                    {humanType(template.notification_type)}
                  </p>
                  <p className="text-xs text-neutral-500">via {template.channel}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  className="text-xs text-primary-600 hover:text-primary-700"
                  onClick={() => {
                    if (isEditing) {
                      setEditingId(null);
                    } else {
                      setEditingId(template.id);
                      setEditText(template.template_text);
                    }
                  }}
                >
                  {isEditing ? "Cancel" : "Edit message"}
                </button>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={template.is_active}
                    onChange={(e) =>
                      toggleMutation.mutate({ id: template.id, isActive: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
            </div>

            {isEditing && (
              <div className="mt-4 space-y-2">
                <textarea
                  className="w-full text-sm border border-neutral-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px] resize-y"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => textMutation.mutate({ id: template.id, text: editText })}
                    isLoading={textMutation.isPending}
                    disabled={!editText.trim()}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {!isEditing && (
              <p className="mt-3 text-xs text-neutral-500 bg-neutral-50 rounded-lg p-3 font-mono break-words">
                {template.template_text}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ─── Logs tab ────────────────────────────────────────────────────────────────

function LogsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["notification-logs", statusFilter, channelFilter],
    queryFn: () =>
      notificationsApi.listLogs({
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(channelFilter ? { channel: channelFilter } : {}),
      }),
  });

  const logs: NotificationLog[] = data?.results ?? (Array.isArray(data) ? data : []);

  const retryMutation = useMutation({
    mutationFn: (logId: string) => notificationsApi.retryLog(logId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      toast.success("Notification queued for retry.");
    },
    onError: () => toast.error("Failed to retry notification."),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          placeholder="All Status"
          options={[
            { value: "", label: "All Status" },
            { value: "SENT", label: "Sent" },
            { value: "FAILED", label: "Failed" },
            { value: "PENDING", label: "Pending" },
          ]}
        />
        <Select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="w-40"
          placeholder="All Channels"
          options={[
            { value: "", label: "All Channels" },
            { value: "SMS", label: "SMS" },
            { value: "WHATSAPP", label: "WhatsApp" },
            { value: "EMAIL", label: "Email" },
          ]}
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-8 h-8 text-neutral-400" />}
          title="No notifications yet"
          description="Notification delivery records will appear here once messages are sent."
        />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const ChannelIcon = CHANNEL_ICONS[log.channel] ?? Bell;
            const statusCfg = STATUS_CONFIG[log.status] ?? {
              label: log.status,
              variant: "warning" as const,
            };
            const StatusIcon =
              log.status === "SENT"
                ? CheckCircle2
                : log.status === "FAILED"
                  ? XCircle
                  : Clock;

            return (
              <Card key={log.id} padding="sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ChannelIcon className="w-4 h-4 text-neutral-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-neutral-900">
                        {log.customer_name}
                      </p>
                      <span className="text-xs text-neutral-400">{log.recipient_mobile}</span>
                      {log.job_number && (
                        <span className="text-xs text-primary-600 font-mono">
                          #{log.job_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">{log.message}</p>
                    {log.error_message && (
                      <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-1">
                      {log.sent_at ? formatDateLong(log.sent_at) : "Not sent yet"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusCfg.variant} size="sm">
                      <StatusIcon className="w-3 h-3 inline mr-1" />
                      {statusCfg.label}
                    </Badge>
                    {log.status === "FAILED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => retryMutation.mutate(log.id)}
                        isLoading={retryMutation.isPending}
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "templates", label: "Templates", icon: Settings },
  { id: "logs", label: "Delivery Log", icon: Bell },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("templates");

  return (
    <ProtectedRoute requiredPermission="canManageBranches">
      <AppLayout>
        <Header
          title="Notifications"
          subtitle="Manage automated customer messages and view delivery history"
        />

        <div className="p-6 space-y-6">
          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-neutral-100 rounded-xl w-fit">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-neutral-900 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "logs" && <LogsTab />}
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
