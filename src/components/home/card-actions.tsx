"use client";

import { useState } from "react";
import { COMPARE_KEY, COMPARE_MAX, SAVED_KEY, toggleInList, useStoredList } from "@/lib/saved-store";
import { Icon } from "./icons";

/** Compare + favourite buttons on a card (reference: the two round-square buttons on the image). */
export function CardActions({ id, title }: { id: string; title: string }) {
  const saved = useStoredList(SAVED_KEY);
  const compare = useStoredList(COMPARE_KEY);
  const [note, setNote] = useState<string | null>(null);
  const isSaved = saved.includes(id);
  const isCompared = compare.includes(id);

  return (
    <div className="home-prop__actions">
      <button
        type="button"
        className={`home-prop__iconbtn${isCompared ? " is-on" : ""}`}
        aria-pressed={isCompared}
        aria-label={isCompared ? `Remove ${title} from compare` : `Add ${title} to compare`}
        title={isCompared ? "Remove from compare" : "Add to compare"}
        onClick={() => {
          const ok = toggleInList(COMPARE_KEY, id, COMPARE_MAX);
          setNote(ok ? null : `You can compare up to ${COMPARE_MAX} homes`);
          if (!ok) setTimeout(() => setNote(null), 2500);
        }}
      >
        <Icon name="compare" size={16} />
      </button>
      <button
        type="button"
        className={`home-prop__iconbtn home-prop__iconbtn--heart${isSaved ? " is-on" : ""}`}
        aria-pressed={isSaved}
        aria-label={isSaved ? `Remove ${title} from saved homes` : `Save ${title}`}
        title={isSaved ? "Saved" : "Save"}
        onClick={() => toggleInList(SAVED_KEY, id)}
      >
        <Icon name="heart" size={16} fill={isSaved ? "currentColor" : "none"} />
      </button>
      {note ? (
        <span className="home-prop__note" role="status">
          {note}
        </span>
      ) : null}
    </div>
  );
}
