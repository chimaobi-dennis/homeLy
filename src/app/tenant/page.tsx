import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { TENANT_ID_DOCUMENT_LABEL, TENANT_KYC_STATUS } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import { SubmitKycButton, TenantIdUploader } from "./client-parts";

export const metadata: Metadata = { title: "My status · HomeLy" };

/**
 * The tenant's own status page (Stage 2). Never silent: every kyc_status has a
 * label, a plain-language sentence, and the next thing (if anything) to do.
 * Tenant-facing copy must not say "search", "browse", "apply for" or "queue for an apartment".
 */
export default async function TenantStatusPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await requireSession("/tenant");
  const { welcome } = await searchParams;

  if (!hasRole(session.roleTags, "tenant")) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <h1 className="text-2xl font-semibold">Not a tenant account</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {session.email} is not on the tenant queue. Tenant accounts are created by invitation from the priority list.{" "}
            <Link href="/waitlist" className="underline underline-offset-4">
              Join the priority list
            </Link>
            .
          </p>
        </main>
      </>
    );
  }

  const supabase = await createClient();
  const [{ data: tenant }, { data: docs }] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", session.id).maybeSingle(),
    supabase.from("tenant_documents").select("id, original_filename, storage_path, uploaded_at").eq("tenant_id", session.id).order("uploaded_at", { ascending: false }),
  ]);

  if (!tenant) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <h1 className="text-2xl font-semibold">We could not find your queue record</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">Your account exists but is not linked to the queue yet. Contact HomeLy and we will fix it.</p>
        </main>
      </>
    );
  }

  const documents = docs ?? [];
  const signedUrls = new Map<string, string>();
  await Promise.all(
    documents.map(async (d) => {
      const { data } = await supabase.storage.from("tenant-documents").createSignedUrl(d.storage_path, 600);
      if (data?.signedUrl) signedUrls.set(d.id, data.signedUrl);
    }),
  );

  const status = TENANT_KYC_STATUS[tenant.kyc_status];
  const canSubmit = tenant.kyc_status === "not_started" || tenant.kyc_status === "rejected";
  const hasDoc = documents.length > 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">My status</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{session.fullName ?? session.email}</h1>
        </div>

        {welcome ? (
          <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
            Your account is ready and your place in the queue is kept. One more step below: upload your ID.
          </p>
        ) : null}

        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Identity check</h2>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <p className="mt-2 text-zinc-700 dark:text-zinc-300">{status.description}</p>

          {tenant.kyc_status === "rejected" ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/30">
              <p className="font-medium text-red-900 dark:text-red-200">Reason from our team</p>
              <p className="mt-1 whitespace-pre-line text-red-900 dark:text-red-100">{tenant.kyc_rejection_reason ?? "No reason was recorded. Please contact us."}</p>
              <p className="mt-3 text-red-900 dark:text-red-200">
                <strong>What to do next:</strong> upload a clearer document below, then press “Resubmit for review”.
              </p>
            </div>
          ) : null}

          {canSubmit ? (
            <div className="mt-4 flex flex-col gap-4">
              <TenantIdUploader tenantId={session.id} existingCount={documents.length} />
              <SubmitKycButton enabled={hasDoc} label={tenant.kyc_status === "rejected" ? "Resubmit for review" : "Submit for review"} />
            </div>
          ) : null}

          {tenant.kyc_status === "verified" ? (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              There are still no live listings. We will be in touch, in queue order, as homes become available.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Your documents</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Only you and HomeLy staff can open these. Links expire after 10 minutes.</p>
          {documents.length ? (
            <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              {documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{TENANT_ID_DOCUMENT_LABEL}</span>
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
        </section>

        <dl className="grid gap-x-6 gap-y-1 text-sm text-zinc-600 sm:grid-cols-[max-content_1fr] dark:text-zinc-400">
          <dt>Account created</dt>
          <dd>{new Date(tenant.converted_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</dd>
          <dt>Queue place</dt>
          <dd>Kept from the day you joined the priority list.</dd>
        </dl>
      </main>
    </>
  );
}
