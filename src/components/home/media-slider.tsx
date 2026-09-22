"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "./icons";

export type MediaItem = { kind: "image" | "video"; url: string; alt?: string | null; caption?: string | null };

/**
 * One-at-a-time slider for images and videos (reference: the media block next to
 * the "worried about moving out" card and the property-of-the-day photo slider).
 * Videos show a play button and native controls once playing. Manual navigation
 * only, so a playing video is never interrupted by auto-advance.
 */
export function MediaSlider({ items, sizes, priority = false, className = "" }: { items: MediaItem[]; sizes: string; priority?: boolean; className?: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const count = items.length;
  const item = items[Math.min(index, Math.max(count - 1, 0))];
  const go = (i: number) => {
    setPlaying(false);
    setIndex(((i % count) + count) % count);
  };

  if (!item) {
    return <div className={`home-media home-media--empty font-roboto ${className}`}>Photos coming</div>;
  }

  return (
    <div className={`home-media ${className}`}>
      {item.kind === "video" ? (
        <>
          <video
            key={item.url}
            ref={videoRef}
            src={item.url}
            className="home-media__video"
            playsInline
            preload="metadata"
            controls={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            aria-label={item.caption ?? "Video"}
          />
          {!playing ? (
            <button type="button" className="home-media__play" onClick={() => void videoRef.current?.play()} aria-label="Play video">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ) : null}
        </>
      ) : (
        <Image key={item.url} src={item.url} alt={item.alt ?? item.caption ?? ""} fill sizes={sizes} className="object-cover" priority={priority && index === 0} />
      )}
      {item.caption && item.kind === "image" ? <span className="home-media__caption">{item.caption}</span> : null}
      {count > 1 ? (
        <>
          <button type="button" className="home-slide__arrow home-slide__arrow--prev" onClick={() => go(index - 1)} aria-label="Previous">
            <Icon name="chevron-left" size={14} strokeWidth={2.4} />
          </button>
          <button type="button" className="home-slide__arrow home-slide__arrow--next" onClick={() => go(index + 1)} aria-label="Next">
            <Icon name="chevron-right" size={14} strokeWidth={2.4} />
          </button>
          <div className="home-slide__dots" role="group" aria-label="Choose slide">
            {items.map((it, i) => (
              <button key={it.url} type="button" className={i === index ? "is-active" : undefined} onClick={() => go(i)} aria-label={`Slide ${i + 1} of ${count}`} aria-pressed={i === index} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
