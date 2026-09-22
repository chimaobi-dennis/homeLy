"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Gallery (reference: Sheltos "thumbnail-image" property page): one large photo
 * with a thumbnail strip; clicking a thumbnail swaps the large photo. Keyboard:
 * thumbnails are buttons; ← / → also move between photos.
 */
export function PhotoGallery({ photos, title }: { photos: Array<{ url: string; alt: string | null }>; title: string }) {
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? photos[0];

  if (!current) {
    return (
      <div className="home-gallery">
        <div className="home-gallery__main home-gallery__empty font-roboto">Photos coming</div>
      </div>
    );
  }

  return (
    <div
      className="home-gallery"
      onKeyDown={(e) => {
        if (photos.length < 2) return;
        if (e.key === "ArrowRight") setIndex((i) => (i + 1) % photos.length);
        if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + photos.length) % photos.length);
      }}
    >
      <div className="home-gallery__main">
        <Image key={current.url} src={current.url} alt={current.alt ?? `${title} — photo ${index + 1}`} fill priority sizes="(min-width: 1200px) 906px, 100vw" className="object-cover" />
        {photos.length > 1 ? (
          <span className="home-gallery__count data" aria-live="polite">
            {index + 1} / {photos.length}
          </span>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <ul className="home-gallery__thumbs" aria-label="Photos">
          {photos.map((p, i) => (
            <li key={p.url}>
              <button type="button" className={i === index ? "is-active" : undefined} onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index ? "true" : undefined}>
                <Image src={p.url} alt="" fill sizes="130px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
