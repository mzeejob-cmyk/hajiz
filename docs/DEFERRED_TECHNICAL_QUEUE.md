# HAJIZ Deferred Technical Queue

These items are deliberately recorded without implementation in the Backend Core closeout.

## Pre-supplier enablement

- Add an explicit Travelport enable flag independent of credential presence.
- Remove `globalThis.fetch` as the Travelport client's implicit default; require explicit server injection.
- Persist Travelport offer and repricing references rather than retaining them in a process-local `Map()`.
- Harden supplier network isolation with per-provider timeouts, cancellation, concurrency limits, and failure containment.

## Pre-production

- Define secure default privileges for `app_private`.
- Seed and verify environment-specific checkout return origins.
- Define the refund-to-booking lifecycle.
- Tighten `create_checkout` idempotency scope.
- Replace Staging project-ref assumptions with productionized environment configuration.
- Relocate or otherwise make `PLAN_ONLY` migration handling unambiguous and non-executable.
- Decide whether checkout return URLs may contain query strings or fragments.
- Define Bankak checkout UI scope against the trusted receipt/review contracts.
- Remove or externalize the inactive legacy public Supabase configuration.
