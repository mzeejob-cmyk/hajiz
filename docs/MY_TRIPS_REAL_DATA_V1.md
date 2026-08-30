# My Trips Real Data V1

The active screen reads only the authenticated customer's rows through `get_my_bookings`, `get_my_payments`, and the additive owner-scoped B14 ticketing RPCs. The browser receives an anon key; RPC ownership comes from the signed-in user. No browser write or elevated key is used.

Runtime configuration is fail-closed: `VITE_SUPABASE_URL` must be exactly `https://pdnuswmljownjzjzpoop.supabase.co` and `VITE_SUPABASE_ANON_KEY` must be present. Missing configuration, no authenticated session, malformed results, and RPC errors render the error state; synthetic fixtures are never substituted in staging.

The current RPCs do not expose itinerary details or an opaque booking-detail identifier. The screen therefore shows only authoritative status, amount, currency, payment method, creation date, booking reference, and B14 ticket evidence state. Owner-scoped ticket numbers load in place only after `ticketed` plus `ISSUED`; no PNR, ticket number, passenger data, or artifact reference enters a URL. Download remains unavailable unless trusted artifact metadata says `AVAILABLE`.

The app does not invent a login flow. A compatible authenticated browser session is a prerequisite. Synthetic fixtures remain test/dev presentation material only and are not imported by the active screen.
