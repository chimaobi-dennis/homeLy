# HomeLy — Full Product & Build Document

Compiled for continuing this project on a different AI platform. Everything below reflects decisions actually made in the source conversation — nothing here is invented to fill gaps. Where something was flagged as unresolved, it's marked as such rather than given a false answer.

---

## 1. What HomeLy is

HomeLy is a tech-enabled property management company for the Nigerian rental market — **not a listing marketplace**. Landlords sign an agreement handing full apartment management to HomeLy: listing, tenant vetting, rent collection, remittance to landlord minus commission, inspections, and maintenance coordination.

- Working title: HomeLy
- Market: Nigerian residential rental market
- Launch city: **Enugu** (not Lagos or Abuja) — lower cost, Igbo diaspora landlord concentration
- Primary landlord target: **diaspora Nigerians** (UK, US, Canada) who cannot manage property themselves and currently rely on informal, often untrustworthy local managers. Their core anxiety is trust in an absentee arrangement — this shapes onboarding UX (trust signals before data collection) and homepage messaging.
- Primary tenant pain points being solved: opaque/exploitative rental market — arbitrary rent hikes, upfront 1–2 year rent demands, exploitative agent fees, discrimination in screening.

## 2. Landlord-side services

- Full apartment listing and tenant vetting
- Rent collection and remittance to landlord
- Move-in and move-out inspections (condition documentation protecting the landlord)
- Maintenance coordination handled **autonomously by HomeLy** — landlord does not approve individual jobs; reports are for records only, not approval-seeking (this must be disclosed plainly during onboarding, not discovered later)
- Maintenance threshold: HomeLy manages freely up to ~₦150,000 per ticket (configurable per landlord at onboarding); above that, 24-hour notice (not approval-seeking) before proceeding; structural/major work gets 48-hour notice
- Maintenance costs debited directly from the landlord's HomeLy wallet — no separate invoicing

## 3. Tenant-side features (planned, full scope)

- Full apartment search with a queue system (see §4)
- Transparent, fixed fees — no hidden agency charges
- Maintenance ticketing with fast resolution
- Portable rental history across apartments
- Easy apartment switching
- Bill payment integration (electricity, water, gas) — requires CBN licensing or a licensed partner, not independently buildable
- Monthly savings feature toward next rent (flexible and fixed options) — same licensing constraint

**Market constraint:** Nigerian rentals are paid annually (or minimum 6 months) — monthly tenant billing is not viable in this market.

## 4. Queue system (tenant prioritization)

- Tenants join the queue free for the first year: **1 day on platform = 1 queue point**
- After year one, tenants pay a maintenance/"dormancy" fee to keep points active — framed as a fee for staying dormant, not a fee to remain a normal active renter
- Highest queue points wins when multiple tenants apply for the same apartment
- Boost: tenants can pay a one-time fee per application to jump the queue on a specific apartment — standalone transaction, available to any qualified tenant regardless of subscription status
- Queue revenue is scale-stage, not early-stage (negligible under ~1,000 active tenant users)
- **Design concern raised and accepted:** pure time+payment-based points risk a pay-to-win perception. Preferred direction is hybrid: points also reward good tenant behavior (completed rentals, clean move-outs, positive ratings), and points don't expire if the tenant rented through HomeLy within 2 years. This behavior-based component cannot exist until real rentals have happened — it's a Phase 2+ feature, not buildable at MVP.

## 5. Revenue model

- Nigerian rent is annual — management fee deducted at point of annual rent collection, not billed monthly
- New tenant placement: **5% agency + 5% legal = 10% of annual rent**, one-time (e.g. ₦360,000 on ₦3.6M rent)
- Annual management fee: **8–10% of annual rent**, deducted from collected rent before remitting to landlord
- Maintenance coordination cut: **flat fee per ticket (₦3,000–5,000)**, deliberately not a % of job value, to avoid an incentive where HomeLy profits from more problems
- Optional premium landlord package: ₦50,000–150,000/year for priority inspections, quarterly condition reports, enhanced visibility
- Fintech revenue (savings partnership, ~₦27,000/year per active tenant saver): secondary, mainly a retention/lock-in tool early, grows with volume
- Fintech revenue (bill payments via licensed aggregator): thin/negligible early, mainly a stickiness feature
- Flutterwave (rent collection): a **cost center** for HomeLy (merchant fees), not a revenue stream
- Contractor network: free to join at launch; platform fee per job once volume exists at scale
- Fintech is secondary revenue in first 18–24 months, growing in significance with volume and eventual own licensing

## 6. Payment and wallet model

- Flow: tenant funds HomeLy wallet → pays rent from wallet → HomeLy deducts management fee → credits net to landlord's HomeLy wallet → landlord initiates withdrawal on their own timing, in their chosen currency
- Landlord HomeLy wallet: accumulates rent income across all their properties, debited for maintenance costs, fully landlord-controlled withdrawal timing
- Landlord withdrawal options: NGN bank account, USD account, EUR account, or leave in wallet
- Rationale: this model lets diaspora landlords control the timing of FX conversion, rather than receiving remittances at random times
- Tenant wallet is less critical than the landlord wallet — a direct bank transfer to HomeLy's collection account may suffice for annual rent in Phase 1/2; a real tenant wallet matters once flexible savings/payment plans (Phase 3) exist

## 7. Fintech and integration partners

| Purpose | Partner | Notes |
|---|---|---|
| Wallet infrastructure (BaaS) | **Anchor.co** | Provides virtual accounts/wallet balances under Anchor's CBN license. HomeLy never legally holds client funds directly — Anchor holds on behalf of landlords, HomeLy is the interface layer. |
| Domestic rent collection | **Monnify** (Moniepoint) | Lowest fees (0.5%, capped at ₦1,000); reserved virtual accounts per apartment for auto-reconciliation. |
| International withdrawals | **Flutterwave** | Direct GBP/USD/EUR payouts; FX rate shown to landlord at withdrawal time, landlord confirms, then executes; no HomeLy margin on FX. |
| Savings feature | **Cowrywise** | Phase 3. Has an existing "rent" savings plan category, ~13.85% p.a. on goal-based plans, SEC-regulated. (OPay savings was considered and dropped — less partnership-friendly API, savings is a secondary product there.) |
| Identity/KYC | **Dojah** or Youverify | Nigerian BVN/NIN check APIs. Dojah noted for cleaner docs. **Not integrated yet** — needs a live business account. |
| Agreement e-signing | **Flowmono** | Nigerian e-signature platform, built around Evidence Act 2011 (Section 84/93 admissibility) and the Cybercrimes Act 2015, NDPR-compliant, priced in naira, exposes an API for triggering signature requests. **Not integrated yet** — real API contract (auth, webhook shape) not pulled from live docs; currently a stub. |
| SMS | **Termii** | Nigerian provider, cheaper than Infobip. Not yet live. |
| Email | **Resend** | Not yet sending real email — currently stubbed (logs instead of sending). |
| WhatsApp | Meta Business API or Twilio | Non-optional — primary communication channel for a Nigerian product. Not yet integrated. |

**Important, unresolved dependency:** Anchor/Monnify/Flutterwave business accounts (KYB) typically require **CAC incorporation** first. CAC incorporation status is **unconfirmed** as of the source conversation — this gates how soon real payment/KYC integration is possible, and needs to be resolved outside of code.

## 8. Tech stack (decided)

- **Frontend + backend:** Next.js (App Router, TypeScript), single codebase, Vercel deployment
- **Database/Auth/Storage/Realtime:** Supabase (Postgres, Row-Level Security, Auth, Storage for documents/photos)
- **Analytics:** PostHog (not yet integrated)
- Local development uses the Supabase CLI (`supabase init` / `supabase start`), with proper migration files (not ad-hoc SQL), so they can later push to a real cloud project via `supabase db push`. **No production/cloud Supabase project exists yet** — everything so far is local dev only.

## 9. Compliance and legal

- **ESVARBON registration is NOT required** — it's only for principals with a formal BSc/HND in Estate Management who've passed the ESVARBON qualifying exam; HomeLy's principals don't meet this, so it's neither required nor available.
- **LASRERA is Lagos-only** — not applicable to an Enugu launch.
- **Minimum legal requirement:** CAC incorporation + FIRS Tax Identification Number + PAYE compliance once hiring. (Status of CAC incorporation itself is unconfirmed — see §7.)
- **Enugu 2025 Tenancy Bill** (first reading Feb 2025, status unconfirmed as of Sep 2026): if passed, would require an annual permit from the Enugu State Housing Development Corporation, caps agency fees at 10% and legal fees at 10%, abolishes the caution fee — aligns favorably with HomeLy's existing model. A law firm should track its status before the first agreement is signed.
- **Landlord agreement e-signature legitimacy** (typed-name-and-timestamp vs. a compliant provider) was an open legal question — resolved in favor of using Flowmono, but the actual legal sufficiency of the implementation should still be confirmed with counsel, not assumed from the platform's marketing claims alone.

## 10. Operations

- Fully remote from day one — no physical office; founder (IGS) operates from Sweden. Registered legal address via law firm handles compliance.
- **Enugu operations anchor confirmed:** a trusted contact in Enugu who runs physical operations — a civil engineer with 10+ years' experience, based in Enugu, with existing landlord/property-manager connections.
- **BD (business developer) model:** university students (UNN or ESUT), ₦50,000/month retainer + commission per apartment successfully rented. Commission triggers at **first tenant placement**, not at agreement signing.
- **BD commission structure:** ₦20,000 per apartment (not per landlord) at first tenant placement — a landlord with multiple properties generates multiple commissions.
- Student BDs can double as gig inspectors for additional income — this is why, in the product build, BD and inspector are modeled as **one staff account holding both role tags**, not two separate account types or invites.
- **Phase 1 is supply-only** — apartments onboarded, no tenants transacting yet, zero revenue by design.
- The tenant waitlist is built in parallel during Phase 1 so landlords see demand exists at sign-up time — this waitlist mechanic is intended to remain the **launch-gating mechanism** even as the fuller product gets built out (see §16).

## 11. Financial model (Enugu, remote-first)

- Enugu target segment average annual rent (GRA, Independence Layout, New Haven): ₦1.2M–₦1.8M/year (avg ₦1.5M)
- **Phase 1 monthly burn:** ~₦220,000 (BDs ₦100k, legal ₦20k, tech ₦60k, tools ₦25k, misc ₦15k)
- Phase 1 total 6-month cost: ~₦1.32M — potentially self-funded from the founder's Outlier income
- **Phase 2 monthly burn:** ~₦895,000 (BDs ₦150k, BD commission ₦60k, customer support ₦160k, legal ₦80k, tech ₦100k, marketing ₦150k, gig inspectors ₦100k, vetting ₦30k, tools ₦40k, misc ₦25k)
- **Phase 2 breakeven:** ~60 apartments at ₦1.5M average Enugu rent, 10% management fee, 20% turnover
- Working capital buffer: 3 months of burn ≈ ₦2.7M at Phase 2 — notably lower than a Lagos-based model
- Cash flow is lumpy: Nigerian leases cluster seasonally; some months are near-zero even when profitable on average

## 12. MVP PRD — the original three flows

The MVP was scoped as three flows before the later decision to build the full system (§16):

1. **Landlord onboarding** — the actual revenue wedge. Trust-first landing (Enugu ops contact, inspection process, fee sheet, maintenance-autonomy disclosure) → application form → maintenance threshold configuration (default ₦150,000, editable) → document upload (ID + proof of ownership) → status tracking → agreement signing.
2. **Staff invite** — internal, invite-only tooling. Admin issues a token invite with role tags (`bd`, `inspector`, or both on one account); no self-serve staff signup.
3. **Tenant waitlist (Stage 1)** — deliberately minimal: name, WhatsApp number, email only, no KYC, no account. Framed explicitly as a "priority list," never as "search," "browse," "apply for," or "queue for an apartment," because there's no live inventory yet. Points accrue from `joined_at` (1 day = 1 point). A later "Stage 2" conversion (tenant accepts an invite, creates an account, submits KYC) was designed to happen at actual launch, deferring tenant KYC volume until it's actually needed rather than gating waitlist signup with it.

**Key decisions locked into this PRD:**
- BD and inspector are the same login with multiple role tags, not separate invites.
- Tenant KYC deferred entirely until queue conversion at launch — waitlist signup needs no identity verification.
- Flowmono selected for landlord agreement e-signing.
- Landlord KYC is **manual admin review** for v1 (no live Dojah integration) — sustainable given expected low landlord volume; the status field/flow is designed so swapping in automated KYC later is a backend change, not a redesign.
- An explicit, still-open risk: unverified Stage 1 waitlist signups are gameable (duplicate/fake entries banking queue points) since there's no verification gate — a lightweight email-confirm + WhatsApp-OTP option (short of full KYC) was proposed but never decided on.
- Another open risk: tenant KYC-at-conversion assumes automated KYC (Dojah) will be live by actual launch, since real payment rails need to be live around the same time anyway — this is an assumption, not a guarantee, and should be revisited as launch timing firms up.

## 13. Build history — what's actually implemented

Built iteratively via Claude Code, in scoped sessions, each ending in a committed, verified state. As of the source conversation:

**Step 1 — Foundation.** Next.js + local Supabase (CLI-managed, migrations not ad-hoc SQL). Schema: `profiles` (role_tags array), `landlords`, `properties`, `staff_invites`, `waitlist_entries`. RLS enabled and tested on every table. Auth set up for admin/staff/landlord only — tenants deliberately have no auth account at this stage. Route stubs for `/landlord/apply`, `/staff/invite/[token]`, `/waitlist`. A `CLAUDE.md` convention file was created recording stack, role model, and a standing rule to always summarize every session's work in full.

**Step 2 — Landlord onboarding, end to end.** Trust-first landing page, multi-step application wizard, maintenance-threshold configuration, private-bucket document upload (ID + proof of ownership, signed URLs only), landlord-facing status dashboard, minimal admin review screen (verify/reject with reason, progress property status), agreement flow with a `agreement_status` field and a Flowmono stub (`sendAgreementForSigning()` — clearly marked TODO, no invented API calls), stubbed notifications (`notifyLandlord()` — logs instead of sending unless a real Resend key is present, and even then still doesn't send, since real sending was out of scope).

**Step 3 — Two fixes + tenant waitlist Stage 1.**
- Fix: proof-of-ownership document upload now requires explicit property selection for multi-property landlords (previously silently defaulted to "the first property").
- Fix: core property fields (address, city, bedrooms, target rent) are locked from landlord edit once status moves past `submitted`, enforced via a database trigger — only `maintenance_threshold_ngn` stays freely editable. Resubmission after rejection is a single privileged server-side action, not a silent multi-step edit.
- Feature: `/waitlist` built for real — name/WhatsApp/email only, unique index on `lower(email)` for basic duplicate hygiene (not a defense against the deliberate multi-email abuse case, which stayed an open decision), a confirmation page with no banned phrases, and a read-only `/admin/waitlist` view.

**Step 4 — Staff invite, end to end.** Admin creates invites (email + role tags) at `/admin/staff`, rejects up front if the email already has an account, shows the invite URL directly on the page (not just in logs) since real email sending isn't live. Revoke/deactivate for existing staff — deactivate uses a real Supabase Auth ban, not an app-level flag, preserving history. Public accept flow at `/staff/invite/[token]` with five distinct states (valid, already used, not found, revoked, expired-with-timestamp). **A real bug was found and fixed here:** the Admin API writes the new user row before writing `app_metadata`, so a database trigger meant to sync role tags never fired for the first invited staffer, silently tagging them as `{landlord}` instead of their real role. Fixed with both a corrected sync trigger and an app-level verification/correction step on accept.

**Homepage redesign.** Rebuilt as a persona-driven split hero — "I'm a landlord" / "I'm a tenant" as the primary interaction (not a secondary link below generic copy), client-side toggle (no reload), remembered via localStorage but always re-shown split on load. Concrete design tokens were specified to avoid generic AI-template patterns: Ink `#14171A`, Paper `#F6F5F1` (deliberately not a warm cream), Verify Green `#1C6B52`, Signature Gold `#B8862E`, Clay `#9C4A32`; Fraunces for display type, existing sans for body. Landlord-selected view shows the trust content (ops lead bio, fee sheet, inspection process, maintenance-autonomy disclosure); tenant-selected view keeps the same "no live listings yet, priority list, notified when the queue opens" honesty rule from the waitlist flow. No invented numbers — anything not already established in the codebase was left as a visible TODO (e.g., no launch date exists anywhere, so the page says so plainly rather than inventing one).

**Step 5 — proposed, not yet reported back.** Tenant accounts + queue conversion (the "Stage 2" flow): a `tenants` table, a `queue_conversion_invites` table modeled on staff_invites, admin-triggered conversion invites (individually or in bulk when the queue opens), a public accept flow with account creation + ID upload, and manual admin KYC review — same stubbed-KYC pattern as landlords, with a `verifyTenantKyc()` stub clearly marked for where Dojah plugs in later.

## 14. Homepage design system (for reference)

- Color tokens: Ink `#14171A`, Paper `#F6F5F1`, Verify Green `#1C6B52`, Signature Gold `#B8862E`, Clay `#9C4A32`
- Display type: Fraunces (optical size + softness axes, chosen deliberately over the more generic Playfair/Cormorant default)
- Body/UI type: the app's existing sans (Geist) — noted inconsistency: the rest of the app's forms were still rendering in a fallback Arial rule in `globals.css` at the time of the redesign; a one-line fix (`body { font-family: var(--font-sans) }`) was identified but deliberately left unapplied pending approval, since it affects every page.
- Explicitly avoided: all-caps eyebrow labels, numbered step badges, arrow-suffixed buttons, identical rounded cards with matching shadows everywhere, gradient-wash decoration, the cream+serif+terracotta combination common to AI-generated pages.
- The homepage deliberately ignores OS dark mode — Ink/Paper are a fixed look on that page only, scoped via CSS so it doesn't affect the rest of the app (which still follows system dark mode as before).

## 15. Current scope decision — full system build

**Decision (final, as stated):** rather than launching with just the Phase-1 MVP subset, the founder is using a period of time off from their day job to build the **fully functional system** — tenant, landlord, and internal/admin sides — before returning to limited-availability work, at which point remaining time will go to marketing and launch rather than further feature development.

**Explicitly unchanged despite the fuller build:** the launch strategy still uses the tenant waitlist/queue as the gating mechanism — full functionality being built now doesn't mean tenant search opens to the public immediately at launch. The waitlist → Stage 2 conversion → active queue member sequence (§12, §13) still governs how real usage begins.

**Risks flagged against this decision, not as objections but as things to keep in view:**
- Building tenant search/apply/lease/payment flows now, with zero real landlords or tenants to react to them, means some of what gets built will likely need reshaping once real usage starts — this build should be treated as a strong first draft, not a frozen spec.
- Payment and identity integrations (Anchor, Monnify, Flutterwave, Dojah) are gated by external business processes (KYB, likely requiring CAC incorporation) that aren't resolvable by writing code — "fully functional" for those pieces will mean fully built and wired to a stub interface until those accounts exist, mirroring the existing Flowmono stub pattern.

## 16. Roadmap — proposed build order for the full system

Building on Steps 1–5 already complete/in progress:

1. **Tenant accounts + queue conversion** (Step 5 — prompted, not yet confirmed complete)
2. **Property listings** — photos, description, amenities on top of the existing property record; a public browse page
3. **Apply to a property** — queue-priority logic (highest points wins), tied to listings + tenant accounts
4. **Lease generation + signing** — tenant-side Flowmono integration, move-in inspection record
5. **Payment rails** — wallet model, Monnify/Flutterwave/Anchor, stubbed pending real business accounts
6. **Maintenance ticketing** — tenant-submitted, threshold-based triage and approval workflow
7. **Landlord dashboard** — earnings/payout tracking, lease status per property, maintenance visibility
8. **Staff commission tracking** — ₦20,000-per-apartment-placement logic
9. **Admin analytics/reporting** — operational and investor-facing reporting (landlord count, property count, tenant conversions, revenue)

Each step was built as its own Claude Code session, scoped narrowly, ending in a full plain-text summary of files/migrations/policies changed and any assumptions made or guessed on, with a standing rule (recorded in the repo's `CLAUDE.md`) to always produce that summary even without being asked.

## 17. Open questions and unresolved risks (consolidated)

- CAC incorporation status — unconfirmed, gates real payment/KYC integration timing
- Enugu 2025 Tenancy Bill status — unconfirmed as of the source conversation, affects fee caps and permit requirements
- Landlord agreement e-signature: Flowmono selected, but legal sufficiency of the specific implementation not yet confirmed with counsel
- Waitlist abuse (duplicate/fake signups banking queue points) — a lightweight email/WhatsApp verification option was proposed, never decided on
- Tenant KYC-at-conversion assumes Dojah will be live by launch — an assumption, not a guarantee
- Whether BD and inspector should ever need separate permission granularity beyond the combined role-tag model — not raised as a problem yet, but worth revisiting if the two roles' access needs diverge
- No production Supabase project exists yet — everything built so far is local-only; going live requires provisioning a real project and setting real environment keys
