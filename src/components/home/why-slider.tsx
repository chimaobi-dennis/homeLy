"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { MediaFrame, type MediaItem } from "./media-slider";

type Slide = { tag: string; heading: string; body: string; cta: { label: string; href: string } };

const INTERVAL_MS = 7000;

/**
 * "Why choose HomeLy": ONE slider. Each slide is the text card (tag, heading,
 * paragraph, button) plus the media beside it, and they move together. Media
 * comes from /admin/homepage in sort order; slide N shows media N (wrapping
 * around when there are fewer files than messages). Auto-advances every 7 s
 * unless hovered / focused, a video is playing, or reduced motion is preferred.
 */
export function WhySlider({ slides, media, headingId }: { slides: ReadonlyArray<Slide>; media: MediaItem[]; headingId: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (paused || videoPlaying || count < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, videoPlaying, count]);

  const slide = slides[index] ?? slides[0];
  const item = media.length ? media[index % media.length] : null;
  const go = (i: number) => {
    setVideoPlaying(false);
    setIndex(((i % count) + count) % count);
  };

  return (
    <div className="wrap home-why__grid" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="home-why__card reveal">
        <div className="home-why__slide" key={`t${index}`} aria-live="polite">
          <span className="home-why__tag">{slide.tag}</span>
          <h2 id={headingId}>{slide.heading}</h2>
          <p className="font-roboto">{slide.body}</p>
          <Link href={slide.cta.href} className="btn btn--gradient">
            {slide.cta.label}
          </Link>
        </div>
        {count > 1 ? (
          <div className="home-why__nav">
            <button type="button" className="home-why__arrow" onClick={() => go(index - 1)} aria-label="Previous">
              <Icon name="chevron-left" size={16} strokeWidth={2.4} />
            </button>
            <div className="home-why__dots" role="group" aria-label="Choose slide">
              {slides.map((s, i) => (
                <button key={s.heading} type="button" className={i === index ? "is-active" : undefined} onClick={() => go(i)} aria-label={`Slide ${i + 1} of ${count}`} aria-pressed={i === index} />
              ))}
            </div>
            <button type="button" className="home-why__arrow" onClick={() => go(index + 1)} aria-label="Next">
              <Icon name="chevron-right" size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : null}
      </div>
      <div className="home-why__media">
        <div className="home-media home-why__slide" key={`m${index}`}>
          {item ? <MediaFrame item={item} sizes="(min-width: 992px) 60vw, 100vw" priority={index === 0} onPlayingChange={setVideoPlaying} /> : <div className="home-media--empty font-roboto">Photos coming</div>}
        </div>
      </div>
    </div>
  );
}
