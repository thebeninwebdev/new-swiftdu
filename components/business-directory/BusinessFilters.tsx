import type { FormEvent, RefObject } from "react";
import {
  ArrowRight,
  Camera,
  Search,
  Sparkles,
  PenTool,
  Utensils,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
const suggestions = [
  { label: "I need a photographer", icon: Camera },
  { label: "Where can I buy perfume?", icon: Sparkles },
  { label: "Someone to make a flyer", icon: PenTool },
  { label: "Food & drinks", icon: Utensils },
];
export default function BusinessFilters({
  query,
  onQuery,
  onSubmit,
  onSuggestion,
  busy,
  inputRef,
}: {
  query: string;
  onQuery: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSuggestion: (value: string) => void;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[640px]">
      <form onSubmit={onSubmit} role="search" aria-label="Find WDU businesses">
        <label htmlFor="business-directory-search" className="sr-only">
          Describe what you need
        </label>
        <div className="flex items-center gap-2 rounded-[1.4rem] border border-indigo-100/70 bg-white p-2 shadow-[0_8px_35px_-12px_rgba(67,56,202,0.16)] focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 sm:gap-3 sm:p-3.5">
          <Search
            aria-hidden="true"
            className="ml-2 hidden size-5 shrink-0 text-indigo-500 sm:block"
          />
          <Input
            ref={inputRef}
            id="business-directory-search"
            type="search"
            enterKeyHint="search"
            value={query}
            minLength={2}
            maxLength={200}
            required
            aria-describedby="business-search-help"
            onChange={(event) => onQuery(event.target.value)}
            placeholder="e.g. I need someone to design a flyer for my event"
            className="h-14 min-w-0 flex-1 border-0 bg-transparent px-2 text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-base"
          />
          <Button
            type="submit"
            disabled={busy}
            aria-label="Search businesses"
            className="size-12 shrink-0 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500"
          >
            <ArrowRight aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <p
          id="business-search-help"
          className="mt-3 text-center text-sm text-slate-500"
        >
          Search naturally &mdash; just describe what you need.
        </p>
      </form>
      <div
        aria-label="Example searches"
        className="mt-7 flex gap-2.5 overflow-x-auto pb-3 sm:flex-wrap sm:justify-center"
      >
        {suggestions.map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            disabled={busy}
            onClick={() => onSuggestion(label)}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-indigo-100/80 bg-white/90 px-3.5 text-xs text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            <Icon aria-hidden="true" className="size-4 text-indigo-500" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
