"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPropertyPhoto } from "../actions";
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MIME, photoStoragePath } from "@/lib/listings";
import { createClient } from "@/lib/supabase/client";

/**
 * Multi-file photo upload: browser → private `property-photos` bucket (staff/
 * admin insert policy) → recordPropertyPhoto per file. No client-side image
 * processing on purpose (no new dependencies); the bucket enforces mime + size.
 */
export function PhotoUploader({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  async function upload() {
    if (files.length === 0) return;
    setBusy(true);
    const messages: string[] = [];
    const supabase = createClient();
    for (const file of files) {
      if (!(PHOTO_MIME as readonly string[]).includes(file.type)) {
        messages.push(`${file.name}: only JPEG, PNG or WebP.`);
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        messages.push(`${file.name}: larger than 8 MB.`);
        continue;
      }
      const path = photoStoragePath(propertyId, file.name);
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        messages.push(`${file.name}: upload failed (${upErr.message}).`);
        continue;
      }
      const res = await recordPropertyPhoto({ propertyId, storagePath: path, mimeType: file.type, sizeBytes: file.size });
      messages.push(res.ok ? `${file.name}: added.` : `${file.name}: ${res.error}`);
    }
    setLog(messages);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        aria-label="Choose photos"
      />
      <button
        type="button"
        onClick={upload}
        disabled={busy || files.length === 0}
        className="self-start rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {busy ? "Uploading…" : files.length ? `Upload ${files.length} photo${files.length > 1 ? "s" : ""}` : "Upload"}
      </button>
      {log.length ? (
        <ul className="text-xs text-zinc-600 dark:text-zinc-400">
          {log.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
