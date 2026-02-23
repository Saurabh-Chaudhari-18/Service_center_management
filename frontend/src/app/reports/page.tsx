"use client";

import dynamic from "next/dynamic";

// ReportsContent uses recharts which requires browser APIs (window).
// Dynamic import with ssr: false prevents the "window is not defined"
// error during Next.js server-side rendering.
const ReportsContent = dynamic(() => import("./ReportsContent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function ReportsPage() {
  return <ReportsContent />;
}
