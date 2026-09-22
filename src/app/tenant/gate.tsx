import type { ReactElement } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { StatusBadge } from "@/components/status-badge";
import { requireSession, type SessionProfile } from "@/lib/auth";
import { hasRole } from "@/lib/roles";
import { TENANT_KYC_STATUS } from "@/lib/status-labels";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type TenantRow = Database["public"]["Tables"]["tenants"]["Row"];

export type VerifiedTenantGate =
  | { ok: true; session: SessionProfile; tenant: TenantRow }
  | { ok: false; element: ReactElement };

/**
 * Gate for tenant pages that need a VERIFIED tenant (Stage 2, kyc_status =
 * 'verified'). Anyone else gets the same "finish your ID check" surface they
 * already see on /tenant — never an empty list.
 */
export async function requireVerifiedTenant(nextPath: string): Promise<VerifiedTenantGate> {
  const session = await requireSession(nextPath);

  if (!hasRole(session.roleTags, "tenant")) {
    return {
      ok: false,
      element: (
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
      ),
    };
  }

  const supabase = await createClient();
  const { data: tenant } = await supabase.from("tenants").select("*").eq("id", session.id).maybeSingle();

  if (tenant && tenant.kyc_status === "verified") return { ok: true, session, tenant };

  const status = tenant ? TENANT_KYC_STATUS[tenant.kyc_status] : null;
  return {
    ok: false,
    element: (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
          <section className="rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-semibold">Finish your ID check first</h1>
              {status ? <StatusBadge label={status.label} tone={status.tone} /> : null}
            </div>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">
              {status?.description ?? "Your account is not linked to the queue yet. Contact HomeLy and we will fix it."}
            </p>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              Available homes open up once a person on our team has confirmed your ID. Your place in the queue is kept meanwhile.
            </p>
            <Link href="/tenant" className="mt-4 inline-block rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Go to my status
            </Link>
          </section>
        </main>
      </>
    ),
  };
}
