# Tenant journey — end to end (brainstorm + build plan)

Written 2026-09-22 from the owner's brief: *registering → joining the queue →
applying for an apartment (by queue) → viewing offer → accept/decline after
viewing → tenancy offer when #1 → sign → pay → confirm key collection on move-in
→ manage the tenancy (complaints, view contract, cancel contract).*

Everything below is proposed. Items marked **DECISION** need the owner's answer
before that phase is built; the default in brackets is what gets built if the
answer is "go with your recommendation". Vendor integrations (Flowmono, Monnify,
Dojah, Termii/Resend/WhatsApp) stay stubs — the flow is built so each stub can
be swapped for the real call without a redesign.

---

## 0. What already exists (Steps 1–7 + homepage)

| Journey step | Status today |
|---|---|
| Register / join the queue | `/waitlist` (name, WhatsApp, email → `waitlist_entries.joined_at`; 1 day = 1 point). No account yet (Stage 1). |
| Account creation | Admin invites (`/admin/waitlist`) → `/waitlist/convert/[token]` creates the tenant account (Stage 2). The bulk "Invite everyone still waiting" is the launch switch. |
| Identity (KYC) | `/tenant`: ID upload → manual review (`/admin/tenants`) → `tenants.kyc_status = verified`. Dojah stub in place. |
| Seeing homes | Public `/`, `/search`, `/homes/[id]` (anon view, no address). Verified tenants also have `/tenant/browse` (shows the address). |
| Applying and everything after | **Not built.** |

So "registering" and "joining the queue" are done; the build starts at
*applying* and ends at *cancelling a contract*.

---

## 1. The journey as a state machine

One `applications` row per tenant × property drives the pre-tenancy stages;
one `tenancies` row is created when an offer is accepted and drives everything
after. Names in `code` are the proposed enum values.

```
APPLY                     VIEW                              OFFER                          TENANCY
applied ──► viewing_offered ──► viewing_accepted ──► viewed ──► accepted_after_viewing ──► offer_issued ──► offer_accepted ──┐
   │              │ (tenant asks to reschedule → new slot)      │ declined_after_viewing        │ offer_declined / offer_expired │
   │ withdrawn (tenant, any time before offer_accepted)         └── closed_lost (someone ahead accepted the offer)              │
   └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                                                                             ▼
                              tenancies: pending_signature ──► pending_payment ──► pending_move_in ──► active ──► notice_given ──► ended
                                                    (sign)              (pay)         (keys collected)          (termination approved)
```

**Queue rule (the heart of it).** For a property, applicants are ranked by
queue points (`floor(days since waitlist_entries.joined_at)`, live, ties by
application time). Viewings are offered in that order. A tenancy offer can only
be issued to the applicant who is **currently #1 and has
`accepted_after_viewing`**. When #1 declines (after viewing, or the offer) or
the offer expires, #2 becomes #1. When an offer is accepted, every other live
application on that property becomes `closed_lost` and the winner's other live
applications are withdrawn automatically.

**Who moves what.** Tenants: apply, accept a viewing slot / ask to reschedule,
accept or decline after viewing, accept or decline an offer, withdraw, sign,
pay (stub), confirm keys, open tickets, request termination. Staff (bd /
inspector): offer viewing slots, mark a viewing done or no-show, record the
key handover, work tickets. Admin: issue offers, confirm payments, approve
terminations, everything staff can do. All of this is enforced in Postgres
(RLS + guard triggers), not only in the UI — same pattern as `properties.status`.

---

## 2. Data model (new tables; all RLS + guard triggers + tests)

| Table | Purpose | Key columns |
|---|---|---|
| `applications` | one per tenant × listed property | tenant_id, property_id, status (enum above), applied_at, withdrawn_at, closed_reason; unique (tenant_id, property_id) while live |
| `viewings` | slots for an application | application_id, proposed_at (staff), scheduled_at, status (proposed / accepted / reschedule_requested / done / no_show / cancelled), staff_notes, tenant_note |
| `offers` | the tenancy offer to #1 | application_id, annual_rent, agency_fee_ngn, legal_fee_ngn, total_due_ngn, move_in_date, expires_at (72 h), status (issued / accepted / declined / expired / withdrawn), issued_by |
| `tenancies` | the contract | application_id, property_id, tenant_id, start_date, end_date (start + 1 year), annual_rent, status (pending_signature / pending_payment / pending_move_in / active / notice_given / ended / terminated), agreement_status (draft / pending_signature / signed), signed_at, signature_name (stub until Flowmono), keys_collected_at, keys_confirmed_by_tenant_at, handover_recorded_by |
| `payments` | money in (stub) | tenancy_id, kind (rent / agency_fee / legal_fee), amount_ngn, reference (HL-…), provider ('manual_transfer' now, 'monnify' later), status (pending / confirmed / failed), confirmed_by, confirmed_at |
| `maintenance_tickets` | complaints | tenancy_id, category (electrical / plumbing / structural / security / other), title, description, status (open / acknowledged / scheduled / in_progress / resolved / closed), priority, scheduled_for, resolution_note, cost_ngn (admin only), closed_by_tenant_at |
| `ticket_photos` | private bucket `ticket-photos` | ticket_id, storage_path (under `<ticket_id>/`) |
| `termination_requests` | cancel contract | tenancy_id, reason, requested_move_out, status (requested / approved / declined / completed), decided_by, decision_note |
| `tenant_queue_points(tenant_id)` | SQL function | points from `waitlist_entries.joined_at` (fallback `tenants.converted_at`) |
| `application_rankings` | view | property_id, application_id, tenant_id, points, rank (live applications only) |

Privacy: a tenant reads only their own rows; the property address appears to a
tenant only after `viewing_accepted` (on the viewing card) — before that the
public listing columns only. Landlords see nothing of applications in this
build (landlord dashboard is a later step, §16 of the product doc).

---

## 3. Screens

### Tenant (all under `/tenant`, tenant-tagged accounts only)
- `/tenant` — **hub**: queue points + position band, KYC status, "My applications" (cards with the stage in plain language and the one next action), current tenancy card.
- `/homes/[id]` — for a signed-in **verified** tenant the page gains an **Apply for this home** button (others see the priority-list CTA). Applying = one click + optional note.
- `/tenant/applications/[id]` — timeline of that application; accept the viewing slot / ask to reschedule; after the viewing: **I want this home** / **Not for me**; the offer (rent, fees, total, move-in date, countdown) with **Accept** / **Decline**; withdraw.
- `/tenant/tenancy` — the contract: terms, agreement (stub text + typed signature), **Pay** page (amount breakdown + payment reference + "we confirm within 24 h" — manual until Monnify), **I have collected the keys** on/after move-in date, documents, next renewal date.
- `/tenant/tickets` + `/tenant/tickets/new` + `/tenant/tickets/[id]` — complaints with photos and a status timeline; the tenant can close a resolved ticket.
- `/tenant/tenancy/cancel` — request termination (reason, requested move-out date, what the agreement says about notice); status of the request.

### Staff / admin (existing `/admin` shell)
- `/admin/applications` — per listed property: ranked applicants (points, rank, stage), offer a viewing slot, mark viewing done / no-show, view notes.
- `/admin/applications/[propertyId]` → **Issue offer** to the current #1 (admin only; pre-filled rent + fees + move-in date), withdraw offer.
- `/admin/tenancies` — pending payments (**Confirm payment received**, admin), pending move-ins (**Record key handover**, staff), active tenancies, termination requests (**Approve / Decline**, admin).
- `/admin/tickets` — open tickets by property, acknowledge / schedule / resolve, cost (admin).
- Notifications: every transition calls `notifyTenant()` (stub) — viewing offered, offer issued, offer expiring, payment confirmed, handover recorded, ticket updates, termination decision.

---

## 4. Rules and defaults

1. **Eligibility:** only `kyc_status = verified` tenants can apply. Unverified tenants see why and the ID upload link.
2. **Concurrent applications** — **DECISION** [default: up to **3** live applications per tenant; accepting an offer auto-withdraws the others].
3. **Viewing scheduling** — **DECISION** [default: staff proposes a date/time; tenant accepts or asks once to reschedule with a preferred window; staff proposes again].
4. **Offer timing** — **DECISION** [default: 72 hours to accept the offer; then 7 days to sign and pay; missing either lapses the offer and #2 is next].
5. **Money now** — manual bank transfer with a reference; admin confirms receipt (stub for Monnify virtual accounts). Amount = annual rent + 5% agency + 5% legal (from `src/lib/fees.ts`). No caution fee.
6. **Signing now** — typed full name + timestamp stored as the signature, agreement text generated from a template (stub for Flowmono). The agreement PDF/HTML is stored per tenancy so what was signed never changes.
7. **Keys / move-in** — staff records the handover (with a move-in checklist note); the tenancy becomes `active` when the **tenant confirms** collection (staff can confirm on the tenant's behalf after 48 h if the tenant is unresponsive).
8. **Cancelling** — **DECISION** [default: tenant may request termination any time with **30 days'** notice; admin approves/declines; refunds are a manual admin decision recorded on the request, no automatic pro-rata]. The agreement wording needs a lawyer — TODO(owner/legal), flagged in the UI copy as "per your agreement".
9. **Boosts, behaviour points, renewals** — later (product doc §4 Phase 2+).

---

## 5. Build phases (each = migration + RLS tests + UI + docs + deploy)

| Phase | Delivers | Tenant can… | Staff/admin can… |
|---|---|---|---|
| **A** | `applications`, `viewings`, points function, rankings view | apply, see rank, accept/reschedule a viewing, accept/decline after viewing, withdraw | see ranked applicants, offer viewing slots, mark viewed / no-show |
| **B** | `offers`, `tenancies`, `payments`, agreement + payment + handover stubs | accept/decline the offer, sign, pay (reference), confirm keys | issue/withdraw offers, confirm payment, record handover |
| **C** | `maintenance_tickets`, `ticket_photos`, `termination_requests`; `/tenant` hub | open/track/close tickets, view contract, request cancellation | work tickets, decide terminations |
| D (later) | boosts, behaviour points, Monnify/Flowmono/Dojah real calls, renewals, landlord visibility | | |

Phase A is roughly one session, B one to two, C one.
