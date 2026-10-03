"use client";
import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicBusiness } from "@/lib/business-directory";
import BusinessCard from "./BusinessCard";
import BusinessFilters from "./BusinessFilters";
import BusinessSubmissionForm from "./BusinessSubmissionForm";
export default function BusinessDirectory() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [listing, setListing] = useState("");
  const [data, setData] = useState<{
    businesses: PublicBusiness[];
    pages: number;
    total: number;
  }>({ businesses: [], pages: 0, total: 0 });
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("listing");
    if (slug) setListing(slug);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/businesses?${new URLSearchParams({ q: query, category, page: String(page), ...(listing ? { listing } : {}) })}`,
          { signal: controller.signal },
        );
        if (!response.ok)
          throw new Error("The directory could not load. Please try again.");
        setData(await response.json());
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, page, version, listing]);
  function reset() {
    setQuery("");
    setCategory("");
    setListing("");
    setPage(1);
    window.history.replaceState(null, "", "/businesses");
  }
  return (
    <>
      <div className="mb-12 flex items-center gap-5">
        <Button
          onClick={() => setOpen(true)}
          className="h-12 rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
        >
          List your business
        </Button>
        <span className="text-sm text-slate-500">
          Free to list. No account needed.
        </span>
      </div>
      <BusinessSubmissionForm
        open={open}
        onOpenChange={setOpen}
        onListed={() => {
          reset();
          setVersion((v) => v + 1);
        }}
      />
      <BusinessFilters
        query={query}
        category={category}
        onQuery={(v) => {
          setQuery(v);
          setListing("");
          setPage(1);
        }}
        onCategory={(v) => {
          setCategory(v);
          setListing("");
          setPage(1);
        }}
      />
      <section aria-label="Business listings" aria-busy={loading}>
        {loading ? (
          <p role="status" className="py-16 text-center text-slate-500">
            Loading businesses…
          </p>
        ) : error ? (
          <div role="alert" className="py-12 text-center">
            <p>{error}</p>
            <Button className="mt-4" onClick={() => setVersion((v) => v + 1)}>
              Try again
            </Button>
          </div>
        ) : data.businesses.length ? (
          <>
            <p className="mb-5 text-sm text-slate-500">
              {data.total} {data.total === 1 ? "business" : "businesses"}
              {listing && (
                <button
                  onClick={reset}
                  className="ml-4 text-indigo-600 underline"
                >
                  View all businesses
                </button>
              )}
            </p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {data.businesses.map((b) => (
                <BusinessCard key={b.slug} business={b} />
              ))}
            </div>
            <nav
              aria-label="Directory pages"
              className="mt-10 flex items-center justify-center gap-5"
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {page} of {data.pages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          </>
        ) : (
          <div className="rounded-3xl bg-white px-6 py-16 text-center">
            <Store className="mx-auto mb-4 text-indigo-500" size={36} />
            <h2 className="text-xl font-bold">
              {query || category || listing
                ? "No businesses match your search."
                : "No businesses found yet."}
            </h2>
            <p className="mt-3 text-slate-500">
              Make your business part of the WDU community.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={
                query || category || listing ? reset : () => setOpen(true)
              }
            >
              {query || category || listing
                ? "Reset filters"
                : "List your business"}
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
