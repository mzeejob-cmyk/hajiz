// Server composition only. rpc is a service-role Supabase RPC adapter;
// authenticate must verify the current Supabase user, not decode unverified claims.
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function gate(ok, code) { if (!ok) throw new Error(code) }
function fields(input, allowed) {
  gate(input && [Object.prototype, null].includes(Object.getPrototypeOf(input)), "INPUT_INVALID")
  gate(Object.keys(input).every(k => allowed.includes(k)), "CLIENT_AUTHORITY_FORBIDDEN")
}
function text(value, max) { gate(typeof value === "string" && value.length > 0 && value.length <= max && !/[\p{Cc}]/u.test(value), "INPUT_INVALID"); return value }
const own = row => ({ id: row.id, ...row.data })
const collections = Object.freeze({
  travelers: { table: "p2_saved_travelers", fields: ["firstName", "lastName"], validate(data) { fields(data, this.fields); return { firstName: text(data.firstName, 80), lastName: text(data.lastName, 80) } } },
  favorites: { table: "p2_favorites", fields: ["kind", "canonicalId"], validate(data) { fields(data, this.fields); gate(["hotel", "package", "offer"].includes(data.kind), "INPUT_INVALID"); gate(/^[a-zA-Z0-9_-]{1,128}$/.test(data.canonicalId), "INPUT_INVALID"); return { kind: data.kind, canonicalId: data.canonicalId } } },
  preferences: { table: "p2_preferences", fields: ["locale"], validate(data) { fields(data, this.fields); gate(["ar", "en"].includes(data.locale), "INPUT_INVALID"); return { locale: data.locale } } },
})
export function createP2SupabaseAuthenticator(client) {
  return async request => {
    const header = request.headers?.authorization
    gate(typeof header === "string" && /^Bearer \S+$/.test(header), "AUTH_REQUIRED")
    const result = await client.auth.getUser(header.slice(7))
    gate(!result.error && uuid(result.data?.user?.id), "AUTH_REQUIRED")
    return { userId: result.data.user.id }
  }
}
export function createP2RpcAdapter(client) {
  return async (name, parameters) => {
    const result = await client.rpc(name, parameters)
    if (result.error) throw new Error("P2_PERSISTENCE_UNAVAILABLE")
    return result.data
  }
}
export function createProductP2Service({ authenticate, rpc, schemaReady = false, artifactReader = null }) {
  async function user(request) { const identity = await authenticate(request); gate(uuid(identity?.userId), "AUTH_REQUIRED"); return identity.userId }
  function prepared() { gate(schemaReady === true, "P2_SCHEMA_NOT_APPLIED") }
  async function call(name, parameters) { gate(typeof rpc === "function", "P2_RPC_ADAPTER_REQUIRED"); return rpc(name, parameters) }
  return Object.freeze({
    async collection(request, input) {
      const id = await user(request)
      fields(input, ["collection", "operation", "id", "data"])
      gate(Object.hasOwn(collections, input.collection), "COLLECTION_INVALID")
      gate(["list", "save", "delete"].includes(input.operation), "OPERATION_INVALID")
      const config = collections[input.collection]
      const data = input.operation === "save" ? config.validate(input.data) : null
      if (input.operation !== "list") gate(uuid(input.id), "RECORD_ID_REQUIRED")
      prepared()
      const value = await call("p2_collection_v1", { p_owner_id: id, p_collection: input.collection, p_operation: input.operation, p_record_id: input.id ?? null, p_data: data })
      if (input.operation === "delete") return { deleted: value?.deleted === true }
      const rows = Array.isArray(value) ? value : [value]
      const projected = rows.filter(Boolean).map(row => own({ id: row.id, data: config.validate(row.data) }))
      return input.operation === "list" ? projected : projected[0]
    },
    async adminReads(request, input) {
      const id = await user(request); fields(input, []); prepared()
      const result = await call("get_p2_admin_payments_v1", { p_actor_id: id })
      return result.map(r => ({ bookingReference: r.booking_ref, bookingState: r.booking_status, paymentState: r.payment_status, method: r.method, amount: r.amount, currency: r.currency }))
    },
    async partner(request, input) {
      const id = await user(request); fields(input, []); prepared()
      const value = await call("get_p2_partner_v1", { p_owner_id: id })
      gate(value?.owner_id === id, "PARTNER_NOT_FOUND")
      const project = r => ({ id: r.id, currency: r.currency, amount: r.amount, state: r.state })
      return { kycState: value.kyc_state, commissions: value.commissions.map(project), payouts: value.payouts.map(project), payoutExecutionAllowed: false, availableCommission: null, walletBalance: null }
    },
    async catalog(request, input) {
      const id = await user(request)
      fields(input, ["operation", "id", "type", "title", "summary", "expectedVersion"])
      gate(["published", "drafts", "save", "publish"].includes(input.operation), "OPERATION_INVALID")
      prepared()
      if (["published", "drafts"].includes(input.operation)) {
        const result = await call("p2_catalog_v1", { p_actor_id: id, p_operation: input.operation, p_record_id: null, p_type: null, p_title: null, p_summary: null, p_expected_version: null })
        return result.map(r => ({ id: r.id, type: r.type, title: r.title, summary: r.summary, state: r.state, version: r.version, dynamicBuilder: false, supplierAvailability: null }))
      }
      gate(uuid(input.id), "RECORD_ID_REQUIRED")
      gate(Number.isSafeInteger(input.expectedVersion) && input.expectedVersion >= 0, "EXPECTED_VERSION_REQUIRED")
      if (input.operation === "save") {
        gate(["package", "offer"].includes(input.type), "CATALOG_TYPE_INVALID")
        const title = text(input.title, 120), summary = text(input.summary, 1000)
        return call("p2_catalog_v1", { p_actor_id: id, p_operation: "save", p_record_id: input.id, p_type: input.type, p_title: title, p_summary: summary, p_expected_version: input.expectedVersion })
      }
      return call("p2_catalog_v1", { p_actor_id: id, p_operation: "publish", p_record_id: input.id, p_type: null, p_title: null, p_summary: null, p_expected_version: input.expectedVersion })
    },
    async artifact(request, input) {
      const id = await user(request); fields(input, ["ticketId"]); gate(uuid(input.ticketId), "TICKET_ID_INVALID")
      const row = await call("get_p2_ticket_artifact_authority_v1", { p_owner_id: id, p_ticket_id: input.ticketId })
      gate(row?.owner_id === id, "ARTIFACT_UNAVAILABLE")
      // Registry resolves a trusted reference to private bytes; no URL or key from client.
      gate(artifactReader, "ARTIFACT_PROVIDER_NOT_CONFIGURED")
      gate(/^[a-f0-9]{64}$/.test(row.artifact_digest) && row.artifact_media_type === "application/pdf", "ARTIFACT_INVALID")
      const bytes = await artifactReader.readTrustedPrivateArtifact(row.artifact_ref)
      const { createHash } = await import("node:crypto")
      gate(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= 10000000, "ARTIFACT_INVALID")
      gate(createHash("sha256").update(bytes).digest("hex") === row.artifact_digest, "ARTIFACT_DIGEST_MISMATCH")
      gate((await user(request)) === id, "AUTH_CHANGED")
      return { bytes, contentType: "application/pdf", filename: "ticket.pdf", cacheControl: "no-store" }
    },
  })
}

// Internal event producer only; deliberately absent from the browser dispatcher.
export function createNotificationOutbox({ rpc, schemaReady = false }) {
  return Object.freeze({
    async enqueue(event) {
      fields(event, ["eventId", "bookingId", "type", "sourceEventId"])
      gate(uuid(event.eventId) && uuid(event.bookingId), "EVENT_ID_INVALID")
      gate(["payment_pending", "payment_confirmed", "supplier_confirmed", "ticket_issued", "failed_reconciliation"].includes(event.type), "EVENT_TYPE_INVALID")
      if (event.type === "failed_reconciliation") gate(uuid(event.sourceEventId), "SOURCE_EVENT_REQUIRED")
      else gate(event.sourceEventId === undefined, "SOURCE_EVENT_FORBIDDEN")
      gate(schemaReady, "P2_SCHEMA_NOT_APPLIED")
      gate(typeof rpc === "function", "P2_RPC_ADAPTER_REQUIRED")
      const value = await rpc("enqueue_p2_notification_v1", { p_event_id: event.eventId, p_booking_id: event.bookingId, p_event_type: event.type, p_source_event_id: event.sourceEventId ?? null })
      return { state: value.state, delivered: false, replayed: value.replayed === true }
    },
    async deliver() { throw new Error("NOTIFICATION_PROVIDER_NOT_CONFIGURED") },
  })
}
