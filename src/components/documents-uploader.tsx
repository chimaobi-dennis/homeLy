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
  property_id?: string | null;
};

export type UploaderProperty = { id: string; address: string };

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: readonly DocumentType[] = ["id_document", "proof_of_ownership"];

/**
 * Uploads straight from the browser into the private `landlord-documents`
 * bucket (Storage RLS: only the owner's folder), then records metadata via a
 * server action. No automated verification — a human reviews the files.
 *
 * Proof of ownership belongs to ONE property: with a single property it is
 * chosen automatically; with several, the landlord must pick (the server
 * enforces this too).
 */
export function DocumentsUploader({
  landlordId,
  properties,
  documents,
  onUploaded,
}: {
  landlordId: string;
  properties: UploaderProperty[];
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
          properties={type === "proof_of_ownership" ? properties : []}
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
  properties,
  existing,
  onUploaded,
}: {
  type: DocumentType;
  landlordId: string;
  properties: UploaderProperty[];
  existing: UploadedDocument[];
  onUploaded?: (doc: UploadedDocument) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [propertyId, setPropertyId] = useState<string>(properties.length === 1 ? properties[0].id : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const isProof = type === "proof_of_ownership";
  const mustChoose = isProof && properties.length > 1;
  const addressOf = (id: string | null | undefined) => properties.find((p) => p.id === id)?.address;

  async function upload() {
    setError(null);
    if (!file) return setError("Choose a file first.");
    if (!ALLOWED.includes(file.type)) return setError("Only JPEG, PNG, WebP or PDF files are accepted.");
    if (file.size > MAX_BYTES) return setError("File is larger than 10 MB.");
    if (mustChoose && !propertyId) return setError("Choose which property this proof of ownership is for.");

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
        propertyId: isProof && propertyId ? propertyId : null,
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
        property_id: isProof && propertyId ? propertyId : null,
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
            <li key={d.id} className="flex items-start gap-2">
              <span className="text-emerald-700 dark:text-emerald-400">✓</span>
              <span className="min-w-0">
                <span className="block truncate">{d.original_filename}</span>
                {isProof && addressOf(d.property_id) ? (
                  <span className="block truncate text-xs text-zinc-500">for {addressOf(d.property_id)}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">Not uploaded yet.</p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        {mustChoose ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Which property is this proof for?</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Property for this proof of ownership"
            >
              <option value="">Choose a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}
                </option>
              ))}
            </select>
          </label>
        ) : isProof && properties.length === 1 ? (
          <p className="text-xs text-zinc-500">For: {properties[0].address}</p>
        ) : null}
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
          disabled={busy || !file || (mustChoose && !propertyId)}
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
