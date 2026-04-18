'use client'

import Link from "next/link";

export default function OfflineActions() {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-indigo-100 px-5 py-3 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-200"
      >
        Try again
      </button>
      <Link
        href="/"
        className="rounded-full bg-gray-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800"
      >
        Go to homepage
      </Link>
    </div>
  );
}
