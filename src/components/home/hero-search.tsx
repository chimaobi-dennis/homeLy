"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatNgn } from "@/lib/fees";
import type { PublicListingCard } from "@/lib/public-listings";
import { ListingQuickView } from "./listing-quick-view";

/**
 * The hero search. A free-text bar ("Search by area or keyword") with three
 * filters beside it: area (real listed areas), bedrooms, max annual rent.
 *
 * `live` (homepage): results appear in a dropdown under the bar as you type
 * or change a filter, each with the cover photo; picking one opens a quick
 * view on the same page. Nothing navigates unless the visitor clicks an
 * explicit link. It is still a plain GET form to /search underneath, so it
 * works before JavaScript loads and on the results page (`live` off).
 */

const BEDROOM_OPTIONS = [
  { value: "", label: "Any" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4 or more" },
];

const RENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "500000", label: "Up to ₦500,000" },
  { value: "1000000", label: "Up to ₦1,000,000" },
  { value: "1500000", label: "Up to ₦1,500,000" },
  { value: "2000000", label: "Up to ₦2,000,000" },
  { value: "3000000", label: "Up to ₦3,000,000" },
  { value: "5000000", label: "Up to ₦5,000,000" },
];

const DEBOUNCE_MS = 250;
const DROPDOWN_LIMIT = 8;

type Values = { q: string; area: string; bedrooms: string; maxRent: string };
type Status = "idle" | "loading" | "ready" | "error";

function toParams(v: Values): URLSearchParams {
  const p = new URLSearchParams();
  if (v.q.trim()) p.set("q", v.q.trim());
  if (v.area) p.set("area", v.area);
  if (v.bedrooms) p.set("bedrooms", v.bedrooms);
  if (v.maxRent) p.set("max_rent", v.maxRent);
  return p;
}

export function listingTitle(l: PublicListingCard): string {
  return l.listing_headline ?? `${l.bedrooms ?? "—"}-bedroom in ${l.area ?? l.city ?? "Enugu"}`;
}

export function HeroSearch({
  areas,
  current,
  idPrefix = "hero",
  live = false,
  whatsappE164 = null,
}: {
  areas: string[];
  current?: { q?: string | null; area?: string | null; bedrooms?: number | null; maxRent?: number | null };
  idPrefix?: string;
  live?: boolean;
  whatsappE164?: string | null;
}) {
  const [values, setValues] = useState<Values>({
    q: current?.q ?? "",
    area: current?.area ?? "",
    bedrooms: current?.bedrooms != null ? String(current.bedrooms) : "",
    maxRent: current?.maxRent != null ? String(current.maxRent) : "",
  });
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<PublicListingCard[]>([]);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState(-1);
  const [selected, setSelected] = useState<PublicListingCard | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const seq = useRef(0);
  const listboxId = `${idPrefix}-results`;

  // Cleanup only: cancel a pending debounce / in-flight request on unmount.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  async function fetchNow(v: Values) {
    if (!live) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const id = ++seq.current;
    setStatus("loading");
    setOpen(true);
    try {
      const p = toParams(v);
      p.set("limit", String(DROPDOWN_LIMIT));
      const res = await fetch(`/api/listings?${p.toString()}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { results: PublicListingCard[]; total: number };
      if (id !== seq.current) return; // a newer request has superseded this one
      setResults(body.results);
      setTotal(body.total);
      setActive(-1);
      setStatus("ready");
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError" || id !== seq.current) return;
      setStatus("error");
    }
  }

  function schedule(v: Values) {
    if (!live) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchNow(v), DEBOUNCE_MS);
    setOpen(true);
  }

  function update(patch: Partial<Values>, immediate: boolean) {
    const next = { ...values, ...patch };
    setValues(next);
    if (immediate) void fetchNow(next);
    else schedule(next);
  }

  function clearAll() {
    const empty: Values = { q: "", area: "", bedrooms: "", maxRent: "" };
    setValues(empty);
    void fetchNow(empty);
  }

  function choose(l: PublicListingCard) {
    setSelected(l);
    setOpen(false);
  }

  function onFocus() {
    if (!live) return;
    setOpen(true);
    if (status === "idle") void fetchNow(values);
  }

  function onBlur(e: React.FocusEvent<HTMLDivElement>) {
    // Close when focus leaves the whole widget (input, filters, dropdown links, dialog).
    if (!live) return;
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!live) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        onFocus();
        return;
      }
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
      // Otherwise the form's onSubmit runs the search in place.
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!live) return; // results page: normal GET navigation
    e.preventDefault();
    void fetchNow(values);
  }

  const hasAny = Boolean(values.q.trim() || values.area || values.bedrooms || values.maxRent);
  const needle = values.q.trim().toLowerCase();
  const areaMatches = live && needle ? areas.filter((a) => a.toLowerCase().includes(needle) && a !== values.area).slice(0, 4) : [];
  const showDropdown = live && open;

  return (
    <div className="home-search-wrap" onBlur={onBlur}>
      <form action="/search" method="get" role="search" aria-label="Find a home" className="home-search" onSubmit={onSubmit}>
        <div className="home-search__bar">
          <svg aria-hidden="true" className="home-search__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id={`${idPrefix}-q`}
            name="q"
            type="search"
            className="home-search__input"
            placeholder="Search by area or keyword"
            aria-label="Search available homes by area or keyword"
            autoComplete="off"
            spellCheck={false}
            maxLength={60}
            value={values.q}
            onChange={(e) => update({ q: e.target.value }, false)}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            role={live ? "combobox" : undefined}
            aria-expanded={live ? showDropdown : undefined}
            aria-controls={live ? listboxId : undefined}
            aria-autocomplete={live ? "list" : undefined}
            aria-activedescendant={showDropdown && active >= 0 ? `${listboxId}-${active}` : undefined}
          />
          <button type="submit" className="home-search__submit">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>Search</span>
          </button>
        </div>

        <div className="home-search__filters">
          <label className="home-search__filter">
            <span>Area</span>
            <select name="area" value={values.area} onChange={(e) => update({ area: e.target.value }, true)}>
              <option value="">Anywhere</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="home-search__filter">
            <span>Bedrooms</span>
            <select name="bedrooms" value={values.bedrooms} onChange={(e) => update({ bedrooms: e.target.value }, true)} className="data">
              {BEDROOM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="home-search__filter">
            <span>Max rent</span>
            <select name="max_rent" value={values.maxRent} onChange={(e) => update({ maxRent: e.target.value }, true)} className="data">
              {RENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {live && hasAny ? (
            <button type="button" className="home-search__clear" onClick={clearAll}>
              Clear
            </button>
          ) : null}
        </div>
      </form>

      {showDropdown ? (
        // mousedown is swallowed so the input keeps focus while a result is clicked.
        <div className="home-results" onMouseDown={(e) => e.preventDefault()}>
          {areaMatches.length ? (
            <div className="home-results__areas">
              <span className="home-results__group">Areas</span>
              {areaMatches.map((a) => (
                <button key={a} type="button" className="home-results__area" onClick={() => update({ area: a, q: "" }, true)}>
                  {a}
                </button>
              ))}
            </div>
          ) : null}

          {status === "loading" && results.length === 0 ? (
            <p className="home-results__note" role="status">
              Searching…
            </p>
          ) : null}

          {status === "error" ? (
            <p className="home-results__note" role="alert">
              Could not load homes right now.{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => void fetchNow(values)}>
                Try again
              </button>
            </p>
          ) : null}

          {status === "ready" && results.length === 0 ? (
            <div className="home-results__note">
              <p className="font-semibold text-[var(--ink)]">No homes match yet.</p>
              <p className="mt-1">Widen the search, or join the priority list and we will contact you in queue order as homes are listed.</p>
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <Link href="/waitlist" className="text-[var(--ink)] underline underline-offset-4">
                  Join the priority list
                </Link>
                {hasAny ? (
                  <button type="button" className="underline underline-offset-4" onClick={clearAll}>
                    Clear filters
                  </button>
                ) : null}
              </p>
            </div>
          ) : null}

          <ul
            id={listboxId}
            role="listbox"
            aria-label="Matching homes"
            className={`home-results__list${status === "loading" && results.length > 0 ? " is-stale" : ""}`}
            hidden={results.length === 0}
            aria-busy={status === "loading"}
          >
            {results.map((l, i) => (
              <li
                key={l.id}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`home-results__item${i === active ? " is-active" : ""}`}
                onClick={() => choose(l)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="home-results__thumb" aria-hidden="true">
                  {l.coverUrl ? <Image src={l.coverUrl} alt="" fill sizes="80px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="home-results__title font-semibold">{listingTitle(l)}</span>
                  <span className="block truncate text-xs text-[var(--mute)]">
                    {l.area ?? l.city ?? "Enugu"} · <span className="data">{l.bedrooms ?? "—"}</span> bed
                    {l.bathrooms != null ? (
                      <>
                        {" "}
                        · <span className="data">{l.bathrooms}</span> bath
                      </>
                    ) : null}{" "}
                    · Inspected
                  </span>
                </span>
                <span className="home-results__rent data whitespace-nowrap text-sm font-semibold">
                  {formatNgn(l.annual_rent)}
                  <span className="text-[0.7rem] font-normal text-[var(--mute)]">/yr</span>
                </span>
              </li>
            ))}
          </ul>

          {results.length > 0 && status !== "error" ? (
            <div className="home-results__foot">
              <span className="text-[var(--mute)]" aria-live="polite">
                {status === "loading" ? (
                  "Updating…"
                ) : total > results.length ? (
                  <>
                    Showing <span className="data">{results.length}</span> of <span className="data">{total}</span>
                  </>
                ) : (
                  <>
                    <span className="data">{total}</span> {total === 1 ? "home" : "homes"}
                  </>
                )}
              </span>
              <Link href={`/search?${toParams(values).toString()}`} className="text-[var(--ink)] underline underline-offset-4">
                Open full results
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {live ? <ListingQuickView listing={selected} onClose={() => setSelected(null)} whatsappE164={whatsappE164} /> : null}
    </div>
  );
}
