"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLayout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/context/AuthContext";
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle,
  FileText, ClipboardList, CreditCard, Hash,
} from "lucide-react";

const NAV = [
  { href: "/gst",         label: "Dashboard",      icon: LayoutDashboard },
  { href: "/gst/itc",     label: "ITC Register",   icon: ArrowDownCircle },
  { href: "/gst/output",  label: "Output Tax",     icon: ArrowUpCircle },
  { href: "/gst/gstr1",   label: "GSTR-1",         icon: FileText },
  { href: "/gst/gstr3b",  label: "GSTR-3B",        icon: ClipboardList },
  { href: "/gst/payments",label: "Payments",       icon: CreditCard },
  { href: "/gst/hsn",     label: "HSN / SAC",      icon: Hash },
];

export default function GSTLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ProtectedRoute requiredPermission="canViewReports">
      <AppLayout>
        <div className="flex min-h-screen bg-neutral-50">
          {/* Sidebar */}
          <aside className="w-56 shrink-0 bg-white border-r border-neutral-200 pt-6 pb-4 flex flex-col gap-1 px-3">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest px-3 mb-2">
              GST Module
            </p>
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </aside>

          {/* Main content */}
          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
