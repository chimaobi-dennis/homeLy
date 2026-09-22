@AGENTS.md

# HomeLy — project guide for Claude

HomeLy is a property-management platform for the Nigerian rental market.
Launch city: **Enugu**. Owner / admin: Chimaobi Dennis (IGSOFT Web).

## Product context — read `docs/PRODUCT.md` first

The owner's full product & build document lives at `docs/PRODUCT.md` (copied
verbatim on 2026-09-22 from their `homely-full-product-document.md`). It is the
source of truth for WHAT HomeLy is and WHY:

- A tech-enabled property **management** company for Nigeria, not a listing
  marketplace. Launch city Enugu. Primary landlord target: diaspora Nigerians
  whose core anxiety is trust in an absentee arrangement → trust signals before
  data collection, plain disclosure of maintenance autonomy.
- Rent is annual. Fees: 5% agency + 5% legal one-time at placement; 8–10% annual
  management deducted at collection; flat ₦3,000–5,000 per maintenance ticket
  (never a % of job value); ~₦150,000 default maintenance threshold per landlord.
- Tenants are prioritised by a queue: 1 day on the priority list = 1 point;
  highest points wins an apartment; paid boost per application; behaviour-based
  points are Phase 2+. The waitlist → Stage 2 conversion → active queue sequence
  is the launch-gating mechanism even though the full system is being built now.
- Money: tenant → HomeLy wallet → fee deducted → landlord wallet → landlord
  withdraws (NGN/USD/EUR) on their own timing. Partners: Anchor (wallets),
  Monnify (domestic collection), Flutterwave (international payouts),
  Cowrywise (savings, Phase 3), Dojah/Youverify (KYC), Flowmono (e-signing),
  Termii (SMS), Resend (email), WhatsApp Business (primary channel). ALL are
  stubs until CAC incorporation + KYB exist (unconfirmed) — never invent API
  calls; keep the `TODO(vendor)` stub pattern.
- Ops: remote-first; an Enugu civil engineer anchors physical operations;
  student BDs (₦50k retainer + ₦20k per apartment at first tenant placement)
  who double as inspectors → one staff account with both role tags.
- Build order (§16 there): tenant accounts ✔ → listings ✔ → apply to a property
  → lease + signing → payment rails (stubbed) → maintenance ticketing → landlord
  dashboard → staff commission tracking → admin analytics.

Where that document and this file disagree about the **state of the code**,
this file wins: the document predates Steps 5–7, the cloud Supabase project and
Vercel deployment, and the current tenant-first homepage (its §13/§14/§17 and
"no production project exists" are stale).

## Decision log (append here, newest last; every session adds its decisions)

- 2026-09-22 — Migration hand-off: Claude never pushes to the cloud DB; the
  owner runs each migration's SQL + the schema_migrations insert (DEPLOYMENT §7c).
- 2026-09-22 — Homepage is tenant-first: search → why → about → apartments →
  landlord band → contact. "Search" wording allowed on the homepage; the
  banned-phrase rule stays only for the /waitlist flow.
- 2026-09-22 — Public listings expose only the `public_listings` view columns
  (never address, landlord, status, threshold); photos are signed URLs.
- 2026-09-22 — Hero search: free-text bar + area/bedrooms/max-rent filters;
  results in an on-page dropdown with photos; quick-view dialog; no navigation.
- 2026-09-22 — Theme: bold blue and white. ONE blue = the footer navy #0B1F4B
  everywhere (nav, buttons, chips, band, footer, focus); white surfaces; ice
  wash. Cobalt #1849D6 tried and dropped.
- 2026-09-22 — Hero: natural-colour aerial photo under a WHITE veil + white
  glass panel. Navy duotone tried and dropped. (Superseded the same day, below.)
- 2026-09-22 — LAYOUT REFERENCE (owner: "found the perfect template, use it
  verbatim"): PixelStrap **Sheltos** demo. Homepage hero = `theme/slider-filter-search`
  (full-viewport photo + 50% dark overlay, text slider with round arrows,
  "What are you looking for?" glass tiles, dark glass filter box on the right);
  second section = the "Provided Services" block from `theme/corporate`
  (squiggle title, three white shadowed cards with line icon + h3 + Roboto
  paragraph + flat button); results = `listing/grid-view/2-grid/left-sidebar`
  (500px banner + breadcrumb, white sidebar: Advance search / Filter / Areas /
  Contact info / Recently added, results header with "Showing 1-6 of N", sort,
  2/3/list view toggles, `.property-box`-style cards, « Previous 1 2 3 Next »).
  We rebuild the LAYOUT in our own code with our own copy/photos — the
  template's code, images and text are the vendor's (paid ThemeForest theme)
  and are never copied. If the owner buys a licence, its assets may be used.
  Typography follows the reference: Montserrat (headings/UI) + Roboto
  (paragraphs). Colour still follows the one-navy decision. Shadowed cards are
  now allowed (the earlier "no identical shadowed cards" rule belonged to the
  previous editorial brief).
- 2026-09-22 — Search results live on /search (the reference listing page), so
  the on-page dropdown + `/api/listings` route from earlier today were removed.
  Filters everywhere: keyword, area, furnishing, bed, bath, rent range, size
  range (dual native range inputs); sort + view + page params on /search.
- 2026-09-22 — Migration 0018 appends `description` to `public_listings` (staff-
  written public copy; cards show it). Applied on cloud by the owner the same day.
- 2026-09-22 — Opening an apartment goes to its own page `/homes/[id]`, laid out
  on Sheltos `property/thumbnail-image` (title card with facts + share/print,
  gallery with thumbnail strip, Property details list, Fees, Features, Related
  homes; sidebar: Contact info, Request a viewing (= contact form pre-filled),
  Recently added). The quick-view dialog was removed. No address on the page;
  the copy says the exact address is shared with verified tenants.

## Tech stack

- **Next.js** (App Router, TypeScript, `src/` layout, Tailwind v4). Next 16 —
  the `proxy.ts` convention replaces `middleware.ts`; `params` / `searchParams`
  are Promises. Read `node_modules/next/dist/docs/` when unsure.
- **Supabase**: Postgres + Auth (email + password) + Row-Level Security.
  - `@supabase/supabase-js` + `@supabase/ssr` (cookie-based sessions).
  - Client helpers in `src/lib/supabase/`: `client.ts` (browser),
    `server.ts` (Server Components / Actions / Route Handlers),
    `admin.ts` (service role — bypasses RLS, server-only, use sparingly).
  - `src/proxy.ts` refreshes the auth session on every request.
- **Supabase CLI.** Local dev stack plus a cloud project (`supabase link` /
  `supabase db push`, see `DEPLOYMENT.md`). Schema lives in
  `supabase/migrations/*.sql` — never run ad-hoc SQL by hand; write a migration.
  Migrations must stay clean enough for `supabase db push` to a cloud project.
  `supabase/seed.sql` is LOCAL ONLY (dev accounts) and never runs on push.

### Commands

```bash
npm run db:start     # supabase start (needs Docker Desktop running)
npm run db:reset     # re-apply all migrations + seed.sql from scratch
npm run db:types     # regenerate src/lib/supabase/database.types.ts — run after every migration
npm run db:test      # RLS regression suite (supabase/tests/rls.sql), rolls back; needs docker on PATH
npm run db:status    # prints local URL + keys for .env.local
npm run dev          # Next.js dev server on http://localhost:3000
npm run typecheck && npm run lint && npm run build

# cloud project (see DEPLOYMENT.md)
npm run db:link           # supabase link --project-ref <ref>
npm run db:push           # apply migrations to the linked cloud project (never runs seed.sql)
npm run db:types:linked    # regenerate types from the cloud schema
```

New migration: `supabase migration new <name>` (or hand-create
`supabase/migrations/YYYYMMDDHHMMSS_<name>.sql`), then `npm run db:reset && npm run db:types`.

## Role model

Three kinds of **real auth accounts** (Supabase Auth, email + password):

| Kind     | `profiles.role_tags`                 | Created by                                   |
|----------|--------------------------------------|----------------------------------------------|
| admin    | `{admin}`                            | server-side only (Admin API / seed)          |
| staff    | `{bd}`, `{inspector}` or `{bd,inspector}` — ONE account can hold both | admin invite (`staff_invites`) → server-side |
| landlord | `{landlord}`                         | self-service sign-up (`/landlord/apply`)     |
| tenant   | `{tenant}` (may combine with landlord) | Stage 2 only: accepting a queue-conversion invite (`/waitlist/convert/[token]`) |

- `bd` and `inspector` are **tags on one staff account**, not separate account types.
- **Stage 1 tenants have NO auth account.** The waitlist (`/waitlist`) is anonymous —
  public INSERT into `waitlist_entries`, no login, no KYC. Unchanged in Step 5.
- **Stage 2 (Step 5):** an admin invites a waitlist entry to convert; accepting the
  invite creates a real `tenant` account (Admin API, `app_metadata.role_tags`)
  plus a `tenants` row. Manual ID review follows. Nothing beyond "active queue
  member" exists yet — no listings, no applying to a unit.
- `role_tags` are set from `auth.users.raw_app_meta_data.role_tags` by the
  `on_auth_user_created` trigger (app_metadata is only settable server-side).
  A sign-up with no app_metadata tags becomes `{landlord}`. Only an admin or
  the service role can change `role_tags` afterwards (trigger-enforced).
  **Gotcha (Step 4):** `auth.admin.createUser()` inserts the row first and writes
  app_metadata in a second UPDATE, so a second trigger
  (`on_auth_user_app_metadata_updated`, migration 0014) mirrors later
  `app_metadata.role_tags` changes into `profiles.role_tags`.
- Postgres helpers used by RLS: `is_admin()`, `is_staff_or_admin()`,
  `has_role(tag)`, `current_role_tags()`, `is_privileged_writer()`.
  TypeScript mirror: `src/lib/roles.ts`.

## Schema (see `supabase/migrations/` for the source of truth)

- `profiles` — id → auth.users, full_name, phone, role_tags[]
- `landlords` — id → profiles, country_of_residence, status
  (applied | kyc_pending | kyc_verified | kyc_rejected), assigned_ops_contact → profiles,
  kyc_rejection_reason, agreement_status (not_sent | pending_signature | signed)
- `properties` — landlord_id → landlords, address, city (default Enugu), bedrooms,
  target_annual_rent, maintenance_threshold_ngn (default 150000), status
  (submitted | under_inspection | listed | rejected), rejection_reason;
  listing content (Step 7): listing_headline, description, bathrooms, size_sqm,
  furnishing (unfurnished | semi_furnished | furnished), amenities text[]
  (fixed list, `properties_amenities_allowed` = `AMENITIES` in `src/lib/listings.ts`),
  available_from, listed_at (trigger-maintained: set on → listed, cleared otherwise)
- `property_photos` — property_id → properties, storage_path (unique, under
  `<property_id>/`), caption, sort_order (explicit ordering), uploaded_by → profiles
- Storage bucket `property-photos` (PRIVATE, 8 MiB, jpeg/png/webp), key layout
  `<property uuid>/<uuid>-<filename>`. Signed URLs only.
- `landlord_documents` — landlord_id → landlords, property_id → properties (nullable),
  document_type (id_document | proof_of_ownership), storage_path (unique, must be under
  `<landlord_id>/`), original_filename, mime_type, size_bytes, uploaded_at
- Storage bucket `landlord-documents` (PRIVATE, 10 MiB, jpeg/png/webp/pdf). Object key
  layout `<landlord uuid>/<document_type>/<uuid>-<filename>`. Signed URLs only, ever.
- `staff_invites` — email, role_tags[] (bd/inspector), invited_by → profiles,
  token (unique, DB-generated), status (pending | accepted | revoked | expired), expires_at
- `waitlist_entries` — name, whatsapp_number, email, joined_at, email_confirmed,
  whatsapp_confirmed, conversion_status (waitlist | invited_to_convert | kyc_pending | active_queue)
- `tenants` — id → profiles, waitlist_entry_id → waitlist_entries (nullable, unique
  when set), kyc_status (not_started | pending | verified | rejected),
  kyc_rejection_reason, converted_at
- `queue_conversion_invites` — waitlist_entry_id → waitlist_entries, invited_by →
  profiles, token (unique, DB-generated), status (pending | accepted | revoked |
  expired), expires_at (7 days, assumption); one pending invite per entry
- `tenant_documents` — tenant_id → tenants, document_type (`id_document` only),
  storage_path (unique, under `<tenant_id>/`), original_filename, mime_type,
  size_bytes, uploaded_at
- Storage bucket `tenant-documents` (PRIVATE, 10 MiB, jpeg/png/webp/pdf), key
  layout `<tenant uuid>/id_document/<uuid>-<filename>`. Separate from
  `landlord-documents` on purpose.

## RLS rules (every table has RLS enabled; policies live next to each table's migration)

- `profiles`: own row select/update; admin selects all. `role_tags` change → admin/service only.
- `landlords`: landlord selects/updates own row, may insert own row (status forced
  to `applied`); staff+admin select all; admin inserts/updates any.
  `status`, `assigned_ops_contact`, `kyc_rejection_reason`, `agreement_status`
  → admin/service role only (trigger).
- `public_listings` / `public_listing_photos` (views): SELECT for anon and
  authenticated; listed rows, safe columns only (see the homepage section).
- `contact_messages`: staff+admin select; writes only through
  `submit_contact_message()` (execute granted to anon/authenticated).
- `properties`: same shape keyed on `landlord_id`; `status`, `landlord_id`,
  `rejection_reason`, `listed_at` → admin/service only. `area` is listing
  content (staff). The guard trigger is
  ROLE-SCOPED for non-privileged writers (Step 7 rewrite of the 0010 rule):
  landlords may change `maintenance_threshold_ngn` any time and the four core
  fields only while `submitted`, and never listing content; staff (bd/inspector,
  new "staff updates any row" policy) may change ONLY listing content, at any
  status. Verified tenants select `listed` rows only. A separate trigger refuses
  status → `listed` without description + rent + ≥1 photo, for every writer.
- `property_photos`: staff+admin select/insert/update/delete; landlord selects own
  property's rows; verified tenants select rows of `listed` properties.
  `storage.objects` (bucket `property-photos`): staff+admin upload/delete/read;
  landlord-owner reads own property folders; verified tenants read listed folders.
- `profiles`: staff may additionally select landlord-tagged profiles (names for
  the properties list) — not admin/staff/tenant profiles.
- `landlord_documents`: landlord selects/inserts own rows; staff+admin select all;
  no client update/delete. Trigger: `property_id` must belong to the same landlord.
- `storage.objects` (bucket `landlord-documents`): landlord inserts into and reads
  own folder; staff+admin read all; no update/delete; bucket is private.
- `staff_invites`: admin-only select/insert/update. Nobody else can read it —
  the public invite page must resolve tokens server-side.
- `waitlist_entries`: anon + authenticated may INSERT only `name, whatsapp_number,
  email` (column-level grant); staff+admin select; no client UPDATE/DELETE.
  Unique index on `lower(email)` (Step 3); deliberately NO uniqueness on phone.
- `tenants`: tenant selects own row; staff+admin select all; admin inserts/updates
  any; NO tenant write policy at all. `kyc_status`, `kyc_rejection_reason`,
  `waitlist_entry_id`, `converted_at` → admin/service only (guard trigger).
- `queue_conversion_invites`: admin-only select/insert/update, like `staff_invites`.
- `tenant_documents`: tenant selects/inserts own rows; staff+admin select all; no
  client update/delete. `storage.objects` (bucket `tenant-documents`): tenant
  uploads into / reads own folder; staff+admin read all; private bucket.
- "Protected" columns are enforced by BEFORE triggers that call
  `is_privileged_writer()` — so the service role, direct DB connections and
  admin users pass; everyone else gets `42501`.

## Landlord onboarding (Step 2, built 2026-09-15)

Routes:
- `/landlord/apply` — trust-first landing (ops lead placeholder, inspection steps,
  fee sheet from `src/lib/fees.ts`, autonomous-maintenance disclosure). No inputs.
- `/landlord/apply/form` — wizard (`application-wizard.tsx`): account → property →
  maintenance threshold → review → documents. Account step is skipped when signed in.
- `/landlord/dashboard` — landlord's own status view. Never silent: every status has a
  label + plain-language sentence (`src/lib/status-labels.ts`) + next action, rejection
  reasons, and resubmit paths.
- `/login` — email + password for every role; redirects by role (`homePathFor`).
- `/admin/landlords`, `/admin/landlords/[id]` — internal review screens (no polish).
  `src/app/admin/layout.tsx` runs `requireAdminPage()`: signed-out → /login, non-admin → 404.
- `src/proxy.ts` redirects signed-out visitors of `/admin/*` and `/landlord/dashboard`.

Write path rules (keep these):
- Landlord writes (`landlords`, `properties`, `landlord_documents`, storage uploads)
  run AS THE LANDLORD through RLS — `src/app/landlord/actions.ts`.
- Protected columns (status / reasons / agreement_status) are flipped ONLY in server
  actions that first re-read the caller's role_tags from the DB via their own session
  (`assertAdminAction` / `assertLandlordAction` in `src/lib/auth.ts`), then write with
  the service role (`createAdminClient`) scoped to the exact row + expected prior state.
  Client-supplied roles are never trusted. Admin actions: `src/app/admin/landlords/actions.ts`.
- Landlord-initiated status flips: `submitForReview` (applied|kyc_rejected → kyc_pending,
  requires both document types) and `resubmitProperty` (rejected → submitted — ONE
  service-role update carrying the corrected fields, because core fields are
  trigger-locked while rejected; ownership + state verified first as the landlord).
- Proof of ownership is tied to one property: the uploader asks which when the
  landlord has several; `recordDocument` and a DB trigger both check ownership.
- Uploads go browser → Storage directly (session cookie → storage RLS), then
  `recordDocument` verifies the object is readable by the caller before inserting metadata.
- Signed URLs are created with the VIEWER's own session (owner or staff/admin policy),
  10-minute expiry. Nothing is ever served from a public bucket.
- `notifyByEmail()` (`src/lib/notifications.ts`) is the ONE outbound-email path;
  `notifyLandlord()` resolves the landlord's email and delegates to it. Without
  `RESEND_API_KEY` it logs a `[notify STUB]` block; with it, it still does not send
  (TODO(resend)) and warns loudly. It never throws. Add new events to
  `NotificationEvent` rather than creating another stub.
- `sendAgreementForSigning()` (`src/lib/agreements/flowmono.ts`) is a STUB with the TODO
  marking where the Flowmono call goes. Admin flips pending_signature → signed by hand.

Placeholder copy lives in `src/lib/content/enugu-ops.ts` (square brackets = replace me).

## Tenant waitlist — Stage 1 (Step 3, built 2026-09-15)

- `/waitlist` — public form, no auth: name, WhatsApp number, email. Nothing else
  (no city / apartment type / budget). Server action `joinWaitlist` inserts through
  the public-insert policy; a duplicate email (23505) is treated as success so the
  form never reveals whether an address is already on the list. Honeypot field.
- `/waitlist/joined` — confirmation: on the priority list, notified by
  email/WhatsApp when the official queue opens. Copy in the WAITLIST FLOW must
  never say "search", "browse", "apply for" or "queue for an apartment".
  (Owner decision, homepage redesign 2026-09-22: the homepage itself now has a
  search bar and says "search"; the ban is scoped to /waitlist and its
  confirmation, plus "apply for" / "queue for an apartment" everywhere tenant-facing.)
- There is deliberately NO "check my status" page: tenants have no account, and an
  email-keyed lookup would leak whether an address is registered.
- `/admin/waitlist` — read-only list for admin AND staff (bd / inspector): name,
  contact, joined, days-on-list (computed from `joined_at`), stage. No actions —
  Stage 2 conversion is a later step. The `/admin` shell now admits staff
  (`requireStaffOrAdminPage`); `/admin/landlords*` stays admin-only via a
  page-level `requireAdminPage`.
- No notification is sent on signup (not in Stage 1). Email/WhatsApp verification
  is an open decision — neither side is implemented.

## Staff invites (Step 4, built 2026-09-15)

- `/admin/staff` (admin-only, page-level `requireAdminPage`): create invite (email +
  `bd` / `inspector` checkboxes, one account may hold both), list invites with state
  (Pending / Accepted / Revoked / Expired) and a Revoke action, list staff accounts
  with Deactivate / Reactivate.
- Creating an invite: rejects up front if the email belongs to ANY auth user
  (`public.email_is_registered()`, service-role-only SECURITY DEFINER function,
  migration 0013); one pending invite per email (partial unique index, 0013);
  token comes from the DB default (0005); **expiry = 7 days — an assumption
  (`INVITE_EXPIRY_DAYS` in `src/lib/invites.ts`), not owner-specified**. The invite
  URL is logged through `notifyByEmail` (stub) AND shown on the page
  (`?created=<id>`) for manual copy-paste. `NEXT_PUBLIC_SITE_URL` or the request
  host builds the absolute link (`src/lib/site-url.ts`).
- Deactivate = `auth.admin.updateUserById(id, { ban_duration: "876000h" })`,
  reactivate = `"none"`. Nothing is deleted; profile + history stay. Admin accounts
  and the caller's own account are refused. A banned user's existing access token
  can live up to its expiry (≤ 1 h), but `getUser()` on every server render rejects
  banned users immediately.
- `/staff/invite/[token]` (public): resolves the token server-side with the
  service role (the table is admin-only under RLS). States: valid → set-password
  form; accepted / revoked / expired / not-found → distinct messages, no form.
  Visiting an expired-but-pending link lazily records `status = expired`.
- Accepting: claims the token atomically (pending → accepted, only while valid),
  creates the auth user via the Admin API with `app_metadata.role_tags` from the
  invite (never the self-service sign-up, which would make them a landlord),
  verifies the profile's role_tags match (corrects if not), notifies via the stub,
  signs them in and redirects to `/admin/waitlist`. On createUser failure the claim
  is reverted so the link can be retried.
- Staff home after login is `/admin/waitlist`; the `/admin` shell shows Landlords
  and Staff links to admins only.

## Tenant accounts + queue conversion — Stage 2 (Step 5, built 2026-09-21)

- `/admin/waitlist` is no longer read-only for admins: "Invite to convert" per entry,
  "Invite everyone still waiting" bulk, pending-invite links shown inline, Revoke.
  Staff still see it read-only. Actions in `src/app/admin/waitlist/actions.ts`
  (admin session for invite rows via RLS; service role only for
  `waitlist_entries.conversion_status`). Stage mapping: invite → `invited_to_convert`,
  ID submitted → `kyc_pending` (rejected stays there), verified → `active_queue`,
  revoked-before-conversion → back to `waitlist`.
- `/waitlist/convert/[token]` (public): token resolved server-side (service role);
  valid → create account (email locked to the entry) or, if a signed-in user's
  email matches, "Continue with this account" (adds the `tenant` tag + `tenants`
  row to the existing account — a landlord can also be a tenant); accepted /
  revoked / expired / not-found → distinct messages. Atomic token claim, reverted
  if user creation fails. New accounts are created via the Admin API with
  `app_metadata.role_tags = ['tenant']` (self-service sign-up would tag landlord).
- `/tenant` (signed-in tenants): status in plain language (`TENANT_KYC_STATUS`),
  ID uploader (browser → `tenant-documents` bucket → `recordTenantDocument`),
  "Submit / Resubmit for review" → `submitTenantKyc` (calls the Dojah STUB
  `verifyTenantKyc()` in `src/lib/kyc/dojah.ts`, always manual review, then
  service-role flip to `pending`). Rejection reason + resubmit path shown.
- `/admin/tenants` (admin-only): pending/rejected/verified tabs, signed document
  links, verify / reject-with-reason (`setTenantKyc`, service role, notifies).
- Notifications: `notifyTenant()` + `TenantNotificationEvent` added to
  `src/lib/notifications.ts` — same stub core (`notifyByEmail`), no new pattern.
- Tenant-facing copy follows the waitlist banned-phrase rule ("search", "browse",
  "apply for", "queue for an apartment").
- Out of scope, still: applying to a unit, payments, maintenance tickets,
  changes to Stage 1 signup, automated Dojah calls. (Listings arrived in Step 7.)

## Public pages — homepage + /search (rebuilt 2026-09-22 on the Sheltos reference)

- `/` = transparent navy-text nav over the hero (`site-nav.tsx`, hamburger
  <details> under 992px) → hero (`.home-hero`: aerial photo, dark gradient
  overlay, `hero-slider.tsx` text slides from `HERO_SLIDES`, `looking-for.tsx`
  tiles, `filter-box.tsx` dark variant) → Provided Services (`SERVICES`,
  `section-title.tsx`) → about (`ABOUT`) → Available apartments (6 newest,
  `property-grid.tsx` 3 columns) → landlord band → contact → `site-footer.tsx`.
- `/search` = banner + breadcrumb → sidebar (FilterBox light variant, Areas with
  counts from `getAreaCounts()`, Contact info from env, Recently added) →
  results (`SortSelect`, view toggles `?view=2|3|list`, `PropertyGrid`,
  pagination `?page=`, 6 per page). Params: `q area furnishing bedrooms
  bathrooms min_rent max_rent min_size max_size sort page view`; all parsed
  defensively in `parseListingQuery/parsePage/parseView`; slider values at their
  bound (`RENT_RANGE`/`SIZE_RANGE` in `lib/listings.ts`) mean "no limit".
- `/homes/[id]` (`src/app/homes/[id]/page.tsx`, ISR 60 s, 404 for non-UUIDs and
  unlisted ids) = the property page: `getPublicListingById()` (anon view + every
  photo signed), `photo-gallery.tsx` (client, thumbnails, ←/→), `share-buttons.tsx`
  (Web Share / copy link, print), details list, fees from `FEES`, amenity
  features, related homes (same area first), sidebar contact card + the contact
  form (`compact`, `defaultMessage`) + recently added. `SiteNav variant="solid"`
  (white bar) because the page has no banner.
- Cards (`property-card.tsx`, server) only ever receive the anon view's columns;
  every part of a card links to `/homes/[id]`.
- Data: `getPublicListingsPage()` (count + range + sort), `getPublicListings()`,
  `getAreaCounts()`, `getListingAreas()` in `lib/public-listings.ts`; photos are
  signed server-side (1 h), pages cached 60 s (`/` ISR; `/search` dynamic).
- Styles: `src/app/home.css` only, scoped under `.home`. Tokens: `--navy`
  #0B1F4B (the one blue), `--text` #1C2D3A, `--mute` #5B6770 (reference grey
  darkened to 5.6:1), `--tint` #F7F8FB, `--shadow` 0 0 35px rgba(0,0,0,.08).
  Buttons: `.btn--gradient` (navy gradient, 8px radius; `--pill` = 30px),
  `.btn--flat`, `.btn--dashed`, `.btn--white`. Fonts: Montserrat + Roboto via
  `next/font/google` on both pages (`--font-montserrat`, `--font-roboto`).
- Hero photo: `public/hero/enugu-aerial.jpg` (owner-supplied). Next 16 only
  accepts `images.qualities` (default `[75]`) — never pass a custom `quality`.
- The page reads ONLY public data through `createPublicClient()` (anon key, no
  cookies); the header is static (no session).
- Local test listings: `scripts/dev-listings.sh` (six listed fixtures with cover
  photos; also recreates the `storage.objects (bucket_id, name)` unique index
  because local storage-api v1.72.1 drops it and then 500s on uploads).
- Contact form → `submit_contact_message()` RPC (rate-limited; the only write
  path); `/waitlist` copy rules unchanged.

## Property listings (Step 7, built 2026-09-22)

- DECISION: listing content and photos are authored by HomeLy staff/admin, never
  by landlords. Landlords see a read-only "Your listing, as written by HomeLy"
  panel on /landlord/dashboard.
- `/admin/properties` (staff + admin): status filter, landlord/city columns.
  `/admin/properties/[id]`: listing form, multi-photo upload (browser → bucket →
  `recordPropertyPhoto`), reorder (↑/↓), caption, delete (Storage API remove +
  row). Publish / Unpublish (ADMIN ONLY, `publishProperty` / `unpublishProperty`,
  service role): under_inspection ↔ listed; refuses without description, rent
  and ≥1 photo (also DB-enforced). A submitted/rejected property is first moved
  to under_inspection on the landlord review page.
- Tenant browse is GATED, not public (§15 keeps the waitlist as the launch gate):
  `/tenant/browse` and `/tenant/browse/[id]` require the `tenant` tag AND
  `tenants.kyc_status = 'verified'` (`requireVerifiedTenant` in
  `src/app/tenant/gate.tsx`); anyone else gets the "finish your ID check" surface.
  Only `listed` properties, newest `listed_at` first. Detail shows fees computed
  from `src/lib/fees.ts` (agency + legal one-time on top of rent; management fee
  is landlord-side) and states plainly that applications open in a later step.
  No public browse route; /waitlist and the homepage are unchanged.
- Photos use plain `<img>` with 10-minute signed URLs, not `next/image`: signed
  URLs are unique per render and expire, which defeats the optimizer's cache and
  would need a `remotePatterns` entry per environment.
- Trigger firing order on `properties` is by NAME and is load-bearing:
  `properties_guard_protected_columns` (42501) → `properties_publish_requirements`
  (23514) → `properties_set_listed_at` → `properties_set_updated_at`.

## Integrations — NOT built yet

Dojah (KYC — `verifyTenantKyc()` stub exists), Monnify / Flutterwave (payments),
Termii (SMS/WhatsApp), Resend (email — `notifyByEmail()` stub exists), Flowmono
(e-signature — `sendAgreementForSigning()` stub exists). Only `TODO(<vendor>)`
comments and stubs mark where they will plug in. Do not add integration code unless asked.

## Deployment (Step 6 infra, 2026-09-22)

Hosting: GitHub (`chimaobi-dennis/homeLy`, `main` = production) → Vercel
(production on push to `main`, preview per branch) → Supabase cloud project.
`DEPLOYMENT.md` is the runbook; keep it correct when any of this changes.

- Four env vars, set in Vercel, never committed: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `NEXT_PUBLIC_SITE_URL`. `NEXT_PUBLIC_SITE_URL` is set on Production only —
  previews derive their origin from the request (`src/lib/site-url.ts`).
- `vercel.json` pins functions to `lhr1`; the Supabase project is `eu-west-2`.
  Move both together.
- `supabase/seed.sql` never runs on cloud. The first production admin is created
  by hand (DEPLOYMENT.md §6): add the user in the dashboard, then write
  `role_tags` into `auth.users.raw_app_meta_data` and let the
  `on_auth_user_app_metadata_updated` trigger mirror it into `profiles`.
- Hosted Auth differs from `supabase/config.toml` in two ways that matter:
  email confirmation defaults ON (local: off — decide per DEPLOYMENT.md §5), and
  Site URL / redirect URLs must be set in the dashboard. `config.toml` does not
  apply to cloud.
- Preview deployments currently share the production database. There is no
  staging project.
- On Vercel, `[notify STUB]` / `[flowmono STUB]` / `[dojah STUB]` lines land in
  the Vercel function logs, not a terminal.

## Standing rules for Claude

1. **End every session with a full plain-text summary** of every file created or
   changed and every decision made — even if not asked for that turn. Include
   every migration and RLS policy touched, and flag anything guessed instead of
   silently assuming. Confirm which git commits were made.
2. Schema changes go in a new migration file, never by editing an applied one
   and never by ad-hoc SQL. Regenerate types afterwards.
3. Never weaken an RLS policy or grant to "make something work" — fix the query
   or use the service role in trusted server code.
4. Never send real emails/SMS/WhatsApp from tests or local dev.
5. Stage 1 tenants stay account-less. Tenant accounts exist only via Stage 2
   conversion invites (Step 5); do not add self-service tenant sign-up.
6. **Production database access is the owner's alone.** Never run `db push` or
   `db reset --linked` against the cloud project. For every new migration, hand
   the owner the SQL to run in the Supabase SQL Editor together with the
   `supabase_migrations.schema_migrations` insert (DEPLOYMENT.md §7c), then
   verify read-only with `db push --dry-run`. Only a remote reset with
   `--no-seed` is ever acceptable, and only the owner runs it.
7. The seeded dev accounts must not exist on production (DEPLOYMENT.md §7b).
