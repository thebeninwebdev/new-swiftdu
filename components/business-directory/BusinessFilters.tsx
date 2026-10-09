import type { FormEvent, RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export default function BusinessFilters({
  query,
  onQuery,
  onSubmit,
  busy,
  inputRef,
}: {
  query: string;
  onQuery: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-8 max-w-2xl rounded-3xl bg-white p-5 shadow-sm"
    >
      <label
        htmlFor="business-directory-search"
        className="mb-3 block text-sm font-semibold"
      >
        What do you need?
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          ref={inputRef}
          id="business-directory-search"
          type="search"
          enterKeyHint="search"
          value={query}
          minLength={2}
          maxLength={200}
          required
          disabled={busy}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="e.g. someone to build me a flyer"
          className="h-12 min-w-0 flex-1 rounded-xl"
        />
        <Button
          type="submit"
          disabled={busy || query.trim().length < 2}
          className="h-12 rounded-xl bg-indigo-600 px-6 text-white hover:bg-indigo-700"
        >
          Search
        </Button>
      </div>
    </form>
  );
}
