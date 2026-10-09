"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { PublicBusiness } from "@/lib/business-directory";
import BusinessCard from "./BusinessCard";
import BusinessFilters from "./BusinessFilters";
import BusinessSubmissionForm from "./BusinessSubmissionForm";
export default function BusinessDirectory() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
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
    setSearchOpen(true);
    window.history.replaceState(null, "", "/businesses");
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current) return;
    const value = query.trim();
    if (value.length < 2 || value.length > 200) {
      setError("Enter what you need (2–200 characters).");
      return;
    }
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
      <div className="mb-8 flex max-w-xl flex-col gap-3 sm:flex-row">
        <Button
          onClick={searchAgain}
          disabled={loading}
          className="h-auto min-h-12 whitespace-normal rounded-full bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-700"
        >
          {submitted === null
            ? "Search for a product or service"
            : "Search again"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="h-12 rounded-full px-6"
        >
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
          setSearchOpen(false);
          setQuery("");
          setError("");
          window.history.replaceState(null, "", "/businesses");
        }}
      />
      {searchOpen && (
        <BusinessFilters
          query={query}
          onQuery={setQuery}
          onSubmit={search}
          busy={loading}
          inputRef={inputRef}
        />
      )}
      <section
        aria-label="Business search results"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading ? (
          <p role="status" className="py-12 text-slate-500">
            Searching WDU businesses…
          </p>
        ) : error ? (
          <div role="alert" className="py-8">
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={searchAgain}>
              Try another search
            </Button>
          </div>
        ) : submitted !== null ? (
          <>
            {submitted && (
              <h2 className="mb-6 break-words text-lg font-semibold">
                Results for &quot;{submitted}&quot;
              </h2>
            )}
            {businesses.length ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {businesses.map((b) => (
                  <BusinessCard key={b.slug} business={b} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-white px-6 py-12 text-center">
                <h2 className="text-xl font-bold">
                  We couldn&apos;t find a business for that yet.
                </h2>
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
