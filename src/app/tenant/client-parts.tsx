"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordTenantDocument, submitTenantKyc } from "./actions";
import { createClient } from "@/lib/supabase/client";
import { TENANT_ID_DOCUMENT_HELP, TENANT_ID_DOCUMENT_LABEL } from "@/lib/status-labels";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const primary = "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60";

/** Single-slot ID uploader: browser → private `tenant-documents` bucket (own folder only) → metadata via server action. */
export function TenantIdUploader({ tenantId, existingCount }: { tenantId: string; existingCount: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload() {
    setError(null);
    if (!file) return setError("Choose a file first.");
    if (!ALLOWED.includes(file.type)) return setError("Only JPEG, PNG, WebP or PDF files are accepted.");
    if (file.size > MAX_BYTES) return setError("File is larger than 10 MB.");
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";
      const path = `${tenantId}/id_document/${crypto.randomUUID()}-${safeName}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("tenant-documents").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return setError(`Upload failed: ${upErr.message}`);
      const res = await recordTenantDocument({ storagePath: path, originalFilename: file.name, mimeType: file.type, sizeBytes: file.size });
      if (!res.ok) return setError(res.error);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      startTransition(() => router.refresh());
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;
  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="font-medium">{TENANT_ID_DOCUMENT_LABEL}</h3>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{TENANT_ID_DOCUMENT_HELP}</p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
          aria-label={`Choose ${TENANT_ID_DOCUMENT_LABEL} file`}
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy || !file}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy ? "Uploading…" : existingCount ? "Upload a newer version" : "Upload"}
        </button>
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function SubmitKycButton({ enabled, label }: { enabled: boolean; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={primary + " self-start"}
        disabled={!enabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await submitTenantKyc();
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Submitting…" : label}
      </button>
      {!enabled ? <p className="text-xs text-zinc-500">Upload your ID first.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
