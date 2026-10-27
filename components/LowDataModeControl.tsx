"use client";

import { useNetworkState, type LowDataPreference } from "@/hooks/use-network-state";

const options: Array<{ value: LowDataPreference; label: string }> = [
  { value: "automatic", label: "Automatic" },
  { value: "on", label: "Always on" },
  { value: "off", label: "Always off" },
];

export function LowDataModeControl() {
  const { lowData, preference, setPreference } = useNetworkState();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Low Data Mode</h2>
          <p className="mt-1 text-sm text-slate-500">
            Uses static mascots and avoids optional media on slower connections.
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lowData ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
          {lowData ? "Active" : "Inactive"}
        </span>
      </div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="low-data-mode">
        Preference
      </label>
      <select
        id="low-data-mode"
        value={preference}
        onChange={(event) => setPreference(event.target.value as LowDataPreference)}
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700"
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </section>
  );
}
