import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { formatNgn } from "@/lib/fees";
import { AGREEMENT_STATUS, DOCUMENT_TYPE_LABEL, LANDLORD_STATUS, PROPERTY_STATUS } from "@/lib/status-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation";
import { markAgreementSigned, sendAgreement, setLandlordKyc, setPropertyStatus } from "../actions";

export const metadata: Metadata = { title: "Review landlord · HomeLy admin" };

const box = "rounded-md border border-zinc-300 p-4 dark:border-zinc-700";
const btn = "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900";
const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

/** Internal review screen. Function over form. */
export default async function AdminLandlordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const { id } = await params;
  const { msg, error } = await searchParams;
  if (!isUuid(id)) notFound();

  const supabase = await createClient(); // admin's own session; RLS lets admin read everything below
  const [{ data: landlord }, { data: profile }, { data: documents }, { data: properties }, userRes] = await Promise.all([
    supabase.from("landlords").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("full_name, phone, role_tags").eq("id", id).maybeSingle(),
    supabase.from("landlord_documents").select("*").eq("landlord_id", id).order("uploaded_at", { ascending: false }),
    supabase.from("properties").select("*").eq("landlord_id", id).order("created_at", { ascending: true }),
    createAdminClient().auth.admin.getUserById(id),
  ]);
  if (!landlord) notFound();

  const docs = documents ?? [];
  const props = properties ?? [];
  const email = userRes.data.user?.email ?? "—";

  // Signed URLs via the admin's OWN session (storage policy: staff/admin read all). 10 minutes.
  const signed = new Map<string, string>();
  await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from("landlord-documents").createSignedUrl(d.storage_path, 600);
      if (data?.signedUrl) signed.set(d.id, data.signedUrl);
    }),
  );

  const ls = LANDLORD_STATUS[landlord.status];
  const ag = AGREEMENT_STATUS[landlord.agreement_status];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
      <Link href="/admin/landlords" className="text-sm underline">
        ← All landlords
      </Link>

      {msg ? <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p> : null}
      {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <section className={box}>
        <h1 className="text-xl font-semibold">{profile?.full_name ?? "(no name)"}</h1>
        <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-zinc-500">Email</dt>
          <dd>{email}</dd>
          <dt className="text-zinc-500">Phone</dt>
          <dd>{profile?.phone ?? "—"}</dd>
          <dt className="text-zinc-500">Country of residence</dt>
          <dd>{landlord.country_of_residence ?? "—"}</dd>
          <dt className="text-zinc-500">Role tags</dt>
          <dd>{profile?.role_tags.join(", ")}</dd>
          <dt className="text-zinc-500">Applied</dt>
          <dd>{new Date(landlord.created_at).toLocaleString("en-NG")}</dd>
          <dt className="text-zinc-500">KYC status</dt>
          <dd>
            <StatusBadge label={ls.label} tone={ls.tone} /> <span className="text-zinc-500">({landlord.status})</span>
          </dd>
          {landlord.kyc_rejection_reason ? (
            <>
              <dt className="text-zinc-500">Rejection reason</dt>
              <dd className="whitespace-pre-line">{landlord.kyc_rejection_reason}</dd>
            </>
          ) : null}
          <dt className="text-zinc-500">Agreement</dt>
          <dd>
            <StatusBadge label={ag.label} tone={ag.tone} /> <span className="text-zinc-500">({landlord.agreement_status})</span>
          </dd>
        </dl>
      </section>

      <section className={box}>
        <h2 className="font-semibold">Documents ({docs.length})</h2>
        {docs.length === 0 ? <p className="mt-2 text-sm text-zinc-500">None uploaded.</p> : null}
        <ul className="mt-2 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong>{DOCUMENT_TYPE_LABEL[d.document_type]}</strong> · {d.original_filename} · {d.mime_type} ·{" "}
                {(d.size_bytes / 1024).toFixed(0)} KB · {new Date(d.uploaded_at).toLocaleString("en-NG")}
              </span>
              {signed.get(d.id) ? (
                <a href={signed.get(d.id)} target="_blank" rel="noreferrer" className="underline">
                  Open (signed URL, 10 min)
                </a>
              ) : (
                <span className="text-red-700">could not sign URL</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={box}>
        <h2 className="font-semibold">KYC decision</h2>
        <form action={setLandlordKyc} className="mt-2 flex flex-col gap-2 text-sm">
          <input type="hidden" name="landlordId" value={landlord.id} />
          <label className="flex items-center gap-2">
            <input type="radio" name="decision" value="kyc_verified" required /> Verified — ID and ownership check out
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="decision" value="kyc_rejected" /> Rejected — landlord will see the reason below
          </label>
          <label className="flex flex-col gap-1">
            <span>Reason (required for rejection; shown to the landlord verbatim)</span>
            <textarea name="reason" rows={3} className={input} />
          </label>
          <button type="submit" className={btn + " self-start"}>
            Save decision
          </button>
        </form>
      </section>

      <section className={box}>
        <h2 className="font-semibold">Management agreement</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Flowmono is not integrated yet. “Send” calls a stub and marks it pending; “Mark signed” is the manual interim step.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {landlord.status === "kyc_verified" && landlord.agreement_status === "not_sent" ? (
            <form action={sendAgreement}>
              <input type="hidden" name="landlordId" value={landlord.id} />
              <button type="submit" className={btn}>
                Send agreement for signing (stub)
              </button>
            </form>
          ) : null}
          {landlord.agreement_status === "pending_signature" ? (
            <form action={markAgreementSigned}>
              <input type="hidden" name="landlordId" value={landlord.id} />
              <button type="submit" className={btn}>
                Mark as signed (manual interim)
              </button>
            </form>
          ) : null}
          {landlord.status !== "kyc_verified" && landlord.agreement_status === "not_sent" ? (
            <p className="text-sm text-zinc-500">Available once the landlord is verified.</p>
          ) : null}
          {landlord.agreement_status === "signed" ? <p className="text-sm">Signed.</p> : null}
        </div>
      </section>

      <section className={box}>
        <h2 className="font-semibold">Properties ({props.length})</h2>
        {props.length === 0 ? <p className="mt-2 text-sm text-zinc-500">None.</p> : null}
        <div className="mt-2 flex flex-col gap-4">
          {props.map((p) => {
            const ps = PROPERTY_STATUS[p.status];
            return (
              <div key={p.id} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{p.address}</div>
                    <div className="text-zinc-500">
                      {p.city} · {p.bedrooms} bed · target {formatNgn(p.target_annual_rent)}/yr · maintenance limit{" "}
                      {formatNgn(p.maintenance_threshold_ngn)} · submitted {new Date(p.created_at).toLocaleDateString("en-NG")}
                    </div>
                    {p.rejection_reason ? <div className="mt-1 text-red-700">Reason: {p.rejection_reason}</div> : null}
                  </div>
                  <StatusBadge label={ps.label} tone={ps.tone} />
                </div>
                <form action={setPropertyStatus} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="landlordId" value={landlord.id} />
                  <input type="hidden" name="propertyId" value={p.id} />
                  <label className="flex flex-col gap-1">
                    <span>New status</span>
                    <select name="status" className={input} defaultValue="" required>
                      <option value="" disabled>
                        Choose…
                      </option>
                      <option value="under_inspection">Under inspection</option>
                      <option value="listed">Listed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </label>
                  <label className="flex min-w-64 flex-1 flex-col gap-1">
                    <span>Reason (required if rejected)</span>
                    <input name="reason" className={input} />
                  </label>
                  <button type="submit" className={btn}>
                    Update
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
