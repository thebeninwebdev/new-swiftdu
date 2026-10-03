import type { Metadata } from "next";
import BusinessDirectory from "@/components/business-directory/BusinessDirectory";
export const metadata: Metadata = {
  title: { absolute: "WDU Business Directory | Swiftdu" },
  alternates: { canonical: "/businesses" },
  description:
    "Discover businesses, services and student entrepreneurs across the Western Delta University community.",
};
export default function BusinessesPage() {
  return (
    <main className="min-h-screen bg-[#faf9f7] px-5 pb-20 pt-36 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="max-w-3xl pb-10">
          <p className="mb-5 text-sm font-bold uppercase tracking-widest text-indigo-600">
            The WDU community
          </p>
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl">
            WDU businesses.
            <br />
            <span className="text-indigo-600">All in one place.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Discover student businesses, services and creators across the
            Western Delta University community.
          </p>
        </header>
        <BusinessDirectory />
      </div>
    </main>
  );
}
