# Payment Authority Security Gate V2

Scope: `HAJIZ Staging` (`pdnuswmljownjzjzpoop`) only. Production is not a migration target for this gate.

## Return URL authority

`create_checkout` calls `app_private.is_allowed_checkout_return_url`. Origins are stored in the server-owned `app_private.checkout_return_origins` table. The V2 seed contains only `http://localhost:5173` and `http://127.0.0.1:5173`; no production hostname is assumed. Paths may contain a restricted unencoded character set. Queries, fragments, percent encoding, whitespace, backslashes, userinfo, non-local HTTP, and non-allow-listed hosts are rejected. A real staging or production origin must be added by a reviewed migration.

## Receipt trust boundary

The authenticated browser may only insert a new object at `user_id/payment_id/filename` for its own unexpired, awaiting Bankak payment. It cannot list, read, update, overwrite, or delete receipt objects. Bucket limits remain 10 MB and JPEG/PNG/PDF metadata, but metadata and extensions are not trusted.

The JWT-protected `inspect-payment-receipt` Edge Function is the only inspection boundary. It validates the caller JWT, constrains the object prefix to the caller, downloads through the Edge runtime's server-only service credential, enforces the byte limit, detects JPEG/PNG/PDF from magic bytes, computes SHA-256 from the downloaded bytes, and then calls the service-role-only `register_inspected_receipt` RPC. That RPC rechecks payment state and exact path, appends the inspected receipt record and audit event, and moves `awaiting` only to `under_review`. The service credential is never returned to or accepted from a browser.

## Live staging verification

Run `scripts/payment-security-v2-live-tests.mjs` only against a disposable Staging dataset. It requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `HAJIZ_V2_TEST_PASSWORD`. The suite covers the signed customer, finance, and admin paths, hostile return URLs, ownership, forbidden RPCs, object-path policies, browser operation denial, size, overwrite, valid JPEG/PNG/PDF inspection, renamed invalid content, idempotency, and Bankak review. Service-role transition, replay, append-only, and economics immutability assertions are executed with trusted SQL role tests. All test users, rows, and objects must be removed after the run and zero-count cleanup verified.

## SECURITY DEFINER rationale

The five browser-callable functions remain `SECURITY DEFINER` deliberately. `create_checkout` must atomically read protected offer, traveler, and FX data and write authoritative economics. The two read projections must expose only safe columns without granting base-table reads. `update_my_profile` must restrict writable columns without a broader table update grant. `review_bankak_payment` must read protected staff authorization and atomically review. Each has a fixed `search_path`, explicit authentication or staff/ownership predicates, and minimal grants. Server-only functions remain revoked from browser roles. Converting these functions to invoker would require broader base-table privileges and weaken the boundary.
