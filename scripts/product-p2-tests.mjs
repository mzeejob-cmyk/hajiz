import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { createAccountDataSource } from "../src/services/accountDataSource.js"
import { createProductP2Service, createNotificationOutbox, createP2SupabaseAuthenticator, createP2RpcAdapter } from "../src/server/product/productP2Service.js"
import { createProductP2Http } from "../src/server/product/productP2Http.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const A = "11111111-1111-4111-8111-111111111111"
const B = "22222222-2222-4222-8222-222222222222"
const R = "33333333-3333-4333-8333-333333333333"
const T = "44444444-4444-4444-8444-444444444444"
const BOOKING = "55555555-5555-4555-8555-555555555555"
const request = { headers: { authorization: "Bearer synthetic-user-token" } }
const auth = userId => async () => ({ userId })

function accountClient({ user = { id: A, email: "a@example.invalid" }, profile = { id: A, display_name: "A", phone: "+1" }, rpcError = null } = {}) {
  const calls = [], listeners = []
  const client = {
    calls,
    auth: {
      async getUser() { calls.push(["getUser"]); return user ? { data: { user }, error: null } : { data: { user: null }, error: { code: "no" } } },
      async signOut(options) { calls.push(["signOut", options]); return { error: null } },
      onAuthStateChange(callback) { listeners.push(callback); return { data: { subscription: { unsubscribe() { calls.push(["unsubscribe"]) } } } } },
    },
    from(table) { calls.push(["from", table]); return { select(columns) { calls.push(["select", columns]); return { async single() { return { data: profile, error: null } } } } } },
    async rpc(name, args) { calls.push(["rpc", name, args]); return { data: null, error: rpcError } },
    listeners,
  }
  return client
}

await test("profile requires authenticated user", async () => assert.rejects(createAccountDataSource({ getClient: () => accountClient({ user: null }) }).load(), /AUTH_REQUIRED/))
await test("profile owner row loads with allowlisted fields", async () => assert.deepEqual(await createAccountDataSource({ getClient: () => accountClient() }).load(), { displayName: "A", phone: "+1", email: "a@example.invalid" }))
await test("cross-owner profile row fails closed", async () => assert.rejects(createAccountDataSource({ getClient: () => accountClient({ profile: { id: B } }) }).load(), /READ_FAILED/))
await test("profile update accepts only displayName and phone", async () => { const client = accountClient(); const ds = createAccountDataSource({ getClient: () => client }); await assert.rejects(ds.saveProfile({ displayName: "A", phone: "+1", role: "admin" }), /FIELDS/); await ds.saveProfile({ displayName: " A ", phone: " +1 " }); assert.deepEqual(client.calls.find(c => c[0] === "rpc"), ["rpc", "update_my_profile", { p_display_name: "A", p_phone: "+1" }]) })
await test("logout is local session scope", async () => { const client = accountClient(); await createAccountDataSource({ getClient: () => client }).logout(); assert.deepEqual(client.calls.at(-1), ["signOut", { scope: "local" }]) })
await test("session subscription unregisters", () => { const client = accountClient(); const stop = createAccountDataSource({ getClient: () => client }).subscribe(() => {}); stop(); assert.equal(client.calls.at(-1)[0], "unsubscribe") })
await test("Supabase authenticator verifies bearer token through auth service", async () => { let supplied; const fn = createP2SupabaseAuthenticator({ auth: { async getUser(token) { supplied = token; return { data: { user: { id: A } }, error: null } } } }); assert.deepEqual(await fn(request), { userId: A }); assert.equal(supplied, "synthetic-user-token") })
await test("Supabase authenticator rejects malformed and failed tokens", async () => { const fn = createP2SupabaseAuthenticator({ auth: { async getUser() { return { data: {}, error: {} } } } }); await assert.rejects(fn({ headers: {} }), /AUTH_REQUIRED/); await assert.rejects(fn(request), /AUTH_REQUIRED/) })
await test("P2 RPC adapter uses Supabase RPC and fails closed", async () => { const calls = []; const adapter = createP2RpcAdapter({ async rpc(name, params) { calls.push([name, params]); return { data: { ok: true }, error: null } } }); assert.deepEqual(await adapter("safe_rpc", { value: 1 }), { ok: true }); assert.deepEqual(calls[0], ["safe_rpc", { value: 1 }]); const blocked = createP2RpcAdapter({ async rpc() { return { data: null, error: { code: "42501" } } } }); await assert.rejects(blocked("safe_rpc", {}), /PERSISTENCE_UNAVAILABLE/) })

function db({ role = "admin", rows = [], artifact = null } = {}) {
  const calls = []
  const rpc = async (name, params) => {
    calls.push({ name, params })
    if (["get_p2_admin_payments_v1", "p2_catalog_v1"].includes(name) && role !== "admin" && params.p_operation !== "published") throw new Error("ADMIN_REQUIRED")
    if (name === "get_p2_partner_v1") return { owner_id: A, kyc_state: "PENDING", commissions: [{ id: R, currency: "AED", amount: "7.00", state: "EARNED", supplier_net: 100 }], payouts: [{ id: R, currency: "AED", amount: "5.00", state: "PENDING", wallet: 5 }] }
    if (name === "p2_catalog_v1" && ["published", "drafts"].includes(params.p_operation)) return structuredClone(rows)
    if (name === "p2_catalog_v1") return { state: params.p_operation === "publish" ? "published" : "draft", version: params.p_expected_version + 1 }
    if (name === "get_p2_ticket_artifact_authority_v1") return artifact
    return structuredClone(rows)
  }
  return { rpc, calls }
}
await test("persistence-dependent collections block before RPC", async () => { const d = db(); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc }); await assert.rejects(s.collection(request, { collection: "travelers", operation: "list" }), /SCHEMA_NOT_APPLIED/); assert.equal(d.calls.length, 0) })
await test("traveler owner comes only from verified identity", async () => { const d = db({ rows: [{ id: R, data: { firstName: "A", lastName: "B" } }] }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); await assert.rejects(s.collection(request, { collection: "travelers", operation: "list", ownerId: B }), /CLIENT_AUTHORITY/); const result = await s.collection(request, { collection: "travelers", operation: "list" }); assert.equal(d.calls[0].params.p_owner_id, A); assert.equal(result[0].firstName, "A") })
await test("traveler PII is bounded and no document fields accepted", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db().rpc, schemaReady: true }); for (const data of [{ firstName: "A", lastName: "B", passport: "x" }, { firstName: "A".repeat(81), lastName: "B" }]) await assert.rejects(s.collection(request, { collection: "travelers", operation: "save", id: R, data }), /INPUT|AUTHORITY/) })
await test("favorites accept canonical public identity only", async () => { const d = db({ rows: [{ id: R, data: { kind: "hotel", canonicalId: "hjz_htl_one" } }] }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); const value = await s.collection(request, { collection: "favorites", operation: "save", id: R, data: { kind: "hotel", canonicalId: "hjz_htl_one" } }); assert.equal(value.canonicalId, "hjz_htl_one"); await assert.rejects(s.collection(request, { collection: "favorites", operation: "save", id: R, data: { kind: "hotel", canonicalId: "x", supplierRateId: "private" } })) })
await test("preference locale is allowlisted", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db({ rows: [{ id: R, data: { locale: "ar" } }] }).rpc, schemaReady: true }); assert.equal((await s.collection(request, { collection: "preferences", operation: "save", id: R, data: { locale: "ar" } })).locale, "ar"); await assert.rejects(s.collection(request, { collection: "preferences", operation: "save", id: R, data: { locale: "xx" } })) })
await test("deletion uses owner RPC authority and browser owner forbidden", async () => { const d = db({ rows: { deleted: true } }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); await s.collection(request, { collection: "favorites", operation: "delete", id: R }); assert.equal(d.calls[0].params.p_owner_id, A); await assert.rejects(s.collection(request, { collection: "favorites", operation: "delete", id: R, ownerId: B })) })
await test("non-admin denied by authoritative RPC", async () => { const d = db({ role: "customer" }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); await assert.rejects(s.adminReads(request, {}), /ADMIN_REQUIRED/); assert.equal(d.calls.length, 1) })
await test("client role injection denied", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db().rpc, schemaReady: true }); await assert.rejects(s.adminReads(request, { role: "admin" }), /CLIENT_AUTHORITY/) })
await test("admin read projection excludes supplier net and uses RPC only", async () => { const d = db({ rows: [{ booking_ref: "HJZ-1", booking_status: "payment_confirmed", payment_status: "confirmed", method: "psp", amount: 100, currency: "AED", net_cost: 80 }] }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); const rows = await s.adminReads(request, {}); assert.equal(JSON.stringify(rows).includes("net"), false); assert.equal(d.calls[0].name, "get_p2_admin_payments_v1") })
await test("partner read is owner-scoped and excludes net wallet authority", async () => { const d = db(); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); const value = await s.partner(request, {}); assert.equal(value.kycState, "PENDING"); assert.equal(value.payoutExecutionAllowed, false); assert.equal(value.availableCommission, null); assert.equal(JSON.stringify(value).includes("supplier_net"), false); assert.equal(d.calls[0].params.p_owner_id, A) })
await test("partner service has no commission payout or KYC mutation", () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db().rpc, schemaReady: true }); for (const name of ["setCommission", "executePayout", "setKyc"]) assert.equal(s[name], undefined) })
await test("CMS published reads require no client role field", async () => { const d = db({ rows: [{ id: R, type: "offer", title: "T", summary: "S", state: "published", version: 2, supplier_net: 1 }] }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); const rows = await s.catalog(request, { operation: "published" }); assert.equal(rows[0].state, "published"); assert.equal(JSON.stringify(rows).includes("supplier_net"), false); assert.equal(rows[0].supplierAvailability, null) })
await test("CMS draft and publish require stored admin plus version", async () => { const denied = createProductP2Service({ authenticate: auth(A), rpc: db({ role: "customer" }).rpc, schemaReady: true }); await assert.rejects(denied.catalog(request, { operation: "drafts" }), /ADMIN/); const d = db(); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, schemaReady: true }); assert.deepEqual(await s.catalog(request, { operation: "publish", id: R, expectedVersion: 1 }), { state: "published", version: 2 }); assert.equal(d.calls.at(-1).params.p_expected_version, 1) })
await test("CMS cannot publish supplier or dynamic fields", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db().rpc, schemaReady: true }); await assert.rejects(s.catalog(request, { operation: "save", id: R, type: "offer", title: "T", summary: "S", expectedVersion: 0, supplierAvailability: true }), /CLIENT_AUTHORITY/) })
await test("outbox derives recipient in RPC and is provider-gated", async () => { const calls = []; const rpc = async (name, params) => { calls.push({ name, params }); return { state: "NOT_CONFIGURED", replayed: false } }; const outbox = createNotificationOutbox({ rpc, schemaReady: true }); assert.deepEqual(await outbox.enqueue({ eventId: R, bookingId: BOOKING, type: "ticket_issued" }), { state: "NOT_CONFIGURED", delivered: false, replayed: false }); assert.equal(Object.hasOwn(calls[0].params, "recipient_id"), false); await assert.rejects(outbox.deliver(), /PROVIDER_NOT_CONFIGURED/) })
await test("outbox semantic replay cannot be bypassed by regenerated event UUID", async () => { const rpc = async () => ({ state: "NOT_CONFIGURED", replayed: true }); const outbox = createNotificationOutbox({ rpc, schemaReady: true }); assert.equal((await outbox.enqueue({ eventId: R, bookingId: BOOKING, type: "payment_pending" })).replayed, true); assert.equal((await outbox.enqueue({ eventId: T, bookingId: BOOKING, type: "payment_pending" })).replayed, true) })
await test("outbox failed reconciliation requires stable source authority", async () => { const outbox = createNotificationOutbox({ rpc: async () => ({ state: "NOT_CONFIGURED" }), schemaReady: true }); await assert.rejects(outbox.enqueue({ eventId: R, bookingId: BOOKING, type: "failed_reconciliation" }), /SOURCE_EVENT_REQUIRED/); assert.equal((await outbox.enqueue({ eventId: R, bookingId: BOOKING, type: "failed_reconciliation", sourceEventId: T })).delivered, false) })
await test("outbox rejects arbitrary recipient and secrets", async () => { const outbox = createNotificationOutbox({ rpc: db().rpc, schemaReady: true }); for (const extra of [{ recipientId: B }, { payload: { secret: "x" } }]) await assert.rejects(outbox.enqueue({ eventId: R, bookingId: BOOKING, type: "payment_pending", ...extra }), /AUTHORITY/) })

const bytes = new Uint8Array([1, 2, 3]), digest = createHash("sha256").update(bytes).digest("hex")
const artifactRow = { id: T, owner_id: A, artifact_ref: "private/ref", artifact_digest: digest, artifact_media_type: "application/pdf" }
await test("artifact requires trusted AVAILABLE authority RPC and owner", async () => { const d = db({ artifact: artifactRow }); const s = createProductP2Service({ authenticate: auth(A), rpc: d.rpc, artifactReader: { async readTrustedPrivateArtifact(ref) { assert.equal(ref, "private/ref"); return bytes } } }); const result = await s.artifact(request, { ticketId: T }); assert.equal(result.bytes, bytes); assert.equal(d.calls[0].name, "get_p2_ticket_artifact_authority_v1"); assert.deepEqual(d.calls[0].params, { p_owner_id: A, p_ticket_id: T }) })
await test("artifact payment PNR or supplier ref cannot substitute", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db().rpc, artifactReader: {} }); for (const input of [{ ticketId: T, paymentConfirmed: true }, { ticketId: T, pnr: "PNR" }, { ticketId: T, supplierReference: "ref" }]) await assert.rejects(s.artifact(request, input), /AUTHORITY/) })
await test("artifact wrong owner and unavailable row fail closed", async () => { const s = createProductP2Service({ authenticate: auth(B), rpc: db().rpc, artifactReader: {} }); await assert.rejects(s.artifact(request, { ticketId: T }), /UNAVAILABLE/) })
await test("artifact arbitrary path rejected and digest verified", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db({ artifact: artifactRow }).rpc, artifactReader: { async readTrustedPrivateArtifact() { return new Uint8Array([9]) } } }); await assert.rejects(s.artifact(request, { ticketId: T, path: "../../x" }), /AUTHORITY/); await assert.rejects(s.artifact(request, { ticketId: T }), /DIGEST/) })
await test("artifact provider absence is explicit", async () => { const s = createProductP2Service({ authenticate: auth(A), rpc: db({ artifact: artifactRow }).rpc }); await assert.rejects(s.artifact(request, { ticketId: T }), /PROVIDER_NOT_CONFIGURED/) })
await test("HTTP does not expose exception or accept GET", async () => { const h = createProductP2Http({ async collection() { throw new Error("private token and SQL") } }); assert.deepEqual((await h({ method: "POST", operation: "collection", body: {} })).body, { error: "P2_REQUEST_REJECTED" }); assert.equal((await h({ method: "GET", operation: "collection" })).status, 405) })
await test("HTTP exposes schema blocker safely", async () => { const h = createProductP2Http(createProductP2Service({ authenticate: auth(A), rpc: db().rpc })); const result = await h({ ...request, method: "POST", operation: "collection", body: { collection: "favorites", operation: "list" } }); assert.deepEqual([result.status, result.body.error], [503, "P2_SCHEMA_NOT_APPLIED"]) })
await test("P2 proposal remains outside migrations and rollback-only", async () => { const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../docs/proposals/P2_STORAGE_PROPOSAL.sql", import.meta.url), "utf8")); assert.match(source, /REVIEW PROPOSAL ONLY/); assert.equal(source.trimEnd().endsWith("rollback;"), true); assert.equal(/service_role.*all|disable row level security|grant all/i.test(source), false) })
console.log(`\n${passed}/${passed} Product P2 tests passed`)
