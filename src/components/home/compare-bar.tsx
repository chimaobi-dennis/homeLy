"use client";

import Link from "next/link";
import { COMPARE_KEY, COMPARE_MAX, useStoredList, writeList } from "@/lib/saved-store";
import { Icon } from "./icons";

/** Sticky bottom bar that appears once a home is added to compare. */
export function CompareBar() {
  const ids = useStoredList(COMPARE_KEY);
  if (ids.length === 0) return null;
  const href = `/compare?ids=${ids.join(",")}`;
  return (
    <div className="home-compare-bar" role="region" aria-label="Compare selection">
      <div className="wrap home-compare-bar__row">
        <p>
          <Icon name="compare" size={16} /> <span className="data">{ids.length}</span> of <span className="data">{COMPARE_MAX}</span> homes selected to compare
        </p>
        <div className="home-compare-bar__actions">
          <button type="button" className="btn btn--dashed" onClick={() => writeList(COMPARE_KEY, [])}>
            Clear
          </button>
          {ids.length >= 2 ? (
            <Link href={href} className="btn btn--gradient btn--pill">
              Compare now
            </Link>
          ) : (
            <span className="home-compare-bar__hint font-roboto">Add one more to compare</span>
          )}
        </div>
      </div>
    </div>
  );
}
