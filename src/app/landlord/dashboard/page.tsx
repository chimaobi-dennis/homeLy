import type { Metadata } from "next";
import Link from "next/link";
import { DocumentsUploader } from "@/components/documents-uploader";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { OPS_LEAD } from "@/lib/content/enugu-ops";
import { formatNgn } from "@/lib/fees";
import { hasRole } from "@/lib/roles";
import {
  AGREEMENT_STATUS,
  DOCUMENT_TYPE_LABEL,
  LANDLORD_STATUS,
  PROPERTY_STATUS,
  type DocumentType,
} from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { PropertyResubmitForm, SubmitForReviewButton } from "./client-parts";

export const metadata: Metadata = { title: "My application · HomeLy" };

const REQUIRED_DOCS: readonly DocumentType[] = ["id_document", "proof_of_ownership"];

/**
 * The landlord's own view of their application. The one rule: never be silent
 * about status — every state has a label, a plain-language sentence, and the
 * next thing (if anything) the landlord must do.
 */
export default async function LandlordDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await requireSession("/landlord/dashboard");
  const { submitted } = await searchParams;

  if (!hasRole(session.roleTags, "landlord")) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Not a landlord account</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {session.email} is a staff or admin account. This page is for landlords.
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const [{ data: landlord }, { data: properties }, { data: documents }] = await Promise.all([
    supabase.from("landlords").select("*").eq("id", session.id).maybeSingle(),
    supabase.from("properties").select("*").eq("landlord_id", session.id).order("created_at", { ascending: true }),
    supabase
      .from("landlord_documents")
      .select("id, document_type, property_id, original_filename, storage_path, uploaded_at")
      .eq("landlord_id", session.id)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (!landlord) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">You have not applied yet</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">Your account exists, but we have no property from you.</p>
        <Link href="/landlord/apply/form" className="mt-4 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
          Start your application
        </Link>
      </main>
    );
  }

  const docs = documents ?? [];
  const props = properties ?? [];
  const uploadedTypes = new Set(docs.map((d) => d.document_type));
  const missingDocs = REQUIRED_DOCS.filter((t) => !uploadedTypes.has(t));
  const hasBothDocs = missingDocs.length === 0;

  // Signed URLs, created with the landlord's OWN session (owner-read storage policy). Short-lived.
  const signedUrls = new Map<string, string>();
  await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from("landlord-documents").createSignedUrl(d.storage_path, 60 * 10);
      if (data?.signedUrl) signedUrls.set(d.id, data.signedUrl);
    }),
  );

  const status = LANDLORD_STATUS[landlord.status];
  const agreement = AGREEMENT_STATUS[landlord.agreement_status];
  const canSubmitForReview = landlord.status === "applied" || landlord.status === "kyc_rejected";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">My application</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.fullName ?? session.email}</h1>
      </div>

      {submitted ? (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
          Thank you — your application and documents are in. We will email you when the review is done.
        </p>
      ) : null}

      {/* ---------------- Application / KYC status ---------------- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your account</h2>
          <StatusBadge label={status.label} tone={status.tone} />
        </div>
        <p className="mt-2 text-zinc-700 dark:text-zinc-300">{status.description}</p>

        {landlord.status === "kyc_rejected" ? (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
            <p className="font-medium text-red-900 dark:text-red-200">Reason from our team</p>
            <p className="mt-1 whitespace-pre-line text-red-900 dark:text-red-100">
              {landlord.kyc_rejection_reason ?? "No reason was recorded. Please contact us."}
            </p>
            <p className="mt-3 text-red-900 dark:text-red-200">
              <strong>What to do next:</strong> upload corrected documents below, then press “Resubmit for review”.
            </p>
          </div>
        ) : null}

        {landlord.status === "applied" ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {hasBothDocs
              ? "Both documents are uploaded. Press the button to send your application for review."
              : `Still needed: ${missingDocs.map((t) => DOCUMENT_TYPE_LABEL[t]).join(" and ")}.`}
          </p>
        ) : null}

        {canSubmitForReview ? (
          <div className="mt-4">
            <SubmitForReviewButton
              enabled={hasBothDocs}
              label={landlord.status === "kyc_rejected" ? "Resubmit for review" : "Submit for review"}
            />
          </div>
        ) : null}

        <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-zinc-500">Country of residence</dt>
          <dd>{landlord.country_of_residence ?? "—"}</dd>
          <dt className="text-zinc-500">Applied on</dt>
          <dd>{new Date(landlord.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</dd>
        </dl>
      </section>

      {/* ---------------- Agreement ---------------- */}
      {landlord.status === "kyc_verified" ? (
        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Management agreement</h2>
            <StatusBadge label={agreement.label} tone={agreement.tone} />
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">{agreement.description}</p>
        </section>
      ) : null}

      {/* ---------------- Documents ---------------- */}
      <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Your documents</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Only you and HomeLy staff can open these. Links expire after 10 minutes.
        </p>
        {docs.length ? (
          <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{DOCUMENT_TYPE_LABEL[d.document_type]}</span>
                  <span className="text-zinc-500"> · {d.original_filename}</span>
                </span>
                <span className="flex items-center gap-3 text-zinc-500">
                  {new Date(d.uploaded_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}
                  {signedUrls.get(d.id) ? (
                    <a href={signedUrls.get(d.id)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      Open
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">Nothing uploaded yet.</p>
        )}
        {landlord.status !== "kyc_verified" ? (
          <div className="mt-4">
            <DocumentsUploader
              landlordId={session.id}
              propertyId={props[0]?.id ?? null}
              documents={docs.map((d) => ({
                id: d.id,
                document_type: d.document_type,
                original_filename: d.original_filename,
                uploaded_at: d.uploaded_at,
              }))}
            />
          </div>
        ) : null}
      </section>

      {/* ---------------- Properties ---------------- */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your properties</h2>
          <Link href="/landlord/apply/form" className="text-sm underline underline-offset-4">
            Add another property
          </Link>
        </div>
        {props.length === 0 ? <p className="text-sm text-zinc-600">No properties yet.</p> : null}
        {props.map((p) => {
          const ps = PROPERTY_STATUS[p.status];
          return (
            <article key={p.id} className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.address}</h3>
                  <p className="text-sm text-zinc-500">
                    {p.city} · {p.bedrooms} bedroom(s) · target {formatNgn(p.target_annual_rent)} / year · maintenance limit{" "}
                    {formatNgn(p.maintenance_threshold_ngn)}
                  </p>
                </div>
                <StatusBadge label={ps.label} tone={ps.tone} />
              </div>
              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{ps.description}</p>
              {p.status === "rejected" ? (
                <div className="mt-3 flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
                  <div>
                    <p className="font-medium text-red-900 dark:text-red-200">Reason from our team</p>
                    <p className="mt-1 whitespace-pre-line text-red-900 dark:text-red-100">
                      {p.rejection_reason ?? "No reason was recorded. Please contact us."}
                    </p>
                  </div>
                  <PropertyResubmitForm property={p} />
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      <section className="rounded-xl bg-zinc-50 p-6 text-sm dark:bg-zinc-900">
        <p className="font-medium">Questions?</p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          {OPS_LEAD.name}, {OPS_LEAD.title} — {OPS_LEAD.contact}
        </p>
      </section>
    </main>
  );
}
