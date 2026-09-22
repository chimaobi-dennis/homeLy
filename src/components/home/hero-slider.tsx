"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Slide = { eyebrow: string; title: string; cta: { label: string; href: string } };

const INTERVAL_MS = 6000;

/**
 * Text slider for the hero (reference: the owl-carousel of `.home-content` in
 * Sheltos "slider-filter-search"). The photo behind stays; only the copy slides.
 * Auto-advances every 6 s unless hovered/focused or the visitor prefers reduced motion.
 */
export function HeroSlider({ slides }: { slides: ReadonlyArray<Slide> }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const slide = slides[index] ?? slides[0];
  const go = (d: number) => setIndex((i) => (i + d + slides.length) % slides.length);

  return (
    <div
      className="home-slider"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="home-slider__content" key={index} aria-live="polite">
        <h6 className="home-slider__eyebrow">{slide.eyebrow}</h6>
        <h1 id="hero-heading" className="home-slider__title">
          {slide.title}
        </h1>
        <Link href={slide.cta.href} className="btn btn--gradient">
          {slide.cta.label}
        </Link>
      </div>
      {slides.length > 1 ? (
        <div className="home-slider__arrows">
          <button type="button" className="home-slider__arrow" onClick={() => go(-1)} aria-label="Previous slide">
            <Icon name="chevron-left" size={18} />
          </button>
          <button type="button" className="home-slider__arrow" onClick={() => go(1)} aria-label="Next slide">
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
