// Server composition only. query is a trusted parameterized database executor;
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
export function createProductP2Service({ authenticate, query, schemaReady = false, artifactReader = null }) {
  async function user(request) { const identity = await authenticate(request); gate(uuid(identity?.userId), "AUTH_REQUIRED"); return identity.userId }
  function prepared() { gate(schemaReady === true, "P2_SCHEMA_NOT_APPLIED") }
  async function admin(id) {
    const result = await query("select role from public.profiles where id=$1 and role='admin'", [id])
    gate(result.rows.length === 1, "ADMIN_REQUIRED")
  }
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
      // Table interpolation comes only from the closed, server-defined registry.
      if (input.operation === "list") {
        const result = await query(`select id,data from app_private.${config.table} where owner_id=$1 order by id limit 100`, [id])
        return result.rows.map(row => own({ id: row.id, data: config.validate(row.data) }))
      }
      if (input.operation === "delete") {
        const result = await query(`delete from app_private.${config.table} where id=$1 and owner_id=$2 returning id`, [input.id, id])
        gate(result.rows.length === 1, "RECORD_NOT_FOUND"); return { deleted: true }
      }
      const result = await query(`insert into app_private.${config.table}(id,owner_id,data) values($1,$2,$3::jsonb) on conflict(id) do update set data=excluded.data,updated_at=now() where ${config.table}.owner_id=$2 returning id,data`, [input.id, id, JSON.stringify(data)])
      gate(result.rows.length === 1, "RECORD_NOT_FOUND")
      return own({ id: result.rows[0].id, data: config.validate(result.rows[0].data) })
    },
    async adminReads(request, input) {
      const id = await user(request); fields(input, []); await admin(id)
      const result = await query("select b.booking_ref,b.status as booking_status,p.status as payment_status,p.method,p.amount,p.currency from public.payments p join public.bookings b on b.id=p.booking_id where exists(select 1 from public.profiles a where a.id=$1 and a.role='admin') order by p.created_at desc limit 100", [id])
      return result.rows.map(r => ({ bookingReference: r.booking_ref, bookingState: r.booking_status, paymentState: r.payment_status, method: r.method, amount: r.amount, currency: r.currency }))
    },
    async partner(request, input) {
      const id = await user(request); fields(input, []); prepared()
      const identity = await query("select owner_id,kyc_state from app_private.p2_partners where owner_id=$1", [id])
      gate(identity.rows.length === 1 && identity.rows[0].owner_id === id, "PARTNER_NOT_FOUND")
      const commissions = await query("select id,currency,amount,state from app_private.p2_commission_entries where owner_id=$1 order by created_at desc limit 100", [id])
      const payouts = await query("select id,currency,amount,state from app_private.p2_payouts where owner_id=$1 order by created_at desc limit 100", [id])
      const project = r => ({ id: r.id, currency: r.currency, amount: r.amount, state: r.state })
      return { kycState: identity.rows[0].kyc_state, commissions: commissions.rows.map(project), payouts: payouts.rows.map(project), payoutExecutionAllowed: false, availableCommission: null, walletBalance: null }
    },
    async catalog(request, input) {
      const id = await user(request)
      fields(input, ["operation", "id", "type", "title", "summary"])
      gate(["published", "drafts", "save", "publish"].includes(input.operation), "OPERATION_INVALID")
      if (input.operation !== "published") await admin(id)
      prepared()
      if (["published", "drafts"].includes(input.operation)) {
        const state = input.operation === "published" ? "published" : "draft"
        const result = await query("select id,type,title,summary,state from app_private.p2_catalog where state=$1 and ($1='published' or exists(select 1 from public.profiles where id=$2 and role='admin')) order by updated_at desc limit 100", [state, id])
        return result.rows.map(r => ({ id: r.id, type: r.type, title: r.title, summary: r.summary, state: r.state, dynamicBuilder: false, supplierAvailability: null }))
      }
      gate(uuid(input.id), "RECORD_ID_REQUIRED")
      if (input.operation === "save") {
        gate(["package", "offer"].includes(input.type), "CATALOG_TYPE_INVALID")
        const title = text(input.title, 120), summary = text(input.summary, 1000)
        const result = await query("insert into app_private.p2_catalog(id,type,title,summary,state) select $1,$2,$3,$4,'draft' where exists(select 1 from public.profiles where id=$5 and role='admin') on conflict(id) do update set title=excluded.title,summary=excluded.summary,state='draft',updated_at=now() returning id", [input.id, input.type, title, summary, id])
        gate(result.rows.length === 1, "CATALOG_WRITE_DENIED"); return { state: "draft" }
      }
      const result = await query("update app_private.p2_catalog set state='published',updated_at=now() where id=$1 and state='draft' and exists(select 1 from public.profiles where id=$2 and role='admin') returning id", [input.id, id])
      gate(result.rows.length === 1, "CATALOG_PUBLISH_DENIED"); return { state: "published" }
    },
    async artifact(request, input) {
      const id = await user(request); fields(input, ["ticketId"]); gate(uuid(input.ticketId), "TICKET_ID_INVALID")
      const result = await query("select t.id,t.owner_id,t.artifact_ref,t.artifact_digest,t.artifact_media_type from app_private.flight_ticket_records t join app_private.flight_supplier_ticketing_executions e on e.id=t.ticketing_execution_id and e.booking_id=t.booking_id and e.owner_id=t.owner_id join public.bookings b on b.id=t.booking_id and b.user_id=t.owner_id where t.id=$1 and t.owner_id=$2 and b.status='ticketed' and e.execution_state='ISSUED' and not e.reconciliation_required and t.artifact_availability='AVAILABLE'", [input.ticketId, id])
      gate(result.rows.length === 1 && result.rows[0].owner_id === id, "ARTIFACT_UNAVAILABLE")
      // Registry resolves a trusted reference to private bytes; no URL or key from client.
      gate(artifactReader, "ARTIFACT_PROVIDER_NOT_CONFIGURED")
      const row = result.rows[0]
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
export function createNotificationOutbox({ query, schemaReady = false }) {
  return Object.freeze({
    async enqueue(event) {
      fields(event, ["eventId", "bookingId", "type"])
      gate(uuid(event.eventId) && uuid(event.bookingId), "EVENT_ID_INVALID")
      gate(["payment_pending", "payment_confirmed", "supplier_confirmed", "ticket_issued", "failed_reconciliation"].includes(event.type), "EVENT_TYPE_INVALID")
      gate(schemaReady, "P2_SCHEMA_NOT_APPLIED")
      const result = await query("insert into app_private.p2_notification_outbox(event_id,booking_id,recipient_id,event_type,state) select $1,b.id,b.user_id,$3,'NOT_CONFIGURED' from public.bookings b where b.id=$2 on conflict(event_id) do nothing returning event_id", [event.eventId, event.bookingId, event.type])
      if (!result.rows.length) {
        const prior = await query("select event_id from app_private.p2_notification_outbox where event_id=$1 and booking_id=$2 and event_type=$3", [event.eventId, event.bookingId, event.type])
        gate(prior.rows.length === 1, "EVENT_CONFLICT")
      }
      return { state: "NOT_CONFIGURED", delivered: false }
    },
    async deliver() { throw new Error("NOTIFICATION_PROVIDER_NOT_CONFIGURED") },
  })
}
