"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type StatusFilter = "pending" | "approved" | "rejected";

type DryCleaner = {
  _id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  location: string;
  businessLogo?: string;
  status: StatusFilter;
  pricing: {
    shirt: number;
    trouser: number;
    hoodieMin: number;
    hoodieMax: number;
    bedsheetMin: number;
    bedsheetMax: number;
    duvetMin?: number;
    duvetMax?: number;
    underwear?: number;
    shoes?: number;
    doesNotWashShirt?: boolean;
    doesNotWashTrouser?: boolean;
    doesNotWashHoodie?: boolean;
    doesNotWashBedsheet?: boolean;
    doesNotWashDuvet?: boolean;
    doesNotWashUnderwear?: boolean;
    doesNotWashShoes?: boolean;
  };
  availability: {
    acceptingDays: string[];
    expectedDeliveryDays: number;
    cutoffTime: string;
    temporarilyClosed: boolean;
  };
  notes?: string;
  createdAt: string;
  user: { name: string; email: string } | null;
};

const FILTERS: StatusFilter[] = ["pending", "approved", "rejected"];

function naira(value: number) {
  return `NGN ${Number(value || 0).toLocaleString()}`;
}

function washPrice(doesNotWash: boolean | undefined, value: string) {
  return doesNotWash === true ? `Not accepted - ${value}` : value;
}

export default function AdminDryCleanersPage() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [admin, setAdmin] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<DryCleaner[]>([]);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("pending");
  const [isFetching, setIsFetching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession();
        if (error || !data?.user) {
          router.push("/auth");
          return;
        }
        setAdmin(data.user);
      } catch {
        router.push("/auth");
      } finally {
        setIsLoading(false);
      }
    };

    void checkAuth();
  }, [router]);

  const loadDryCleaners = useCallback(async (status: StatusFilter) => {
    setIsFetching(true);
    try {
      const response = await fetch(`/api/admin/dry-cleaners?status=${status}`);
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Failed to load dry cleaners");
        return;
      }
      setItems(payload.dryCleaners || []);
    } catch {
      toast.error("Failed to load dry cleaners");
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void loadDryCleaners(activeFilter);
  }, [admin, activeFilter, loadDryCleaners]);

  const runAction = async (id: string, action: "approve" | "reject" | "close" | "reopen") => {
    setActionId(`${id}-${action}`);
    try {
      const response = await fetch(`/api/admin/dry-cleaners/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error || "Action failed");
        return;
      }

      toast.success("Dry cleaner updated");
      await loadDryCleaners(activeFilter);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setActionId(null);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading admin panel...</div>;
  }

  if (!admin) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Admin Panel</p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal">Dry Cleaner Applications</h1>
            <p className="mt-1 text-sm text-slate-600">Approve laundry providers and monitor their pricing and availability.</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
            {admin.name?.split(" ")[0]}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                activeFilter === filter ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {isFetching ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
            <p className="font-semibold text-slate-900">No {activeFilter} dry cleaners</p>
            <p className="mt-1 text-sm text-slate-500">There are no records in this status yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((dryCleaner) => (
              <article key={dryCleaner._id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500">
                      {dryCleaner.businessLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dryCleaner.businessLogo} alt={`${dryCleaner.businessName} logo`} className="h-full w-full object-cover" />
                      ) : (
                        dryCleaner.businessName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">{dryCleaner.businessName}</h2>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold capitalize text-slate-600">
                        {dryCleaner.status}
                      </span>
                      {dryCleaner.availability.temporarilyClosed ? (
                        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                          Closed
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {dryCleaner.ownerName} - {dryCleaner.phone} - {dryCleaner.location}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dryCleaner.user?.email || "No linked email"} - Applied {new Date(dryCleaner.createdAt).toLocaleDateString("en-GB")}
                    </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    {dryCleaner.status !== "approved" ? (
                      <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={Boolean(actionId)} onClick={() => runAction(dryCleaner._id, "approve")}>
                        {actionId === `${dryCleaner._id}-approve` ? "Approving..." : "Approve"}
                      </button>
                    ) : null}
                    {dryCleaner.status !== "rejected" ? (
                      <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50" disabled={Boolean(actionId)} onClick={() => runAction(dryCleaner._id, "reject")}>
                        {actionId === `${dryCleaner._id}-reject` ? "Rejecting..." : "Reject"}
                      </button>
                    ) : null}
                    {dryCleaner.status === "approved" ? (
                      <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={Boolean(actionId)} onClick={() => runAction(dryCleaner._id, dryCleaner.availability.temporarilyClosed ? "reopen" : "close")}>
                        {dryCleaner.availability.temporarilyClosed ? "Reopen" : "Close"}
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Shirt" value={washPrice(dryCleaner.pricing.doesNotWashShirt, naira(dryCleaner.pricing.shirt))} />
                  <Info label="Trouser" value={washPrice(dryCleaner.pricing.doesNotWashTrouser, naira(dryCleaner.pricing.trouser))} />
                  <Info label="Hoodie/Joggers" value={washPrice(dryCleaner.pricing.doesNotWashHoodie, `${naira(dryCleaner.pricing.hoodieMin)} - ${naira(dryCleaner.pricing.hoodieMax)}`)} />
                  <Info label="Bedsheet" value={washPrice(dryCleaner.pricing.doesNotWashBedsheet, `${naira(dryCleaner.pricing.bedsheetMin)} - ${naira(dryCleaner.pricing.bedsheetMax)}`)} />
                  <Info label="Duvet" value={washPrice(dryCleaner.pricing.doesNotWashDuvet !== false, `${naira(dryCleaner.pricing.duvetMin || 2000)} - ${naira(dryCleaner.pricing.duvetMax || 2500)}`)} />
                  <Info label="Underwear" value={washPrice(dryCleaner.pricing.doesNotWashUnderwear !== false, naira(dryCleaner.pricing.underwear || 500))} />
                  <Info label="Shoes" value={washPrice(dryCleaner.pricing.doesNotWashShoes !== false, naira(dryCleaner.pricing.shoes || 500))} />
                  <Info label="Accepting Days" value={dryCleaner.availability.acceptingDays.join(", ")} />
                  <Info label="Delivery" value={`${dryCleaner.availability.expectedDeliveryDays} day(s), cutoff ${dryCleaner.availability.cutoffTime}`} />
                </div>
                {dryCleaner.notes ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{dryCleaner.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize text-slate-900">{value}</p>
    </div>
  );
}
