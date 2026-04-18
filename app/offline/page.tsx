import type { Metadata } from "next";
import Image from "next/image";
import OfflineActions from "@/components/OfflineActions";

export const metadata: Metadata = {
  title: "Offline",
  description:
    "Swiftdu is offline right now. Reconnect to continue using campus errands and delivery services.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_26%),#f8fafc] px-6 py-12 text-gray-900">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center">
        <section className="w-full rounded-[2rem] border border-slate-200/70 bg-white/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-10">
          <Image
            src="/logo.png"
            alt="Swiftdu"
            width={150}
            height={44}
            className="h-11 w-auto"
            priority
          />
          <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shadow-[0_0_0_8px_rgba(99,102,241,0.12)]" />
            Offline mode
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-balance sm:text-5xl">
            You&apos;re offline for now.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Swiftdu will reconnect automatically when your internet comes back.
            You can retry now or return to the homepage once you&apos;re online
            again.
          </p>
          <OfflineActions />
        </section>
      </div>
    </main>
  );
}
