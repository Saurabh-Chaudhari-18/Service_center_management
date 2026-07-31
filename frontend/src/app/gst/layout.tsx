"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLayout, Header } from "@/components/layout/Layout";
import { ProtectedRoute, useAuth } from "@/context/AuthContext";
import { PageShell } from "@/components/shell";
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  ClipboardList,
  CreditCard,
  Hash,
  ShieldOff,
} from "lucide-react";

const NAV = [
  { href: "/gst",          label: "Dashboard",    icon: LayoutDashboard },
  { href: "/gst/itc",      label: "ITC Register", icon: ArrowDownCircle },
  { href: "/gst/output",   label: "Output Tax",   icon: ArrowUpCircle },
  { href: "/gst/gstr1",    label: "GSTR-1",       icon: FileText },
  { href: "/gst/gstr3b",   label: "GSTR-3B",      icon: ClipboardList },
  { href: "/gst/payments", label: "Payments",     icon: CreditCard },
  { href: "/gst/hsn",      label: "HSN / SAC",    icon: Hash },
];

function GSTNotApplicableBanner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center mb-5">
        <ShieldOff className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
        GST Not Applicable for This Branch
      </h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">
        This branch is not registered under GST. GST-related reports, registers,
        and filings are not available. You can enable GST in Branch Settings if
        this branch gets registered.
      </p>
    </div>
  );
}

export default function GSTLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { gstEnabled } = useAuth();

  return (
    <ProtectedRoute requiredPermission="canViewReports">
      <AppLayout>
        <Header
          title="GST"
          subtitle="Tax registers, filings, and compliance"
        />

        <PageShell width="fluid">
          {gstEnabled ? (
            <>
              {/* Horizontal sub-nav */}
              <div className="flex overflow-x-auto gap-1.5 pb-1 scrollbar-none">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                        active
                          ? "bg-primary-500 text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-slate-700 dark:text-neutral-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>

              {/* Child page content */}
              <div>{children}</div>
            </>
          ) : (
            <GSTNotApplicableBanner />
          )}
        </PageShell>
      </AppLayout>
    </ProtectedRoute>
  );
}
