"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SAVED_KEY, useStoredList } from "@/lib/saved-store";

/**
 * /saved without ids: read the browser's saved list and go to /saved?ids=…, where
 * the server renders the cards. With nothing saved, show the empty state.
 */
export function SavedRedirect() {
  const ids = useStoredList(SAVED_KEY);
  const router = useRouter();

  useEffect(() => {
    if (ids.length) router.replace(`/saved?ids=${ids.join(",")}`);
  }, [ids, router]);

  if (ids.length) return <p className="font-roboto text-[var(--mute)]">Loading your saved homes…</p>;
  return (
    <div className="home-zero">
      <h3>No saved homes yet.</h3>
      <p className="font-roboto">Tap the heart on any home to keep it here. Saved homes stay in this browser.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/search" className="btn btn--gradient btn--pill">
          Browse available homes
        </Link>
      </div>
    </div>
  );
}
