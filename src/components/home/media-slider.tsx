"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "./icons";

export type MediaItem = { kind: "image" | "video"; url: string; alt?: string | null; caption?: string | null };

/**
 * One media item: an image, or a video with a play button and native controls
 * once playing. Reports playback so a parent slider can pause auto-advance.
 */
export function MediaFrame({
  item,
  sizes,
  priority = false,
  onPlayingChange,
}: {
  item: MediaItem;
  sizes: string;
  priority?: boolean;
  onPlayingChange?: (playing: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const set = (v: boolean) => {
    setPlaying(v);
    onPlayingChange?.(v);
  };

  if (item.kind === "video") {
    return (
      <>
        <video
          key={item.url}
          ref={videoRef}
          src={item.url}
          className="home-media__video"
          playsInline
          preload="metadata"
          controls={playing}
          onPlay={() => set(true)}
          onPause={() => set(false)}
          onEnded={() => set(false)}
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
    );
  }
  return (
    <>
      <Image key={item.url} src={item.url} alt={item.alt ?? item.caption ?? ""} fill sizes={sizes} className="object-cover" priority={priority} />
      {item.caption ? <span className="home-media__caption">{item.caption}</span> : null}
    </>
  );
}

/**
 * Self-contained one-at-a-time slider for images and videos (used by "Property
 * of the day"). Manual navigation only, so a playing video is never interrupted.
 */
export function MediaSlider({ items, sizes, priority = false, className = "" }: { items: MediaItem[]; sizes: string; priority?: boolean; className?: string }) {
  const [index, setIndex] = useState(0);
  const count = items.length;
  const item = items[Math.min(index, Math.max(count - 1, 0))];
  const go = (i: number) => setIndex(((i % count) + count) % count);

  if (!item) return <div className={`home-media home-media--empty font-roboto ${className}`}>Photos coming</div>;

  return (
    <div className={`home-media ${className}`}>
      <MediaFrame key={item.url} item={item} sizes={sizes} priority={priority && index === 0} />
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
