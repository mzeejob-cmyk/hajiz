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
