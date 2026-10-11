"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Search, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicBusiness } from "@/lib/business-directory";
import BusinessCard from "./BusinessCard";
import BusinessFilters from "./BusinessFilters";
import BusinessSubmissionForm from "./BusinessSubmissionForm";
export default function BusinessDirectory() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("listing");
    if (!slug) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setSubmitted("");
    fetch(`/api/businesses?${new URLSearchParams({ listing: slug })}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setBusinesses(data.businesses);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("The listing could not load. Please try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          requestRef.current = null;
        }
      });
    return () => controller.abort();
  }, []);
  useEffect(() => () => requestRef.current?.abort(), []);
  function searchAgain() {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
    setSubmitted(null);
    setError("");
    window.history.replaceState(null, "", "/businesses");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query);
  }
  async function search(rawQuery: string) {
    const value = rawQuery.trim();
    if (value.length < 2 || value.length > 200) {
      setError("Enter what you need (2–200 characters).");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setQuery(value);
    setSubmitted(value);
    setLoading(true);
    setError("");
    window.history.replaceState(null, "", "/businesses");
    try {
      const response = await fetch(
        `/api/businesses/search?${new URLSearchParams({ q: value })}`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!controller.signal.aborted) setBusinesses(data.businesses);
    } catch {
      if (!controller.signal.aborted)
        setError("Search could not load. Please try again.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        requestRef.current = null;
      }
    }
  }
  return (
    <>
      <BusinessFilters
        query={query}
        onQuery={setQuery}
        onSubmit={submitSearch}
        onSuggestion={(value) => void search(value)}
        busy={loading}
        inputRef={inputRef}
      />
      <div className="mb-14 mt-7 flex justify-center sm:mb-20 lg:mb-32">
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-full border-slate-200/80 bg-white/60 px-5 text-xs text-slate-600 hover:border-indigo-200 hover:bg-white"
        >
          <Store aria-hidden="true" className="size-4" />
          List your business
        </Button>
      </div>
      <BusinessSubmissionForm
        open={open}
        onOpenChange={setOpen}
        onListed={() => {
          requestRef.current?.abort();
          requestRef.current = null;
          setLoading(false);
          setSubmitted(null);
          setQuery("");
          setError("");
          window.history.replaceState(null, "", "/businesses");
        }}
      />
      <section
        aria-label="Business search results"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading ? (
          <div
            role="status"
            className="flex flex-col items-center rounded-3xl bg-indigo-50/60 px-5 py-12 text-center"
          >
            <LoaderCircle
              aria-hidden="true"
              className="mb-4 size-7 text-indigo-600 motion-safe:animate-spin"
            />
            <p className="font-semibold text-slate-900">
              Searching WDU businesses&hellip;
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Looking for the best matches.
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="py-8">
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={searchAgain}>
              Try another search
            </Button>
          </div>
        ) : submitted !== null ? (
          <>
            {businesses.length ? (
              <>
                <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                      {submitted
                        ? `I found ${businesses.length} ${businesses.length === 1 ? "business" : "businesses"} that may help`
                        : "Here's the business you're looking for"}
                    </h2>
                    {submitted && (
                      <p className="mt-2 break-words text-slate-600">
                        &ldquo;{submitted}&rdquo;
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    onClick={searchAgain}
                    className="min-h-11 shrink-0 text-indigo-700"
                  >
                    Search again
                  </Button>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {businesses.map((b) => (
                    <BusinessCard key={b.slug} business={b} />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-3xl bg-white px-6 py-12 text-center">
                <Search
                  aria-hidden="true"
                  className="mx-auto mb-4 size-7 text-indigo-500"
                />
                <h2 className="text-xl font-bold">
                  I couldn&apos;t find an exact match yet.
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                  Try describing what you need another way. You can be as
                  specific or general as you like.
                </p>
                <Button
                  variant="outline"
                  className="mt-6"
                  onClick={searchAgain}
                >
                  Try another search
                </Button>
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}
