"use client";

import { useState, type CSSProperties } from "react";
import { formatNgn } from "@/lib/fees";

/** Serialisable formatter choice (a function prop cannot cross the server → client boundary). */
const FORMAT: Record<"ngn" | "sqm", (n: number) => string> = {
  ngn: (n) => formatNgn(n),
  sqm: (n) => `${n} m²`,
};

/**
 * Dual-handle range (reference: ngx-slider "Price : $3,000 - $5,000"). Two native
 * range inputs stacked on one track, so it submits as two GET fields, works with a
 * keyboard, and needs no library. A handle at its bound means "no limit".
 */
export function RangeSlider({
  label,
  minName,
  maxName,
  min,
  max,
  step,
  defaultMin,
  defaultMax,
  unit,
}: {
  label: string;
  minName: string;
  maxName: string;
  min: number;
  max: number;
  step: number;
  defaultMin?: number | null;
  defaultMax?: number | null;
  unit: "ngn" | "sqm";
}) {
  const format = FORMAT[unit];
  const [lo, setLo] = useState(defaultMin ?? min);
  const [hi, setHi] = useState(defaultMax ?? max);
  const pct = (v: number) => `${((v - min) / (max - min)) * 100}%`;

  return (
    <div className="home-range">
      <p className="home-range__label">
        {label} : <span className="data">{format(lo)}</span> - <span className="data">{format(hi)}</span>
      </p>
      <div className="home-range__track" style={{ "--lo": pct(lo), "--hi": pct(hi) } as CSSProperties}>
        <input
          type="range"
          name={minName}
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => setLo(Math.min(Number(e.target.value), hi - step))}
          aria-label={`Minimum ${label.toLowerCase()}`}
        />
        <input
          type="range"
          name={maxName}
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => setHi(Math.max(Number(e.target.value), lo + step))}
          aria-label={`Maximum ${label.toLowerCase()}`}
        />
      </div>
    </div>
  );
}
