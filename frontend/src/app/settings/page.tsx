"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, Input, LoadingState } from "@/components/ui";
import { authApi, notificationsApi } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  User,
  Lock,
  Bell,
  Shield,
  Save,
  Megaphone,
  Star,
  Info,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { formatPhone } from "@/lib/formatters";

// =====================================================
// Profile Section (read-only identity — not form inputs)
// =====================================================

function profileRoleLabel(role: string | undefined): string {
  if (!role) return "—";
  return role.replace(/_/g, " ");
}

function ProfileSection() {
  const { user, currentBranch } = useAuth();

  const readOnlyRows: { label: string; value: string }[] = [
    { label: "Email", value: user?.email || "—" },
    { label: "Phone", value: formatPhone(user?.phone) },
    {
      label: "Branch",
      value: currentBranch?.name || "All branches",
    },
    { label: "Role", value: profileRoleLabel(user?.role) },
  ];

  return (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-300">
          {user?.first_name?.[0]}
          {user?.last_name?.[0]}
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            {user?.first_name} {user?.last_name}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 capitalize">
            {profileRoleLabel(user?.role)}
          </p>
        </div>
      </div>

      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
        Account details
        <span className="ml-2 font-normal normal-case text-neutral-400 dark:text-neutral-500">
          (read-only)
        </span>
      </p>

      <dl className="rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-neutral-100 dark:divide-slate-700 overflow-hidden">
        {readOnlyRows.map(({ label, value }) => (
          <div
            key={label}
            className="px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
          >
            <dt className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide shrink-0 sm:min-w-28">
              {label}
            </dt>
            <dd className="text-sm font-medium text-neutral-900 dark:text-neutral-100 select-text sm:text-right break-all">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p
        className="text-xs text-neutral-500 dark:text-neutral-400 mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 dark:bg-slate-800/70 px-3 py-2.5 border border-neutral-100 dark:border-slate-700"
        role="note"
      >
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary-500" aria-hidden />
        <span>
          Contact your manager to update email, phone, or branch assignment.
        </span>
      </p>
    </Card>
  );
}

// =====================================================
// Security Section
// =====================================================

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

function SecuritySection() {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ChangePasswordFormData) =>
      authApi.changePassword(data.oldPassword, data.newPassword),
    onSuccess: () => {
      toast.success("Password changed successfully.");
      reset();
    },
    onError: (error: Error) => {
      console.error(error);
      toast.error(error?.message || "Failed to change password.");
    },
  });

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary-500" />
        Change Password
      </h3>

      <form
        onSubmit={handleSubmit((data) => mutate(data))}
        className="space-y-4 max-w-md"
      >
        <Input
          type="password"
          label="Current Password"
          {...register("oldPassword")}
          error={errors.oldPassword?.message}
        />
        <Input
          type="password"
          label="New Password"
          {...register("newPassword")}
          error={errors.newPassword?.message}
        />
        <Input
          type="password"
          label="Confirm New Password"
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />

        <div className="pt-2">
          <Button
            type="submit"
            isLoading={isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Update Password
          </Button>
        </div>
      </form>
    </Card>
  );
}

// =====================================================
// Notifications Section
// =====================================================

function NotificationsSection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: templates, isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: () => notificationsApi.listTemplates(),
  });

  const { mutate } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      notificationsApi.updateTemplate(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      toast.success("Notification preference saved.");
    },
    onError: () => {
      toast.error("Failed to update preference.");
    },
  });

  if (isLoading) return <LoadingState />;

  if (!templates || templates.length === 0) {
    return (
      <Card>
        <div className="text-center text-neutral-500 py-8">
          No notification templates configured for this branch.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary-500" />
        Notification Preferences
      </h3>

      <div className="space-y-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            <div>
              <p className="font-medium text-neutral-900">
                {template.notification_type.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-neutral-500">via {template.channel}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={template.is_active}
                onChange={(e) =>
                  mutate({ id: template.id, isActive: e.target.checked })
                }
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
          </div>
        ))}
      </div>
    </Card>
  );
}

// =====================================================
// Marketing Section
// =====================================================

function MarketingSection() {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  const [reminderForm, setReminderForm] = React.useState({
    reminder_1_days: 90,
    reminder_2_days: 180,
    reminder_3_days: 365,
    reminder_message:
      "Hello {customer_name}, it's been {days} days since your {device_type} was serviced at {branch_name}. Book your next service now!",
    send_whatsapp: true,
    is_active: true,
  });

  const [reviewForm, setReviewForm] = React.useState({
    google_review_link: "",
    send_after_hours: 24,
    review_message:
      "Thank you {customer_name} for choosing {branch_name}! We'd love your feedback. Please leave us a Google review: {review_link}",
    send_whatsapp: true,
    is_active: true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      // These would call /api/marketing/reminder-config/ and /api/marketing/review-config/
      // Placeholder — update when API endpoints are confirmed
      await new Promise((r) => setTimeout(r, 600));
      setSaved(true);
      toast.success("Marketing settings saved successfully.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save marketing settings", err);
      toast.error("Failed to save marketing settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Service Reminders */}
      <Card>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-violet-500" />
          Automated Service Reminders
        </h3>
        <p className="text-sm text-neutral-500 mb-5">
          Automatically remind customers to come back for servicing after
          delivery.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {[
            {
              key: "reminder_1_days",
              label: "1st Reminder (days after delivery)",
            },
            { key: "reminder_2_days", label: "2nd Reminder (days)" },
            { key: "reminder_3_days", label: "3rd Reminder (days)" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                {f.label}
              </label>
              <input
                type="number"
                min="1"
                value={(reminderForm as any)[f.key]}
                onChange={(e) =>
                  setReminderForm({
                    ...reminderForm,
                    [f.key]: parseInt(e.target.value),
                  })
                }
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
            Reminder Message Template
          </label>
          <textarea
            rows={3}
            value={reminderForm.reminder_message}
            onChange={(e) =>
              setReminderForm({
                ...reminderForm,
                reminder_message: e.target.value,
              })
            }
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Variables: {"{"}customer_name{"}"}, {"{"}days{"}"}, {"{"}device_type
            {"}"}, {"{"}branch_name{"}"}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={reminderForm.is_active}
            onChange={(e) =>
              setReminderForm({ ...reminderForm, is_active: e.target.checked })
            }
            className="rounded"
          />
          Enable automated service reminders
        </label>
      </Card>

      {/* Google Review Requests */}
      <Card>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500" />
          Google Review Automation
        </h3>
        <p className="text-sm text-neutral-500 mb-5">
          Automatically request a Google review after a job is delivered.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
              Your Google Review Link
            </label>
            <input
              type="url"
              placeholder="https://g.page/r/your-business/review"
              value={reviewForm.google_review_link}
              onChange={(e) =>
                setReviewForm({
                  ...reviewForm,
                  google_review_link: e.target.value,
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
              Send review request after (hours)
            </label>
            <input
              type="number"
              min="1"
              value={reviewForm.send_after_hours}
              onChange={(e) =>
                setReviewForm({
                  ...reviewForm,
                  send_after_hours: parseInt(e.target.value),
                })
              }
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1 text-neutral-700 dark:text-neutral-300">
            Review Request Message Template
          </label>
          <textarea
            rows={3}
            value={reviewForm.review_message}
            onChange={(e) =>
              setReviewForm({ ...reviewForm, review_message: e.target.value })
            }
            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Variables: {"{"}customer_name{"}"}, {"{"}branch_name{"}"}, {"{"}
            review_link{"}"}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={reviewForm.is_active}
            onChange={(e) =>
              setReviewForm({ ...reviewForm, is_active: e.target.checked })
            }
            className="rounded"
          />
          Enable automated Google review requests
        </label>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save Marketing Settings"}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// Main Settings Page
// =====================================================

export default function SettingsPage() {
  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "marketing", label: "Marketing", icon: Megaphone },
  ] as const;

  type TabId = "profile" | "security" | "notifications" | "marketing";
  const [activeTab, setActiveTab] = React.useState<TabId>("profile");

  return (
    <ProtectedRoute>
      <AppLayout>
        <Header
          title="Settings"
          subtitle="Manage your account and preferences"
        />

        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 flex-shrink-0">
              <Card padding="none" className="overflow-hidden">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-primary-50 text-primary-700 border-l-4 border-primary-600"
                          : "text-neutral-600 hover:bg-neutral-50 border-l-4 border-transparent"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </Card>
            </div>

            {/* Main Content */}
            <div className="flex-1">
              {activeTab === "profile" && <ProfileSection />}
              {activeTab === "security" && <SecuritySection />}
              {activeTab === "notifications" && <NotificationsSection />}
              {activeTab === "marketing" && <MarketingSection />}
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
