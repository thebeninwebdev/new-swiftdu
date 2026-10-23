"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  BusinessAIReview,
  PublicBusiness,
} from "@/lib/business-directory";
type AdminBusiness = PublicBusiness & {
  _id: string;
  status: string;
  isVisible: boolean;
  moderation?: BusinessAIReview;
};
export default function AdminBusinessesPage() {
  const [status, setStatus] = useState("review"),
    [page, setPage] = useState(1),
    [version, setVersion] = useState(0);
  const [rows, setRows] = useState<AdminBusiness[]>([]),
    [pages, setPages] = useState(0),
    [busy, setBusy] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/admin/businesses?status=${status}&page=${page}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setRows(data.businesses);
        setPages(data.pages);
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [status, page, version]);
  async function act(id: string, action: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/admin/businesses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Listing updated.");
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="mx-auto max-w-7xl p-5 pt-24 lg:p-10">
      <h1 className="text-3xl font-bold">Businesses</h1>
      <p className="mt-2 text-slate-500">
        Review community listings and manage directory visibility.
      </p>
      <div aria-label="Listing status" className="my-7 flex flex-wrap gap-2">
        {["approved", "review", "rejected", "hidden"].map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <Button onClick={() => setVersion((v) => v + 1)}>Retry</Button>
        </div>
      ) : loading ? (
        <p role="status">Loading listings…</p>
      ) : rows.length ? (
        <div className="space-y-5">
          {rows.map((b) => (
            <article
              key={b._id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-6 sm:flex-row">
                {(b.imageUrl || b.status === "review") && (
                  <Image
                    unoptimized
                    src={b.imageUrl || `/api/admin/businesses/${b._id}`}
                    alt={`${b.businessName} submitted image`}
                    width={160}
                    height={140}
                    className="h-36 w-40 rounded-2xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-bold">
                    {b.businessName}
                  </h2>
                  <p className="text-sm text-violet-700">
                    {b.category} · {b.status}
                    {!b.isVisible && b.status === "approved" ? " · hidden" : ""}
                  </p>
                  <p className="mt-3 break-words text-sm">{b.description}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Offers: {b.productsServices.join(", ")}
                  </p>
                  <p className="mt-2 text-sm">
                    Owner: {b.ownerName} · Phone: {b.phone} · WhatsApp:{" "}
                    {b.whatsapp}
                  </p>
                  <p className="break-words text-sm text-slate-500">
                    {[b.email, b.instagram && `@${b.instagram}`, b.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Submitted {new Date(b.createdAt).toLocaleString()}
                  </p>
                  {b.moderation && (
                    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                      <p className="font-semibold">
                        Automated review:{" "}
                        {Math.round(b.moderation.confidence * 100)}% confidence
                        · {b.moderation.decision}
                      </p>
                      <ul className="mt-2 list-inside list-disc text-slate-600">
                        {b.moderation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                      <p className="mt-2">
                        Flags: {b.moderation.flags.join(", ") || "None"}
                      </p>
                      <p>
                        Image safe: {b.moderation.imageSafe ? "Yes" : "No"} ·
                        Relevant: {b.moderation.imageRelevant ? "Yes" : "No"}
                      </p>
                      <p>
                        Duplicate assessment: {b.moderation.duplicateDecision} (
                        {Math.round(b.moderation.duplicateConfidence * 100)}%)
                      </p>
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {b.status === "review" && (
                      <Button
                        disabled={!!busy}
                        onClick={() => act(b._id, "approve")}
                      >
                        Approve
                      </Button>
                    )}
                    {b.status !== "rejected" && (
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => act(b._id, "reject")}
                      >
                        Reject
                      </Button>
                    )}
                    {b.status === "approved" && (
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() =>
                          act(b._id, b.isVisible ? "hide" : "restore")
                        }
                      >
                        {b.isVisible ? "Hide" : "Restore"}
                      </Button>
                    )}
                    {busy === b._id && (
                      <span role="status" className="p-2 text-sm">
                        Saving…
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-3xl bg-white p-10 text-center text-slate-500">
          No listings in this category.
        </p>
      )}
      <nav
        aria-label="Admin listing pages"
        className="mt-6 flex items-center gap-4"
      >
        <Button
          variant="outline"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>
        <span>
          Page {page} of {Math.max(pages, 1)}
        </span>
        <Button
          variant="outline"
          disabled={page >= pages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </nav>
    </main>
  );
}
