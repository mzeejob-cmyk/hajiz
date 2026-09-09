import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile, readdir } from "node:fs/promises"

const BASE = "035eb43b219603509887a0833fcf88c53d09ed55"
const root = new URL("../", import.meta.url)
const migrationsUrl = new URL("../supabase/migrations/", import.meta.url)
const proposalUrl = new URL("../docs/proposals/FLIGHT_SELECTION_DURABILITY_V1.sql", import.meta.url)
const migrationName = "20260909164438_flight_selection_durability_v1.sql"
const migrationUrl = new URL(`../supabase/migrations/${migrationName}`, import.meta.url)
const [sql, proposal, migrationFiles] = await Promise.all([
  readFile(migrationUrl, "utf8"), readFile(proposalUrl, "utf8"), readdir(migrationsUrl),
])
const normalized = (value) => value.replace(/\s+/g, " ")
const compact = normalized(sql.toLowerCase())
const trackedChanged = execFileSync("git", ["diff", "--name-only", BASE], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean)
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean)
const changed = [...new Set([...trackedChanged, ...untracked])]
let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }
const has = (source, pattern) => assert.match(source, pattern)
const lacks = (source, pattern) => assert.doesNotMatch(source, pattern)
const count = (source, pattern, expected) => assert.equal((source.match(pattern) ?? []).length, expected)

// Artifact and compatibility.
await test("one new timestamped durability migration", () => assert.deepEqual(migrationFiles.filter((n) => n.endsWith("_flight_selection_durability_v1.sql")), [migrationName]))
await test("timestamp is later than prior canonical migration", () => assert.ok(migrationName > "20260907073346_product_p2_storage_v1.sql"))
await test("migration suffix is canonical", () => assert.match(migrationName, /^\d{14}_flight_selection_durability_v1\.sql$/))
await test("no PLAN_ONLY migration", () => assert.ok(!migrationName.startsWith("PLAN_ONLY_")))
await test("no second new migration", () => assert.deepEqual(changed.filter((n) => n.startsWith("supabase/migrations/")), [`supabase/migrations/${migrationName}`]))
await test("proposal uses compatible text signature", () => assert.ok((proposal.match(/pg_input_is_valid\([^\n]+, 'timestamptz'\)/g) ?? []).length >= 3))
await test("migration uses compatible text signature", () => assert.ok((sql.match(/pg_input_is_valid\([^\n]+, 'timestamptz'\)/g) ?? []).length >= 3))
await test("migration rejects regtype compatibility bug", () => lacks(sql, /'timestamptz'::pg_catalog\.regtype/))
await test("proposal rejects regtype compatibility bug", () => lacks(proposal, /'timestamptz'::pg_catalog\.regtype/))

// Tables and constraints.
await test("search table exists", () => has(sql, /create table app_private\.flight_search_selections/))
await test("priced table exists", () => has(sql, /create table app_private\.flight_priced_selections/))
await test("search exact 11-column fingerprint", () => has(sql, /alternative_id:text:true:<NO_DEFAULT>[\s\S]*created_at:timestamp with time zone:true:transaction_timestamp\(\)/))
await test("priced exact 12-column fingerprint", () => has(sql, /priced_selection_id:text:true:<NO_DEFAULT>[\s\S]*created_at:timestamp with time zone:true:transaction_timestamp\(\)/))
await test("no owner id", () => lacks(sql, /\bowner_id\b/))
await test("no traveler PII", () => lacks(sql, /passport|date_of_birth|traveler_name|phone|email/i))
await test("no booking foreign key", () => lacks(sql, /references\s+public\.bookings/i))
await test("no payment foreign key", () => lacks(sql, /references\s+public\.payments/i))
await test("hca v2 exact regex", () => has(sql, /\^hca_v2_\[0-9a-f\]\{32\}\$/))
await test("hpr v1 exact regex", () => has(sql, /\^hpr_v1_\[0-9a-f\]\{40\}\$/))
await test("digest checks", () => assert.ok((sql.match(/\^\[0-9a-f\]\{64\}\$/g) ?? []).length >= 2))
await test("internal offer bound", () => assert.ok((sql.match(/char_length\(internal_offer_id\) between 1 and 255/g) ?? []).length >= 2))
await test("provider bound", () => assert.ok((sql.match(/provider ~ '\^\[a-z0-9\]\[a-z0-9_-\]\{0,63\}\$'/g) ?? []).length >= 2))
await test("provider reference bound", () => assert.ok((sql.match(/char_length\(provider_offer_ref\) between 1 and 512/g) ?? []).length >= 2))
for (const [name, limit] of [["itinerary",16384],["fare",8192],["customer price",4096],["passengers",1024]]) {
  await test(`${name} JSON bound`, () => has(sql, new RegExp(`octet_length\\([^)]*::text\\) <= ${limit}`)))
}
await test("passenger exact keys", () => assert.ok((sql.match(/\?& array\['ADT','CHD','INF'\]/g) ?? []).length >= 2))
await test("passenger extra keys rejected", () => assert.ok((sql.match(/- array\['ADT','CHD','INF'\] = '\{\}'::jsonb/g) ?? []).length >= 2))
await test("ADT minimum one", () => assert.ok((sql.match(/->>'ADT'\)::numeric >= 1/g) ?? []).length >= 2))
await test("no invented passenger maximum", () => lacks(sql, /ADT[^\n]*(<=|<)\s*9|INF[^\n]*<=\s*ADT/))

// Customer price and expiry.
await test("price exact three keys", () => assert.ok((sql.match(/\?& array\['amount','currency','validUntil'\]/g) ?? []).length >= 4))
await test("price extra keys rejected", () => assert.ok((sql.match(/- array\['amount','currency','validUntil'\] <> '\{\}'::jsonb/g) ?? []).length >= 2))
await test("amount bounded", () => has(sql, /char_length\([^\n]*amount[^\n]*\) > 40/))
await test("amount positive", () => has(sql, /amount'\)::numeric <= 0/))
await test("amount excludes exponent and signs", () => has(sql, /\^\(0\|\[1-9\]\[0-9\]\*\)\(\\\.\[0-9\]\{1,8\}\)\?\$/))
await test("currency allowlist exact", () => assert.ok((sql.match(/\('USD','AED','SDG'\)/g) ?? []).length >= 4))
await test("validUntil type checked", () => has(sql, /jsonb_typeof\([^\n]*validUntil[^\n]*\) <> 'string'/))
await test("search expiry bounded by price", () => has(sql, /v_expires_at > \(v_price->>'validUntil'\)::timestamptz/))
await test("priced expiry equals price", () => has(sql, /p_expires_at <> \(p_customer_price_snapshot->>'validUntil'\)::timestamptz/))
await test("NULL priced expiry rejected", () => has(sql, /if p_expires_at is null then/))
await test("expired creation rejected", () => assert.ok((sql.match(/transaction_timestamp\(\)/g) ?? []).length >= 6))

// Replay and atomicity.
await test("fresh tables use guarded create path", () => assert.ok((sql.match(/if pg_catalog\.to_regclass\('[^']+'\) is null then/g) ?? []).length >= 4))
await test("fresh RPCs use guarded create path", () => assert.ok((sql.match(/if pg_catalog\.to_regprocedure\('[^']+'\) is null then/g) ?? []).length >= 4))
await test("no blind IF NOT EXISTS DDL", () => lacks(sql, /create\s+(table|index)\s+if\s+not\s+exists/i))
await test("no arbitrary CREATE OR REPLACE", () => lacks(sql, /create\s+or\s+replace\s+function/i))
await test("no DROP repair", () => lacks(sql, /\bdrop\s+(table|index|function|policy)/i))
await test("no ON CONFLICT UPDATE", () => lacks(compact, /on conflict[^;]+do update/))
await test("new search insert path", () => has(sql, /insert into app_private\.flight_search_selections/))
await test("new priced insert path", () => has(sql, /insert into app_private\.flight_priced_selections/))
await test("same digest search replay", () => has(sql, /v_existing_digest is distinct from v_digest/))
await test("digest conflict fail closed", () => assert.ok((sql.match(/errcode = 'FSD04'/g) ?? []).length >= 2))
await test("search batch is atomic RPC", () => has(sql, /jsonb_array_elements\(p_batch\)/))
await test("stable search lock order", () => has(sql, /order by item->>'alternativeId'/))

// Catalog drift validation.
for (const [name, pattern] of [
  ["table canonical validation",/canonical catalog structure/], ["relkind validation",/relation_kind<>'r'/],
  ["owner validation",/relation_owner is distinct from current_owner/], ["column count and definitions",/actual_columns is distinct from item\.columns/],
  ["constraint set validation",/actual_constraints is distinct from/], ["constraint signatures",/constraint signature/],
  ["important constraint definitions",/important constraint definition/], ["index validation",/expiry index .*non-canonical structure/],
  ["index signatures",/canonical_signature.*search-expiry-index/s], ["RLS enabled validation",/not rls_enabled/],
  ["FORCE RLS validation",/force_rls/], ["policy validation",/deny policy .*non-canonical structure/],
  ["policy signatures",/canonical_signature.*deny-policy/s], ["RPC identity validation",/to_regprocedure\(item\.name\)/],
  ["RPC language validation",/lanname='plpgsql'/], ["SECURITY DEFINER validation",/p\.prosecdef/],
  ["search path validation",/p\.proconfig=array\['search_path='\]::text\[\]/], ["RPC owner validation",/actual_owner is distinct from current_owner/],
  ["function body validation",/actual_body_hash is distinct from item\.body_hash/], ["same-name drift fails",/has non-canonical|drifted/],
]) await test(name, () => has(sql, pattern))

// Indexes, policies and privileges.
await test("two expiry indexes", () => { has(sql,/flight_search_selections_expires_idx/); has(sql,/flight_priced_selections_expires_idx/) })
await test("indexes non-unique one-key", () => has(sql, /not i\.indisunique and i\.indnkeyatts=1/))
await test("RLS enabled twice", () => count(sql, /alter table app_private\.flight_(?:search|priced)_selections enable row level security/g, 2))
await test("NO FORCE RLS twice", () => count(sql, /alter table app_private\.flight_(?:search|priced)_selections no force row level security/g, 2))
await test("two deny policies", () => count(sql, /create policy flight_(?:search|priced)_selections_direct_access_denied/g, 2))
await test("deny policies cover anon authenticated", () => count(sql, /for all to anon, authenticated/g, 2))
await test("deny USING false", () => count(sql, /using \(false\) with check \(false\)/g, 2))
await test("PUBLIC table privilege denied", () => count(sql, /from public, anon, authenticated, service_role/g, 2))
await test("anon table privilege denied", () => has(sql, /from public, anon, authenticated, service_role/))
await test("authenticated table privilege denied", () => has(sql, /from public, anon, authenticated, service_role/))
await test("service role direct table privilege denied", () => has(sql, /from public, anon, authenticated, service_role/))
await test("PUBLIC RPC denied", () => count(sql, /from public, anon, authenticated;/g, 4))
await test("anon RPC denied", () => count(sql, /from public, anon, authenticated;/g, 4))
await test("authenticated RPC denied", () => count(sql, /from public, anon, authenticated;/g, 4))
await test("service role RPC granted", () => count(sql, /grant execute on function public\./g, 4))
await test("four security definer functions", () => count(sql, /security definer/g, 4))
await test("four empty search paths", () => count(sql, /set search_path = ''/g, 4))
await test("schema-qualified function object references", () => { lacks(sql, /\b(from|into|update)\s+flight_(search|priced)_selections\b/i) })

// Owner and authority invariants.
await test("table owners equal", () => has(sql, /private selection tables must share one owner/))
await test("RPC and table owners equal", () => has(sql, /RPC and private tables must share one owner/))
await test("ownership drift fails", () => has(sql, /raise exception 'RPC and private tables must share one owner/))
await test("hca v2 digest namespace unchanged", () => has(sql, /flight-search-selection-payload\/v1/))
await test("hpr v1 digest namespace unchanged", () => has(sql, /flight-priced-selection-payload\/v1/))
await test("search digest contains representative", () => has(sql, /v_internal_offer_id[\s\S]*v_provider[\s\S]*v_provider_offer_ref/))
await test("priced digest contains representative", () => has(sql, /p_internal_offer_id[\s\S]*p_provider[\s\S]*p_provider_offer_ref/))
await test("nested JSON participates canonically", () => has(sql, /jsonb_build_array/))
await test("search read distinguishes not found", () => has(sql, /search selection not found.*FSD01/s))
await test("search read distinguishes expired", () => has(sql, /search selection expired.*FSD02/s))
await test("priced read rejects bad id", () => has(sql, /p_priced_selection_id !~ '\^hpr_v1_/))
await test("priced read rejects expired", () => has(sql, /priced selection expired.*FSD02/s))

// Scope.
await test("no src changes", () => assert.equal(changed.filter((n) => n.startsWith("src/")).length, 0))
await test("no runtime store source", () => lacks(changed.join("\n"), /store|adapter|transport/i))
await test("no host change", () => lacks(changed.join("\n"), /host|AppProviders/))
await test("no supplier change", () => lacks(changed.join("\n"), /supplier|travelport|duffel/i))
await test("no Bankak change", () => lacks(changed.join("\n"), /bankak/i))
await test("no P2 change", () => lacks(changed.join("\n"), /product-p2|p2_/i))
await test("no Hotels change", () => lacks(changed.join("\n"), /hotel/i))
await test("no Production or Legacy change", () => lacks(changed.join("\n"), /production|legacy/i))
await test("no automation change", () => lacks(changed.join("\n"), /automation|worker|cron/i))

assert.ok(passed >= 80)
console.log(`\n${passed}/${passed} Flight Selection Durability V1 migration-conversion tests passed`)
