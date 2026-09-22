"use client";

import { useRouter } from "next/navigation";
import { SORT_OPTIONS } from "@/lib/listings";

/** "Sort by …" select on /search: changes the `sort` param and goes back to page 1. */
export function SortSelect({ current, params }: { current: string; params: Record<string, string> }) {
  const router = useRouter();
  return (
    <label className="home-sort">
      <span className="sr-only">Sort results</span>
      <select
        value={current}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          p.set("sort", e.target.value);
          p.delete("page");
          router.push(`/search?${p.toString()}`);
        }}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
