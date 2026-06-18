import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Operations Suspended",
  description: "Swiftdu operations have been suspended till further notice.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OperationsSuspendedPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-2xl items-center justify-center">
        <section className="w-full text-center">
          <Image
            src="/logo.png"
            alt="Swiftdu"
            width={180}
            height={44}
            className="mx-auto h-12 w-auto object-contain"
            priority
          />
          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Service notice
          </div>
          <h1 className="mt-7 text-4xl font-black leading-tight text-balance sm:text-6xl">
            Swiftdu operations have been suspended till further notice.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
            We apologize for any inconvenience this may cause. Please check
            back later for updates.
          </p>
        </section>
      </div>
    </main>
  );
}
