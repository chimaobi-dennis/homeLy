"use client";

import Link from "next/link";
import { SAVED_KEY, useStoredList } from "@/lib/saved-store";
import { Icon } from "./icons";

/** "Saved" link in the header with a count of saved homes (reference: the heart icon in the header). */
export function SavedLink() {
  const ids = useStoredList(SAVED_KEY);
  return (
    <Link href="/saved" className="home-nav__saved" aria-label={`Saved homes${ids.length ? `, ${ids.length}` : ""}`}>
      <Icon name="heart" size={18} fill={ids.length ? "currentColor" : "none"} />
      <span>Saved</span>
      {ids.length ? <span className="home-nav__count data">{ids.length}</span> : null}
    </Link>
  );
}
