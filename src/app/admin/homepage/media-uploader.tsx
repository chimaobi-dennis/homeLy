"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordHomepageMedia } from "./actions";
import { SITE_MEDIA_BUCKET, SITE_MEDIA_MAX_BYTES, siteMediaKind, siteMediaPath } from "@/lib/listings";
import { createClient } from "@/lib/supabase/client";

/**
 * Upload one image or video for the homepage slider: browser → public
 * `site-media` bucket (admin insert policy; the bucket enforces mime + size) →
 * recordHomepageMedia. Same pattern as the property photo uploader.
 */
export function MediaUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function upload() {
    if (!file) return;
    const kind = siteMediaKind(file.type);
    if (!kind) return setMessage("Only JPEG, PNG, WebP images or MP4, WebM, MOV videos.");
    if (file.size > SITE_MEDIA_MAX_BYTES) return setMessage("Larger than 60 MB.");
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const path = siteMediaPath(file.name);
    const { error: upErr } = await supabase.storage.from(SITE_MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setBusy(false);
      return setMessage(`Upload failed (${upErr.message}).`);
    }
    const res = await recordHomepageMedia({ storagePath: path, mimeType: file.type, sizeBytes: file.size, caption });
    setMessage(res.ok ? `${file.name} added as ${kind}.` : res.error);
    setFile(null);
    setCaption("");
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Choose an image or video" />
      <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Caption (optional)" className="w-full max-w-md rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900" aria-label="Caption" />
      <button
        type="button"
        onClick={upload}
        disabled={busy || !file}
        className="self-start rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {message ? <p className="text-xs text-zinc-600 dark:text-zinc-400">{message}</p> : null}
    </div>
  );
}
