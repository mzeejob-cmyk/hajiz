# Product / Account / Admin / Partner P1

## Repository truth and base

P1 is based on `frontend/my-trips-real-data-v1` (`a79b713`) and preserves its authenticated `get_my_bookings` / `get_my_payments` authority. The existing read-only Admin/Ops implementation (`4541f08`) was a sibling branch from `a58ef21`; it was narrowly ported rather than recreated. `integration/v2` was not selected because it also contains Flight runtime and payment remediation outside this batch.

## Implemented foundation

- Account navigation, profile/contact edit boundary, session/logout boundary, saved-traveler and favorites/preferences contract-pending states.
- My Trips retains authenticated RPC reads. Ticket download remains false unless a future trusted artifact contract supplies evidence.
- Admin/Ops preserves its existing presentation and expands navigation to the target operating areas. All current queue rows remain explicitly synthetic.
- Partner Portal is a Model B presentation shell for bookings, clients, commission, payouts, KYC, referrals and pricing uplift. It exposes no supplier net, wallet balance, payout mutation or production data.
- Packages and Offers expose CMS presentation contracts only; publishing and dynamic building are disabled.
- Notifications define schema/event validation only. No sending provider is configured.

## Not production ready / P2

P2 must separately approve authenticated profile loading/edit wiring, travelers/favorites storage and RLS, role-aware Admin reads, Partner/KYC/commission/payout services, CMS publishing workflow, notification provider/outbox, and trusted ticket artifact projection. No live supplier, payment, Bankak, PSP, wallet accounting, pricing or FX semantics were changed here.

## Final P1 verification

- The final branch ancestry retains `a79b713` (authenticated My Trips reads) and the narrow Admin/Ops port at `97073d4`.
- The inherited baseline registers 109 core/supplier tests and 21 PSP tests. P1 adds 9 contract/presentation tests; the final expected inventory is 118 core/supplier plus 21 PSP tests, with none skipped or removed.
- P1 assertions cover Account privacy and editable-field allow-listing, contract-pending travelers/favorites, My Trips ticket evidence, complete Admin navigation, Partner Model B safe projection and supplier-net exclusion, notifications schema, and Packages/Offers CMS boundaries.
- Release claims remain intentionally limited: passing local tests and build do not establish production readiness or live backend wiring.
