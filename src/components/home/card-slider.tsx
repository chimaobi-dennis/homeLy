"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "./icons";

/**
 * Photo slider inside a listing card (reference: `.property-slider`): the photo
 * links to the property page; arrows and dots move between the listing's
 * photos without leaving the list. Arrows show on hover (always on touch).
 */
export function CardSlider({ photos, title, href, priority = false }: { photos: Array<{ url: string; alt: string | null }>; title: string; href: string; priority?: boolean }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))];
  const go = (d: number) => setIndex((i) => (i + d + count) % count);

  return (
    <div className="home-slide">
      <Link href={href} className="home-slide__link" aria-label={title} tabIndex={-1}>
        {current ? (
          <Image key={current.url} src={current.url} alt={current.alt ?? title} fill sizes="(min-width: 1200px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" priority={priority} />
        ) : (
          <div className="home-prop__nophoto font-roboto">Photos coming</div>
        )}
      </Link>
      {count > 1 ? (
        <>
          <button type="button" className="home-slide__arrow home-slide__arrow--prev" onClick={() => go(-1)} aria-label="Previous photo">
            <Icon name="chevron-left" size={14} strokeWidth={2.4} />
          </button>
          <button type="button" className="home-slide__arrow home-slide__arrow--next" onClick={() => go(1)} aria-label="Next photo">
            <Icon name="chevron-right" size={14} strokeWidth={2.4} />
          </button>
          <div className="home-slide__dots" role="group" aria-label="Choose photo">
            {photos.map((p, i) => (
              <button key={p.url} type="button" className={i === index ? "is-active" : undefined} onClick={() => setIndex(i)} aria-label={`Photo ${i + 1} of ${count}`} aria-pressed={i === index} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
