"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import { Card, Button, Input, LoadingState } from "@/components/ui";
import { authApi, notificationsApi } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Lock, Bell, Shield, Save } from "lucide-react";

// =====================================================
// Profile Section
// =====================================================

function ProfileSection() {
  const { user, currentBranch } = useAuth();

  return (
    <Card>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600">
          {user?.first_name?.[0]}
          {user?.last_name?.[0]}
        </div>
        <div>
          <h2 className="text-xl font-bold text-neutral-900">
            {user?.first_name} {user?.last_name}
          </h2>
          <p className="text-neutral-500">{user?.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Email Address
          </label>
          <Input value={user?.email || ""} readOnly className="bg-neutral-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Phone Number
          </label>
          <Input value={user?.phone || ""} readOnly className="bg-neutral-50" />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Current Branch
          </label>
          <Input
            value={currentBranch?.name || "No Branch Selected"}
            readOnly
            className="bg-neutral-50"
          />
        </div>
      </div>
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
      alert("Password updated successfully");
      reset();
    },
    onError: (error: Error) => {
      console.error(error);
      alert("Failed to update password. Please check your current password.");
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
  const { data: templates, isLoading } = useQuery({
    queryKey: ["notification-templates"],
    queryFn: () => notificationsApi.listTemplates(),
  });

  const { mutate } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      notificationsApi.updateTemplate(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: () => {
      alert("Failed to update preference");
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
// Main Settings Page
// =====================================================

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "profile" | "security" | "notifications"
  >("profile");

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
  ] as const;

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
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
