"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed lists for the public site (no tenant accounts yet):
 * saved homes (favourites) and the compare selection. Kept per browser only.
 * Read through useSyncExternalStore so React never sets state in an effect and
 * server render (empty list) hydrates cleanly before the browser's list applies.
 */
export const SAVED_KEY = "homely:saved";
export const COMPARE_KEY = "homely:compare";
export const COMPARE_MAX = 3;

const listeners = new Set<() => void>();
const EMPTY = "[]";

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function readRaw(key: string): string {
  try {
    return localStorage.getItem(key) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

export function writeList(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* private mode / blocked storage: the UI simply won't remember */
  }
  listeners.forEach((l) => l());
}

export function useStoredList(key: string): string[] {
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => EMPTY);
  return parse(raw);
}

/** Toggle `id` in the list; `max` (if set) refuses to add beyond that many. Returns false when refused. */
export function toggleInList(key: string, id: string, max?: number): boolean {
  const ids = parse(readRaw(key));
  if (ids.includes(id)) {
    writeList(key, ids.filter((x) => x !== id));
    return true;
  }
  if (max != null && ids.length >= max) return false;
  writeList(key, [...ids, id]);
  return true;
}
