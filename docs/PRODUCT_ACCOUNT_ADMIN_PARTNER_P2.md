# HAJIZ Product / Account / Admin / Partner P2

## Scope and repository truth

This branch starts from canonical C1 commit `aef4bb77f53c12edf25fb0607853836affea7765` and implements only the seven P2 areas recorded by P1. It does not claim production readiness and it does not apply a migration.

| Area at canonical base | Repository truth before P2 |
| --- | --- |
| Account/Profile | PARTIAL — allowlisted presentation and an existing authenticated `update_my_profile` RPC, but no browser service wiring |
| Session/Auth integration | PARTIAL — authenticated My Trips existed; profile load/update/logout did not use that session authority |
| Saved Travelers | CONTRACT-ONLY |
| Favorites | CONTRACT-ONLY |
| Preferences | CONTRACT-ONLY |
| My Trips | IMPLEMENTED — owner-scoped RPCs and trusted ticket projection |
| Admin/Ops | PRESENTATION-ONLY |
| Partner Portal | PRESENTATION-ONLY |
| KYC | CONTRACT-ONLY |
| Commission | CONTRACT-ONLY |
| Payouts | CONTRACT-ONLY |
| Packages | PRESENTATION-ONLY |
| Offers | PRESENTATION-ONLY |
| CMS | CONTRACT-ONLY |
| Notifications | CONTRACT-ONLY |
| Artifact Delivery | PARTIAL — trusted availability metadata existed, but no private-byte delivery boundary |

## Account/Profile and session

`accountDataSource` now uses the same Supabase session client as My Trips. It verifies the authenticated user through `auth.getUser()`, reads only `id`, `display_name`, and `phone` through the existing RLS-protected profile relation, verifies that the returned owner is the authenticated user, and writes only `displayName` and `phone` through the existing `update_my_profile` RPC. The browser supplies no owner identifier.

The profile screen clears its in-memory PII on auth state changes and before logout. Logout uses local session scope. No profile PII is placed in a URL, local storage, session storage, IndexedDB, or cookies by this feature. The authenticated email is display-only and is never submitted to the update RPC.

Status: **IMPLEMENTED** against existing canonical authority.

## Saved travelers, favorites, and preferences

The P2 server boundary validates authentication before persistence, derives `owner_id` exclusively from the verified session, applies an owner predicate to every list/update/delete operation, and rejects browser-supplied authority fields. Saved traveler data is intentionally limited to bounded first and last names; passport/document/contact fields are not accepted. Favorites store only a public canonical identifier and type. Preferences currently permit only the allowlisted locale.

Durable tables do not exist in canonical C1. A minimal rollback-only schema and RLS proposal is stored at `docs/proposals/P2_STORAGE_PROPOSAL.sql`; it is outside `supabase/migrations` and was not applied. The current UI therefore remains honestly contract-pending and does not claim saved data.

Status: **PREPARED / BLOCKED** pending separate migration review and authorization.

## My Trips preservation

The canonical My Trips contract, owner-scoped RPC behavior, payment/booking separation, and artifact gate were not rewritten. The shared session-client change only removes duplicate client construction; the read RPC surface remains unchanged. Ticket download still requires trusted `AVAILABLE` artifact authority, not payment confirmation, PNR, supplier reference, or a textual ticket status.

Status: **PASS**.

## Role-aware Admin reads

The P2 service authenticates the caller, reads the caller's stored role from `public.profiles`, denies non-admin callers before the operational query, and repeats the stored-admin predicate in the read. The result projection contains the public booking reference, separate booking/payment states, method, amount, and currency. It excludes supplier net, provider-private metadata, and all mutation authority. Hidden navigation or a browser role field is never authorization.

The repository has no deployed server composition endpoint for this adapter in this batch, so the existing Admin UI remains presentation-only until independently wired and runtime-reviewed.

Status: **PARTIAL**.

## Partner/KYC, commission, and payout

The proposed service is owner-scoped and read-only. It projects stored KYC state, commission entries, and payout records while excluding `supplier_net`, wallet authority, and browser-calculated commission. It exposes no KYC mutation, commission-credit method, or payout-execution method. `payoutExecutionAllowed` remains false, and wallet balance is not equated with available commission.

Model B remains authoritative: supplier net and commission production stay server-internal; no client price-floor or commission authority was added. The required durable objects and their authoritative producers do not yet exist, and no financial provider is configured.

Status: **PREPARED / BLOCKED** pending schema approval, authoritative ledger/KYC producer design, and any separately approved payout provider.

## CMS publishing

The server boundary separates draft and published states. Published reads expose only type, title, summary, state, and explicit non-dynamic/non-supplier availability markers. Draft reads, saves, and publication require the stored admin role; the browser cannot self-promote or supply supplier availability. This is content publishing only and adds no supplier orchestration or booking semantics.

The CMS table is proposal-only and no deployed endpoint/UI composition was added.

Status: **PREPARED / BLOCKED** pending schema approval and runtime wiring.

## Notifications/outbox

The internal outbox boundary accepts a closed event set, derives its recipient from the canonical booking owner, uses a unique server event identifier for idempotency, and refuses arbitrary recipients or payloads. Retry/delivery is explicitly `NOT_CONFIGURED`; no external provider is contacted and `deliver()` fails closed.

Status: **PREPARED / BLOCKED**. Provider delivery: **BLOCKED / NOT CONFIGURED**.

## Artifact delivery

The delivery service accepts only a ticket UUID, derives the owner from verified authentication, and requires one joined authority chain: owner booking is `ticketed`, B14 execution is `ISSUED`, reconciliation is not required, and the ticket artifact is `AVAILABLE`. A trusted private registry resolves the stored reference; no client path or key is accepted. The service permits only bounded PDF bytes whose SHA-256 digest matches the trusted record, rechecks authentication before returning, and sets a no-store response boundary.

The private artifact reader/storage provider is not configured by this repository batch, so actual byte delivery remains disabled.

Status: **PARTIAL** pending approved private artifact provider composition and runtime verification.

## Migration control

- Migration required: **YES** for saved travelers, favorites/preferences, Partner/KYC read models, commission/payout read models, CMS, and notification outbox.
- Migration prepared: **YES**, as the review-only rollback proposal `docs/proposals/P2_STORAGE_PROPOSAL.sql`.
- Migration applied or historical migration modified: **NO**.
- Staging schema touched or Staging access performed: **NO**.

The proposal creates only private P2 objects, enables RLS, revokes direct browser/service-role table access, and provides owner-select defense-in-depth policies where an owner column exists. It intentionally supplies no privileged writer grants or RPCs for financial, KYC, payout, or delivery authority. It must receive a separate schema/security review and local database validation before it can become a canonical migration.

## Tests and protected invariants

The P2 suite covers unauthenticated and cross-owner rejection, allowlisted profile updates, owner-derived storage, traveler PII bounds, Admin role enforcement, role-injection rejection, Model B projections, payout/commission non-mutation, CMS role and content controls, outbox recipient/idempotency controls, artifact ownership/availability/path/digest controls, safe HTTP errors, and proposal-only migration controls.

Verified gates on this branch before publication:

- Canonical suites plus P2: `800/800`, with `LOST=0` and `SKIPPED=0`.
- Product P2 targeted: `33/33`.
- Hotels targeted: `62/62` expected and protected separately.
- Build, lint, and diff checks are required to pass before commit.

The following remain unchanged in authority: payment confirmation is not supplier confirmation; lifecycle transitions remain server-owned; trusted AVAILABLE artifact evidence remains mandatory; Model B economics stay internal; My Trips remains owner scoped; B13/B14 concurrency and crash semantics remain untouched; expiry remains based on authoritative server time.

## Blocked external dependencies and remaining P2

Only the following work remains:

1. Review, validate, approve, and later apply a canonical migration derived from the proposal.
2. Compose and runtime-test the prepared owner/admin/partner/CMS/outbox server boundaries after schema deployment.
3. Define separately reviewed authoritative KYC, commission-ledger, and payout producers; keep payout execution disabled until a provider is approved.
4. Configure and review a notification provider/worker without changing outbox recipient authority.
5. Configure a trusted private artifact reader/storage provider and verify owner-only delivery at runtime.
6. Wire the Admin, Partner, CMS, travelers, and favorites screens only after their deployed authorities exist.

Hotels H2 remains PARTIAL and was not modified. No Production, Legacy, live supplier, Travelport capability, hotel supplier, hold, hotel booking/payment, voucher, or cancellation/refund path was touched.
