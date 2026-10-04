import { Input } from "@/components/ui/input";
import { BUSINESS_CATEGORIES } from "@/lib/business-directory-policy";
export default function BusinessFilters({
  query,
  category,
  onQuery,
  onCategory,
}: {
  query: string;
  category: string;
  onQuery: (v: string) => void;
  onCategory: (v: string) => void;
}) {
  return (
    <div className="mb-8 grid gap-4 rounded-3xl bg-white p-5 shadow-sm md:grid-cols-[1fr_280px]">
      <label htmlFor="business-directory-search" className="space-y-2 text-sm font-semibold">
        <span>Find your next campus favourite</span>
        <Input
          id="business-directory-search"
          value={query}
          maxLength={100}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search businesses, products or services"
          className="h-12 rounded-xl"
        />
      </label>
      <label htmlFor="business-directory-category" className="space-y-2 text-sm font-semibold">
        <span>Category</span>
        <select
          id="business-directory-category"
          value={category}
          onChange={(e) => onCategory(e.target.value)}
          className="h-12 w-full rounded-xl border bg-white px-3"
        >
          <option value="">All categories</option>
          {BUSINESS_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
