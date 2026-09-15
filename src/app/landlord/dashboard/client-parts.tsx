"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubmitProperty, submitForReview, updateMaintenanceThreshold } from "@/app/landlord/actions";
import { formatNgn } from "@/lib/fees";

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const primary = "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60";

export function SubmitForReviewButton({ enabled, label }: { enabled: boolean; label: string }) {
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
            const res = await submitForReview();
            if (!res.ok) return setError(res.error);
            router.refresh();
          })
        }
      >
        {pending ? "Submitting…" : label}
      </button>
      {!enabled ? <p className="text-xs text-zinc-500">Upload both documents first.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PropertyResubmitForm({
  property,
}: {
  property: {
    id: string;
    address: string;
    city: string;
    bedrooms: number;
    target_annual_rent: number | string;
    maintenance_threshold_ngn: number | string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    address: property.address,
    city: property.city,
    bedrooms: String(property.bedrooms),
    targetAnnualRent: String(property.target_annual_rent),
    maintenanceThresholdNgn: String(property.maintenance_threshold_ngn),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className={primary + " self-start"} onClick={() => setOpen(true)}>
        Correct details and resubmit
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const res = await resubmitProperty({ propertyId: property.id, ...form });
          if (!res.ok) return setError(res.error);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Address</span>
        <textarea className={input} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">City</span>
          <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bedrooms</span>
          <input className={input} type="number" min={0} value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Target rent per year (₦)</span>
          <input className={input} inputMode="numeric" value={form.targetAnnualRent} onChange={(e) => setForm({ ...form, targetAnnualRent: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Maintenance limit (₦)</span>
          <input className={input} inputMode="numeric" value={form.maintenanceThresholdNgn} onChange={(e) => setForm({ ...form, maintenanceThresholdNgn: e.target.value })} />
          <span className="text-xs text-zinc-500">Currently {formatNgn(property.maintenance_threshold_ngn)}.</span>
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <button type="submit" className={primary} disabled={pending}>
          {pending ? "Resubmitting…" : "Resubmit property"}
        </button>
        <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Maintenance limit is not inspection-linked: editable at any status. */
export function MaintenanceThresholdForm({ propertyId, current }: { propertyId: string; current: number | string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(true)}>
        Change maintenance limit
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const res = await updateMaintenanceThreshold({ propertyId, maintenanceThresholdNgn: value });
          if (!res.ok) return setError(res.error);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Maximum per repair without asking you (₦)</span>
        <input className={input} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
        <span className="text-xs text-zinc-500">Currently {formatNgn(current)}. Above this we contact you first.</span>
      </label>
      <button type="submit" className={primary} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button type="button" className="text-sm underline underline-offset-4" onClick={() => setOpen(false)} disabled={pending}>
        Cancel
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}
