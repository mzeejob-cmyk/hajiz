# My Trips Real Data V1

The active screen reads only the authenticated customer's rows through `get_my_bookings` and `get_my_payments`. The browser receives an anon key; RPC ownership comes from the signed-in user. No browser write or elevated key is used.

Runtime configuration is fail-closed: `VITE_SUPABASE_URL` must be exactly `https://pdnuswmljownjzjzpoop.supabase.co` and `VITE_SUPABASE_ANON_KEY` must be present. Missing configuration, no authenticated session, malformed results, and RPC errors render the error state; synthetic fixtures are never substituted in staging.

The current RPCs do not expose itinerary details or an opaque booking-detail identifier. The screen therefore shows only authoritative status, amount, currency, payment method, creation date, and booking reference. Detail navigation remains disabled so no reference, PNR, passenger data, or other sensitive value enters a URL and no synthetic detail is presented as real.

The app does not invent a login flow. A compatible authenticated browser session is a prerequisite. Synthetic fixtures remain test/dev presentation material only and are not imported by the active screen.
