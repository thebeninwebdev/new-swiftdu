"use client";

import dynamic from "next/dynamic";

import type { ExcoRole } from "@/lib/exco-constants";

const ExcoDashboard = dynamic(() => import("@/components/exco-dashboard"), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-[#F7F5F0] px-4 py-6 text-[#22231F]">
      <div className="mx-auto flex min-h-[55vh] w-full max-w-6xl items-center justify-center">
        <div className="rounded-[8px] border border-[#D9D5C8] bg-white px-5 py-4 text-sm font-semibold text-[#6F5F4C] shadow-sm">
          Loading dashboard...
        </div>
      </div>
    </main>
  ),
});

export function ExcoDashboardLoader({ role }: { role: ExcoRole }) {
  return <ExcoDashboard role={role} />;
}
