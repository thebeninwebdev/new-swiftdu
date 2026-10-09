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
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            What are you looking for?
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Find products and services from businesses in the WDU community.
          </p>
        </header>
        <BusinessDirectory />
      </div>
    </main>
  );
}
