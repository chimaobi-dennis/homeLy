"use client";

import { useState } from "react";
import { Icon } from "./icons";

/** Share (native share sheet, else copy the link) and Print (reference: Share / Save / Print row). */
export function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled the share sheet */
    }
  }

  return (
    <div className="home-single__actions">
      <button type="button" className="btn btn--gradient btn--pill" onClick={() => void share()}>
        <Icon name="share" size={15} />
        {copied ? "Link copied" : "Share"}
      </button>
      <button type="button" className="btn btn--dashed" onClick={() => window.print()}>
        <Icon name="print" size={15} />
        Print
      </button>
    </div>
  );
}
