"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createLandlordAccount, submitApplication, submitForReview } from "@/app/landlord/actions";
import { DocumentsUploader, type UploadedDocument } from "@/components/documents-uploader";
import { DEFAULT_MAINTENANCE_THRESHOLD_NGN, formatNgn } from "@/lib/fees";
import { MaintenanceDisclosure } from "../maintenance-disclosure";

type Session = { id: string; email: string | null; fullName: string | null; phone: string | null } | null;
type StepId = "account" | "property" | "threshold" | "review" | "documents";

const STEP_LABEL: Record<StepId, string> = {
  account: "Your details",
  property: "The property",
  threshold: "Maintenance limit",
  review: "Review",
  documents: "Documents",
};

const input =
  "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const primary =
  "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60";
const secondary =
  "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

export function ApplicationWizard({ session, existingCountry }: { session: Session; existingCountry: string | null }) {
  const router = useRouter();
  const needsAccount = !session;
  const needsCountry = !session || existingCountry === null;

  // Fixed at mount on purpose: after submitApplication the page re-renders with
  // a landlord row, which would otherwise shrink the list and strand the index.
  const [steps] = useState<StepId[]>(() => [
    ...(needsAccount || needsCountry ? (["account"] as StepId[]) : []),
    "property",
    "threshold",
    "review",
    "documents",
  ]);

  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const [account, setAccount] = useState({
    fullName: session?.fullName ?? "",
    email: session?.email ?? "",
    phone: session?.phone ?? "",
    country: existingCountry ?? "Nigeria",
    password: "",
    confirm: "",
  });
  const [landlordId, setLandlordId] = useState<string | null>(session?.id ?? null);
  const [property, setProperty] = useState({ address: "", city: "Enugu", bedrooms: "2", targetAnnualRent: "" });
  const [threshold, setThreshold] = useState(String(DEFAULT_MAINTENANCE_THRESHOLD_NGN));
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [docs, setDocs] = useState<UploadedDocument[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const thresholdNumber = Number(threshold.replace(/[^0-9]/g, "")) || 0;
  const hasBothDocs = ["id_document", "proof_of_ownership"].every((t) => docs.some((d) => d.document_type === t));

  function go(delta: number) {
    setError(null);
    setStepIndex((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
  }

  function nextFromAccount() {
    setError(null);
    if (needsAccount && landlordId === null) {
      if (account.password !== account.confirm) return setError("Passwords do not match.");
      startTransition(async () => {
        const res = await createLandlordAccount({
          fullName: account.fullName,
          email: account.email,
          phone: account.phone,
          password: account.password,
        });
        if (!res.ok) return setError(res.error);
        if (res.data.needsEmailConfirmation) {
          setNotice(
            "We have sent a confirmation link to your email. Click it, then sign in and come back to this page to add your property.",
          );
          return;
        }
        setLandlordId(res.data.userId);
        go(1);
      });
      return;
    }
    if (!account.country.trim()) return setError("Country of residence is required.");
    go(1);
  }

  function nextFromProperty() {
    if (!property.address.trim()) return setError("Enter the property address.");
    if (!property.city.trim()) return setError("Enter the city.");
    if (!/^\d+$/.test(property.bedrooms)) return setError("Bedrooms must be a whole number.");
    if (!(Number(property.targetAnnualRent.replace(/[^0-9]/g, "")) > 0)) return setError("Enter the rent you want per year.");
    go(1);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitApplication({
        countryOfResidence: account.country,
        address: property.address,
        city: property.city,
        bedrooms: property.bedrooms,
        targetAnnualRent: property.targetAnnualRent,
        maintenanceThresholdNgn: thresholdNumber,
      });
      if (!res.ok) return setError(res.error);
      setPropertyId(res.data.propertyId);
      go(1);
    });
  }

  function finish(withReview: boolean) {
    setError(null);
    startTransition(async () => {
      if (withReview) {
        const res = await submitForReview();
        if (!res.ok) return setError(res.error);
        router.push("/landlord/dashboard?submitted=1");
        return;
      }
      router.push("/landlord/dashboard");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${
              i === stepIndex
                ? "bg-emerald-700 text-white"
                : i < stepIndex
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {i + 1}. {STEP_LABEL[s]}
          </li>
        ))}
      </ol>

      {notice ? (
        <div className="rounded-md bg-sky-50 p-4 text-sm text-sky-900 dark:bg-sky-900/30 dark:text-sky-100">
          <p>{notice}</p>
          <Link href="/login?next=/landlord/apply/form" className="mt-2 inline-block underline underline-offset-4">
            Go to sign in
          </Link>
        </div>
      ) : null}

      {step === "account" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{needsAccount ? "Create your account" : "Where do you live?"}</h2>
          {needsAccount ? (
            <>
              <Field label="Full name">
                <input className={input} value={account.fullName} onChange={(e) => setAccount({ ...account, fullName: e.target.value })} autoComplete="name" />
              </Field>
              <Field label="Email">
                <input className={input} type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} autoComplete="email" />
              </Field>
              <Field label="Phone / WhatsApp" hint="We use this to reach you about inspections and repairs.">
                <input className={input} type="tel" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} autoComplete="tel" placeholder="+234…" />
              </Field>
            </>
          ) : null}
          <Field label="Country of residence" hint="Many of our landlords live abroad. Tell us where you are.">
            <input className={input} value={account.country} onChange={(e) => setAccount({ ...account, country: e.target.value })} autoComplete="country-name" />
          </Field>
          {needsAccount ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" hint="At least 8 characters.">
                <input className={input} type="password" value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} autoComplete="new-password" />
              </Field>
              <Field label="Confirm password">
                <input className={input} type="password" value={account.confirm} onChange={(e) => setAccount({ ...account, confirm: e.target.value })} autoComplete="new-password" />
              </Field>
            </div>
          ) : null}
          {needsAccount ? (
            <p className="text-xs text-zinc-500">
              Already have an account?{" "}
              <Link href="/login?next=/landlord/apply/form" className="underline underline-offset-4">
                Sign in
              </Link>
              .
            </p>
          ) : null}
        </section>
      ) : null}

      {step === "property" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Tell us about the property</h2>
          <Field label="Address" hint="Street, area and any landmark that helps our inspector find it.">
            <textarea className={input} rows={3} value={property.address} onChange={(e) => setProperty({ ...property, address: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City">
              <input className={input} value={property.city} onChange={(e) => setProperty({ ...property, city: e.target.value })} />
            </Field>
            <Field label="Bedrooms">
              <input className={input} type="number" min={0} max={50} inputMode="numeric" value={property.bedrooms} onChange={(e) => setProperty({ ...property, bedrooms: e.target.value })} />
            </Field>
            <Field label="Target rent per year (₦)">
              <input className={input} inputMode="numeric" placeholder="e.g. 1,500,000" value={property.targetAnnualRent} onChange={(e) => setProperty({ ...property, targetAnnualRent: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-zinc-500">
            We currently operate in Enugu only. Properties elsewhere will be reviewed but may not be listed yet.
          </p>
        </section>
      ) : null}

      {step === "threshold" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Your maintenance limit</h2>
          <Field
            label="Maximum we may spend per repair without asking you (₦)"
            hint={`Default ${formatNgn(DEFAULT_MAINTENANCE_THRESHOLD_NGN)}. You can change this later.`}
          >
            <input className={input} inputMode="numeric" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <MaintenanceDisclosure thresholdNgn={thresholdNumber} compact />
        </section>
      ) : null}

      {step === "review" ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Check and submit</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-zinc-500">Name</dt>
            <dd>{account.fullName || session?.fullName || "—"}</dd>
            <dt className="text-zinc-500">Email</dt>
            <dd>{account.email || session?.email || "—"}</dd>
            <dt className="text-zinc-500">Phone</dt>
            <dd>{account.phone || session?.phone || "—"}</dd>
            <dt className="text-zinc-500">Country of residence</dt>
            <dd>{account.country}</dd>
            <dt className="text-zinc-500">Property</dt>
            <dd>
              {property.address}, {property.city} · {property.bedrooms} bedroom(s)
            </dd>
            <dt className="text-zinc-500">Target rent</dt>
            <dd>{formatNgn(Number(property.targetAnnualRent.replace(/[^0-9]/g, "")))} per year</dd>
            <dt className="text-zinc-500">Maintenance limit</dt>
            <dd>{formatNgn(thresholdNumber)} per repair without asking you</dd>
          </dl>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            By submitting you confirm you own this property and agree to the fee sheet you read on the previous page.
          </p>
        </section>
      ) : null}

      {step === "documents" && landlordId ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Upload your documents</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A person on our team checks these by hand. Nothing is verified automatically, and the files are only
            visible to you and HomeLy staff.
          </p>
          <DocumentsUploader
            landlordId={landlordId}
            propertyId={propertyId}
            documents={docs}
            onUploaded={(d) => setDocs((prev) => [...prev, d])}
          />
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {stepIndex > 0 && step !== "documents" ? (
          <button type="button" className={secondary} onClick={() => go(-1)} disabled={pending}>
            Back
          </button>
        ) : null}
        {step === "account" ? (
          <button type="button" className={primary} onClick={nextFromAccount} disabled={pending || Boolean(notice)}>
            {pending ? "Please wait…" : needsAccount && landlordId === null ? "Create account and continue" : "Continue"}
          </button>
        ) : null}
        {step === "property" ? (
          <button type="button" className={primary} onClick={nextFromProperty} disabled={pending}>
            Continue
          </button>
        ) : null}
        {step === "threshold" ? (
          <button type="button" className={primary} onClick={() => go(1)} disabled={pending}>
            Continue
          </button>
        ) : null}
        {step === "review" ? (
          <button type="button" className={primary} onClick={submit} disabled={pending}>
            {pending ? "Submitting…" : "Submit application"}
          </button>
        ) : null}
        {step === "documents" ? (
          <>
            <button type="button" className={primary} onClick={() => finish(true)} disabled={pending || !hasBothDocs}>
              {pending ? "Please wait…" : "Submit for review"}
            </button>
            <button type="button" className={secondary} onClick={() => finish(false)} disabled={pending}>
              Upload later
            </button>
            {!hasBothDocs ? (
              <span className="text-xs text-zinc-500">Both documents are needed before we can review.</span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}
