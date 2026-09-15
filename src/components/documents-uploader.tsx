"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordDocument } from "@/app/landlord/actions";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENT_TYPE_HELP, DOCUMENT_TYPE_LABEL, type DocumentType } from "@/lib/status-labels";

export type UploadedDocument = {
  id: string;
  document_type: DocumentType;
  original_filename: string;
  uploaded_at: string;
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: readonly DocumentType[] = ["id_document", "proof_of_ownership"];

/**
 * Uploads straight from the browser into the private `landlord-documents`
 * bucket (Storage RLS: only the owner's folder), then records metadata via a
 * server action. No automated verification — a human reviews the files.
 */
export function DocumentsUploader({
  landlordId,
  propertyId,
  documents,
  onUploaded,
}: {
  landlordId: string;
  propertyId?: string | null;
  documents: UploadedDocument[];
  onUploaded?: (doc: UploadedDocument) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {TYPES.map((type) => (
        <DocumentSlot
          key={type}
          type={type}
          landlordId={landlordId}
          propertyId={type === "proof_of_ownership" ? propertyId ?? null : null}
          existing={documents.filter((d) => d.document_type === type)}
          onUploaded={onUploaded}
        />
      ))}
    </div>
  );
}

function DocumentSlot({
  type,
  landlordId,
  propertyId,
  existing,
  onUploaded,
}: {
  type: DocumentType;
  landlordId: string;
  propertyId: string | null;
  existing: UploadedDocument[];
  onUploaded?: (doc: UploadedDocument) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function upload() {
    setError(null);
    if (!file) return setError("Choose a file first.");
    if (!ALLOWED.includes(file.type)) return setError("Only JPEG, PNG, WebP or PDF files are accepted.");
    if (file.size > MAX_BYTES) return setError("File is larger than 10 MB.");

    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "upload";
      const path = `${landlordId}/${type}/${crypto.randomUUID()}-${safeName}`;

      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("landlord-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }

      const result = await recordDocument({
        documentType: type,
        storagePath: path,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        propertyId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const doc: UploadedDocument = {
        id: result.data.id,
        document_type: type,
        original_filename: file.name,
        uploaded_at: new Date().toISOString(),
      };
      onUploaded?.(doc);
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
      <h3 className="font-medium">{DOCUMENT_TYPE_LABEL[type]}</h3>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{DOCUMENT_TYPE_HELP[type]}</p>

      {existing.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {existing.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <span className="text-emerald-700 dark:text-emerald-400">✓</span>
              <span className="truncate">{d.original_filename}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">Not uploaded yet.</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
          aria-label={`Choose ${DOCUMENT_TYPE_LABEL[type]} file`}
        />
        <button
          type="button"
          onClick={upload}
          disabled={busy || !file}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy ? "Uploading…" : existing.length ? "Upload a newer version" : "Upload"}
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
