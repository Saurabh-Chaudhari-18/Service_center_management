"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Wrench,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Crown,
  BriefcaseBusiness,
  Phone,
  Calculator,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, Input } from "@/components/ui";

// =====================================================
// Validation Schema
// =====================================================

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS: Array<{
  label: string;
  email: string;
  icon: React.ElementType;
}> = [
  { label: "Owner", email: "demo-owner@scm.local", icon: Crown },
  { label: "Manager", email: "demo-manager@scm.local", icon: BriefcaseBusiness },
  { label: "Technician", email: "demo-tech@scm.local", icon: Wrench },
  { label: "Receptionist", email: "demo-reception@scm.local", icon: Phone },
  { label: "Accountant", email: "demo-accounts@scm.local", icon: Calculator },
  { label: "Super Admin", email: "demo-superadmin@scm.local", icon: ShieldCheck },
];

// =====================================================
// Login Page Component
// =====================================================

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showDemo = true; // Enabled for easy access during customer demos

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setError(null);

    try {
      await login(data.email, data.password);
      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination =
        requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
          ? requestedPath
          : "/dashboard";
      router.replace(destination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary-500/20 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent-500/20 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="glass rounded-2xl p-8 shadow-2xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-accent mb-4 shadow-lg">
              <Wrench className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900">ServiceHub</h1>
            <p className="text-neutral-600 mt-2">
              Multi-Branch Service Center Management
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="w-5 h-5" />}
              error={errors.email?.message}
              {...register("email")}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                leftIcon={<Lock className="w-5 h-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
                error={errors.password?.message}
                {...register("password")}
              />
            </div>

            <p className="text-sm text-neutral-600 text-right -mt-2">
              Forgot your password? Contact your branch administrator to reset your account.
            </p>

            <Button
              type="submit"
              className="w-full h-12 text-base"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Demo Credentials Info */}
          {showDemo && (
            <div className="mt-6 p-4 bg-neutral-50/80 rounded-xl border border-neutral-100">
              <p className="text-xs font-semibold text-neutral-600 mb-2 text-center">
                Quick Demo Login (Click to autofill)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map(({ label, email, icon: Icon }) => (
                  <Button
                    key={email}
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Icon className="h-4 w-4" />}
                    onClick={() => {
                      setValue("email", email);
                      setValue("password", "demo12345");
                    }}
                    className="w-full justify-start rounded-lg text-xs shadow-sm"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Build Info */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-sm text-white/60">
            © 2026 ServiceHub. All rights reserved.
          </p>
          <p className="text-xs text-white/40 font-mono">
            Build: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local"}{" "}
            | {process.env.NEXT_PUBLIC_BUILD_TIMESTAMP
              ? new Date(process.env.NEXT_PUBLIC_BUILD_TIMESTAMP).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", hour12: true,
                  timeZone: "Asia/Kolkata",
                })
              : "dev"}
          </p>
        </div>
      </div>
    </div>
  );
}
