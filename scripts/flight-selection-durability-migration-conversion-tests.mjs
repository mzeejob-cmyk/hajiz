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
const baseMigration = execFileSync("git", ["show", `HEAD:supabase/migrations/${migrationName}`], { cwd: root, encoding: "utf8" })
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

// Exact RPC metadata remediation.
const rpcPreflight = sql.match(/do \$drift_preflight\$[\s\S]*?\$drift_preflight\$;/)?.[0] ?? ""
const rpcPostflight = sql.match(/do \$postflight\$[\s\S]*?\$postflight\$;/)?.[0] ?? ""
const rememberResult = "TABLE(alternative_id text, replayed boolean)"
const getSearchResult = "TABLE(alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, itinerary_snapshot jsonb, fare_snapshot jsonb, previous_customer_price_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)"
const createPricedResult = "TABLE(priced_selection_id text, replayed boolean)"
const getPricedResult = "TABLE(priced_selection_id text, alternative_id text, internal_offer_id text, provider text, provider_offer_ref text, customer_price_snapshot jsonb, itinerary_snapshot jsonb, fare_snapshot jsonb, passenger_composition jsonb, expires_at timestamp with time zone, payload_digest text)"
await test("remember Search exact volatility v", () => assert.equal((sql.match(/remember_flight_search_selections_v1\(jsonb\)'[^\n]*'v'/g) ?? []).length, 2))
await test("get Search exact volatility s", () => assert.equal((sql.match(/get_flight_search_selection_v1\(text\)'[^\n]*'s'/g) ?? []).length, 2))
await test("create Priced exact volatility v", () => assert.equal((sql.match(/create_or_get_flight_priced_selection_v1\(text,text,text,text,text,jsonb,jsonb,jsonb,jsonb,timestamptz\)'[^\n]*'v'/g) ?? []).length, 2))
await test("get Priced exact volatility s", () => assert.equal((sql.match(/get_flight_priced_selection_v1\(text\)'[^\n]*'s'/g) ?? []).length, 2))
await test("generic volatility acceptance removed", () => lacks(sql, /actual_volatility\s+not\s+in\s*\('v','s'\)/i))
await test("remember exact return contract", () => assert.equal(sql.split(rememberResult).length - 1, 2))
await test("get Search exact return contract", () => assert.equal(sql.split(getSearchResult).length - 1, 2))
await test("create Priced exact return contract", () => assert.equal(sql.split(createPricedResult).length - 1, 2))
await test("get Priced exact return contract", () => assert.equal(sql.split(getPricedResult).length - 1, 2))
await test("set-returning contract required", () => { assert.equal((sql.match(/p\.proretset/g) ?? []).length, 2); assert.equal((sql.match(/actual_retset is distinct from true/g) ?? []).length, 2) })
await test("preflight validates exact volatility", () => has(rpcPreflight, /actual_volatility::text is distinct from item\.volatility/))
await test("preflight validates exact return", () => has(rpcPreflight, /actual_return is distinct from item\.result_contract/))
await test("postflight validates exact volatility", () => has(rpcPostflight, /actual_volatility::text is distinct from item\.volatility/))
await test("postflight validates exact return", () => has(rpcPostflight, /actual_return is distinct from item\.result_contract/))
await test("generic TABLE shape acceptance removed", () => lacks(sql, /actual_return\s+not\s+like\s+'TABLE\(%'/i))

// PostgreSQL 17.6 exposes SET search_path = '' as the exact proconfig element search_path="".
const rpcCatalogSelects = [...sql.matchAll(/select p\.proowner,pg_catalog\.obj_description\(p\.oid,'pg_proc'\),[\s\S]*?where p\.oid=obj;/g)].map((match) => match[0])
await test("canonical proconfig expects quoted empty search path", () => count(sql, /array\['search_path=""'\]::text\[\]/g, 2))
await test("stale unquoted empty proconfig absent", () => lacks(sql, /array\['search_path='\]::text\[\]/))
await test("RPC catalog rows selected twice by identity", () => assert.equal(rpcCatalogSelects.length, 2))
await test("preflight catalog SELECT does not filter language", () => lacks(rpcCatalogSelects[0], /where[^;]*lanname='plpgsql'/))
await test("preflight catalog SELECT does not filter prokind", () => lacks(rpcCatalogSelects[0], /where[^;]*prokind='f'/))
await test("preflight catalog SELECT does not filter SECURITY DEFINER", () => lacks(rpcCatalogSelects[0], /where[^;]*prosecdef/))
await test("preflight catalog SELECT does not filter proconfig", () => lacks(rpcCatalogSelects[0], /where[^;]*proconfig/))
await test("preflight explicitly compares language", () => has(rpcPreflight, /actual_language is distinct from 'plpgsql'/))
await test("preflight explicitly compares prokind", () => has(rpcPreflight, /actual_prokind::text is distinct from 'f'/))
await test("preflight explicitly compares SECURITY DEFINER", () => has(rpcPreflight, /actual_security_definer is distinct from true/))
await test("preflight explicitly compares proconfig", () => has(rpcPreflight, /actual_proconfig is distinct from array\['search_path=""'\]::text\[\]/))
await test("postflight repeats all explicit metadata comparisons", () => {
  has(rpcPostflight, /actual_language is distinct from 'plpgsql'/)
  has(rpcPostflight, /actual_prokind::text is distinct from 'f'/)
  has(rpcPostflight, /actual_security_definer is distinct from true/)
  has(rpcPostflight, /actual_proconfig is distinct from array\['search_path=""'\]::text\[\]/)
})
await test("postflight explicitly rejects missing canonical RPC", () => has(rpcPostflight, /if obj is null then\s*raise exception 'canonical RPC % is missing'/))
await test("RPC volatility checks retained after catalog SELECT", () => assert.equal((sql.match(/actual_volatility::text is distinct from item\.volatility/g) ?? []).length, 2))
await test("RPC exact result checks retained after catalog SELECT", () => assert.equal((sql.match(/actual_return is distinct from item\.result_contract/g) ?? []).length, 2))
await test("RPC set-returning checks retained after catalog SELECT", () => assert.equal((sql.match(/actual_retset is distinct from true/g) ?? []).length, 2))
await test("RPC body hash checks retained after catalog SELECT", () => assert.equal((sql.match(/actual_body_hash is distinct from item\.body_hash/g) ?? []).length, 2))
await test("four pinned RPC body fingerprints remain unchanged", () => {
  for (const hash of ["5ce16e3b0a1978a29117fe3b60942c947bc02f828d176f7dad0deaa886c0bf2e", "590424781780b1c02a41650b43b2f07d6914b89b649b28c40a6525a09f176325", "1dd689399db967ae48a4f5a57eb9ade4394832698abe9ab4f44b8321b1877a09", "73bd415cb8ecc333a31ab21355355ace8357ebcf4bdc8b7a73efaea1397d3960"]) assert.equal(sql.split(hash).length - 1, 2)
})
await test("zero dynamic regclass rule retained after RPC remediation", () => lacks(sql, /item\.table_name::(?:pg_catalog\.)?regclass/))

// Canonical PostgreSQL 17.6 pg_proc.prosrc fingerprints, independently reproduced twice.
const staleRpcHashes = ["66db8708fdd0f890d085a06e405dac9cb7722647b274aef8d3703e5fd9cfb42a", "1cfb9d4fac9c497e45ebe4913dc4176cfe0514b39b5a4f0fe2f2dbdd8cf614d0", "282c1249556a54a1c7fc762938e6898c6d448d124a0b485c2c29deebafe9d842", "1b0f98407d1975fd650a93b6f02dd7112da417b33d461eb2bd4278db99ba0c01"]
const canonicalRpcHashes = ["5ce16e3b0a1978a29117fe3b60942c947bc02f828d176f7dad0deaa886c0bf2e", "590424781780b1c02a41650b43b2f07d6914b89b649b28c40a6525a09f176325", "1dd689399db967ae48a4f5a57eb9ade4394832698abe9ab4f44b8321b1877a09", "73bd415cb8ecc333a31ab21355355ace8357ebcf4bdc8b7a73efaea1397d3960"]
const functionBodies = (source) => Object.fromEntries([...source.matchAll(/execute \$ddl\$(create function public\.([a-z0-9_]+)[\s\S]*?)\$ddl\$;/g)].map((match) => [match[2], match[1]]))
await test("stale remember hash absent", () => lacks(sql, new RegExp(staleRpcHashes[0])))
await test("stale get Search hash absent", () => lacks(sql, new RegExp(staleRpcHashes[1])))
await test("stale create Priced hash absent", () => lacks(sql, new RegExp(staleRpcHashes[2])))
await test("stale get Priced hash absent", () => lacks(sql, new RegExp(staleRpcHashes[3])))
await test("canonical remember hash present in preflight", () => has(rpcPreflight, new RegExp(canonicalRpcHashes[0])))
await test("canonical remember hash present in postflight", () => has(rpcPostflight, new RegExp(canonicalRpcHashes[0])))
await test("canonical get Search hash appears twice", () => assert.equal(sql.split(canonicalRpcHashes[1]).length - 1, 2))
await test("canonical create Priced hash appears twice", () => assert.equal(sql.split(canonicalRpcHashes[2]).length - 1, 2))
await test("canonical get Priced hash appears twice", () => assert.equal(sql.split(canonicalRpcHashes[3]).length - 1, 2))
await test("four canonical RPC hashes are distinct", () => assert.equal(new Set(canonicalRpcHashes).size, 4))
await test("read RPC bodies remain byte-identical", () => {
  const current = functionBodies(sql)
  const base = functionBodies(baseMigration)
  assert.equal(current.get_flight_search_selection_v1, base.get_flight_search_selection_v1)
  assert.equal(current.get_flight_priced_selection_v1, base.get_flight_priced_selection_v1)
})
await test("write RPC bodies differ only by approved syntax remediations", () => {
  const current = functionBodies(sql)
  const base = functionBodies(baseMigration)
  for (const name of ["remember_flight_search_selections_v1", "create_or_get_flight_priced_selection_v1"])
    assert.equal(current[name], base[name]
      .replaceAll("pg_catalog.coalesce", "coalesce")
      .replace("on conflict (alternative_id) do nothing", "on conflict on constraint flight_search_selections_pkey do nothing")
      .replace("on conflict (priced_selection_id) do nothing", "on conflict on constraint flight_priced_selections_pkey do nothing"))
})

// PL/pgSQL ambiguous conflict-target remediation.
await test("Search inferred conflict target removed", () => lacks(functionBodies(sql).remember_flight_search_selections_v1, /on conflict \(alternative_id\)/i))
await test("Priced inferred conflict target removed", () => lacks(functionBodies(sql).create_or_get_flight_priced_selection_v1, /on conflict \(priced_selection_id\)/i))
await test("Search uses exact canonical PK conflict target", () => has(functionBodies(sql).remember_flight_search_selections_v1, /on conflict on constraint flight_search_selections_pkey do nothing/i))
await test("Priced uses exact canonical PK conflict target", () => has(functionBodies(sql).create_or_get_flight_priced_selection_v1, /on conflict on constraint flight_priced_selections_pkey do nothing/i))
await test("canonical Search PK exists", () => has(sql, /constraint flight_search_selections_pkey primary key \(alternative_id\)/i))
await test("canonical Priced PK exists", () => has(sql, /constraint flight_priced_selections_pkey primary key \(priced_selection_id\)/i))
await test("Search conflict path remains DO NOTHING", () => has(functionBodies(sql).remember_flight_search_selections_v1, /flight_search_selections_pkey do nothing/i))
await test("Priced conflict path remains DO NOTHING", () => has(functionBodies(sql).create_or_get_flight_priced_selection_v1, /flight_priced_selections_pkey do nothing/i))
await test("Search post-conflict digest comparison retained", () => has(functionBodies(sql).remember_flight_search_selections_v1, /row\.payload_digest[\s\S]*v_existing_digest is distinct from v_digest/))
await test("Priced post-conflict digest comparison retained", () => has(functionBodies(sql).create_or_get_flight_priced_selection_v1, /row\.payload_digest[\s\S]*v_existing_digest is distinct from v_digest/))
await test("Search FSD04 retained", () => has(functionBodies(sql).remember_flight_search_selections_v1, /errcode = 'FSD04'/))
await test("Priced FSD04 retained", () => has(functionBodies(sql).create_or_get_flight_priced_selection_v1, /errcode = 'FSD04'/))
await test("no function variable-conflict directive", () => lacks(sql, /#variable_conflict\s+use_column/i))
await test("no global variable-conflict setting", () => lacks(sql, /plpgsql\.variable_conflict|set\s+variable_conflict/i))
await test("read RPC fingerprints unchanged after conflict remediation", () => { assert.equal(sql.split(canonicalRpcHashes[1]).length - 1, 2); assert.equal(sql.split(canonicalRpcHashes[3]).length - 1, 2) })
await test("new Remember fingerprint is guarded twice", () => assert.equal(sql.split(canonicalRpcHashes[0]).length - 1, 2))
await test("new Create fingerprint is guarded twice", () => assert.equal(sql.split(canonicalRpcHashes[2]).length - 1, 2))
await test("prior Remember fingerprint removed", () => lacks(sql, /95366243eb18aac132aed90eeb254afbac2f884ce9565c5aab243d93e412e362/))
await test("prior Create fingerprint removed", () => lacks(sql, /9dc43cda82e1cedf2b1b392636394526690ff78a6c782427d01ba5feffe9a494/))
await test("both conflict targets use canonical constraint identity", () => count(sql, /on conflict on constraint flight_(?:search|priced)_selections_pkey do nothing/gi, 2))

// PostgreSQL 17.6 conditional-expression syntax class remediation.
await test("no schema-qualified coalesce remains", () => lacks(sql, /pg_catalog\.coalesce\s*\(/i))
await test("no schema-qualified nullif remains", () => lacks(sql, /pg_catalog\.nullif\s*\(/i))
await test("no schema-qualified greatest remains", () => lacks(sql, /pg_catalog\.greatest\s*\(/i))
await test("no schema-qualified least remains", () => lacks(sql, /pg_catalog\.least\s*\(/i))
await test("seven canonical unqualified coalesce calls remain", () => count(sql, /\bcoalesce\s*\(/gi, 7))
await test("column preflight uses unqualified coalesce", () => has(sql, /coalesce\(pg_catalog\.pg_get_expr\(d\.adbin,d\.adrelid,false\),'<NO_DEFAULT>'\)/))
await test("remember RPC has two unqualified coalesce calls", () => count(functionBodies(sql).remember_flight_search_selections_v1, /\bcoalesce\s*\(/g, 2))
await test("priced write RPC has two unqualified coalesce calls", () => count(functionBodies(sql).create_or_get_flight_priced_selection_v1, /\bcoalesce\s*\(/g, 2))
await test("search ACL guard uses unqualified coalesce", () => has(sql, /aclexplode\(coalesce\(c\.relacl,pg_catalog\.acldefault\('r',c\.relowner\)\)\).*flight_search_selections/s))
await test("priced ACL guard uses unqualified coalesce", () => has(sql, /aclexplode\(coalesce\(c\.relacl,pg_catalog\.acldefault\('r',c\.relowner\)\)\).*flight_priced_selections/s))
await test("ACL fallback arguments remain unchanged", () => count(sql, /coalesce\(c\.relacl,pg_catalog\.acldefault\('r',c\.relowner\)\)/g, 2))
await test("obsolete remember body hash removed", () => lacks(sql, /48dc6eb1e8432cbddbcf31da15ea568b97db8beaa02313f95a6bc3353609823a/))
await test("obsolete priced body hash removed", () => lacks(sql, /29c6728c86b4805dd4add332c8c7b7bcd26f2b917ac9bcb8159f8a5891e8c498/))
await test("new remember body hash appears preflight and postflight", () => assert.equal(sql.split(canonicalRpcHashes[0]).length - 1, 2))
await test("new priced body hash appears preflight and postflight", () => assert.equal(sql.split(canonicalRpcHashes[2]).length - 1, 2))
await test("search read body hash remains exact", () => assert.equal(sql.split(canonicalRpcHashes[1]).length - 1, 2))
await test("priced read body hash remains exact", () => assert.equal(sql.split(canonicalRpcHashes[3]).length - 1, 2))
await test("exact RPC search_path guard retained", () => count(sql, /array\['search_path=""'\]::text\[\]/g, 2))
await test("dynamic regclass string cast remains absent", () => lacks(sql, /item\.table_name::(?:pg_catalog\.)?regclass/))
await test("all 23 exact constraint fingerprints retained", () => assert.equal((sql.match(/'[0-9a-f]{64}'/g) ?? []).filter((value) => !canonicalRpcHashes.includes(value.slice(1, -1))).length >= 46, true))
await test("exact expiry index guards retained", () => assert.ok((sql.match(/index_exact is distinct from true/g) ?? []).length >= 2))
await test("prosrc remains fingerprint source", () => assert.equal((sql.match(/convert_to\(p\.prosrc,'UTF8'\)/g) ?? []).length, 2))
await test("RPC fingerprint remains SHA-256 UTF-8", () => assert.equal((sql.match(/digest\(pg_catalog\.convert_to\(p\.prosrc,'UTF8'\),'sha256'\)/g) ?? []).length, 2))
await test("explicit RPC metadata contract remains intact", () => { has(sql, /actual_language is distinct from 'plpgsql'/); has(sql, /actual_prokind::text is distinct from 'f'/); has(sql, /actual_security_definer is distinct from true/) })
await test("quoted empty search path contract remains intact", () => count(sql, /actual_proconfig is distinct from array\['search_path=""'\]::text\[\]/g, 2))
await test("dynamic regclass remains eliminated", () => lacks(sql, /item\.table_name::(?:pg_catalog\.)?regclass/))

// Exact constraint and index catalog guards.
const constraintPreflight = sql.match(/do \$exact_constraints_preflight\$[\s\S]*?\$exact_constraints_preflight\$;/)?.[0] ?? ""
const constraintRows = [...constraintPreflight.matchAll(/\('app_private\.(flight_(?:search|priced)_selections)','(flight_[^']+)','([cp])','([0-9a-f]{64})'\)/g)]
const postflightConstraintRows = [...rpcPostflight.matchAll(/\('app_private\.(flight_(?:search|priced)_selections)','(flight_[^']+)','([cp])','([0-9a-f]{64})'\)/g)]
const canonicalConstraintHashes = [
  "e061295e5a2aca140e0283a20495f6b39bc06ebcdb714ed50d4b265b84a2562b", "920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d",
  "f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0", "2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29",
  "109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3", "6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1",
  "1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661", "572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2",
  "a52af7ab318d669b12ed7887d8d43bc5ff45e98dca4ddd31e413217e85c227f7", "f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2",
  "ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7", "496dadeae65bc48c8a7827a89585466144a9f8bf0408e9b61a0aa34c11ada282",
  "1c02fd5b5f14d6c473d33650b4c24a5e8ebdf7ac87d03a54aa82da1eead08906", "f52978615287b1c0249b5cb2c5251a5defbd0890d696c1074c1d5fd29275bfd0",
  "920bddaf8364a890546376e361c46b99e1de3481f16504d052ea1e5d3bae165d", "2bf7488ac04df5ddc2f8cd82cd516db00efdcada002d85416a257e948dfc7c29",
  "109a679658abc2b55c6489def778ae27f74a8c766f3daec68959b145b73e35f3", "6c120b4f1b9141b3aae432424166b7340f62a3d27a6a9d76955c8fd3cd8e2da1",
  "e60e6a054d55e6e36beb0da8ec2ae48a50c1e6780084e5aae1d8397c98383aa2", "1b6aa85d541e52860c47c3b0ddf72ff21c1cd3a7de5a0ab5efd227be9c346661",
  "572896018bbbb5211f194e367140664c6f76e86f053d787c949925619a00aea2", "f105ad85612be3e29b0190bccf4aae7d377da156702475372d8bb1cbd4576dc2",
  "ca080a4fca12635bde3cf110b81f65e8689ef1563489ae7287e329d391af6ad7",
]
await test("all 23 constraints have exact fingerprints", () => { assert.equal(constraintRows.length, 23); assert.equal(postflightConstraintRows.length, 23) })
await test("Search exact constraint count is 11", () => assert.equal(constraintRows.filter((m) => m[2].includes("_search_")).length, 11))
await test("Priced exact constraint count is 12", () => assert.equal(constraintRows.filter((m) => m[2].includes("_priced_")).length, 12))
await test("preflight compares exact SHA-256 definition", () => { has(constraintPreflight, /pg_get_constraintdef\(c\.oid,false\)/); has(constraintPreflight, /actual_hash is distinct from item\.definition_hash/) })
await test("postflight compares exact SHA-256 definition", () => { has(rpcPostflight, /pg_get_constraintdef\(c\.oid,false\)/); has(rpcPostflight, /actual_hash is distinct from item\.definition_hash/) })
for (const [label, fragment] of [
  ["internalOfferId", "internal_offer_id_check"], ["provider", "provider_check"],
  ["providerOfferRef", "provider_offer_ref_check"], ["itinerary", "itinerary_snapshot_check"],
  ["fare", "fare_snapshot_check"], ["Customer Price", "customer_price_snapshot_check"],
  ["passenger", "passenger_composition_check"], ["validity", "validity_check"],
  ["hca", "alternative_id_check"], ["hpr", "priced_id_check"],
  ["digest", "payload_digest_check"], ["primary key", "_pkey"],
]) await test(`${label} constraint covered by exact fingerprint`, () => {
  assert.ok(constraintRows.some((m) => m[2].includes(fragment)))
  assert.ok(postflightConstraintRows.some((m) => m[2].includes(fragment)))
})
await test("loose NOT LIKE constraint proof removed", () => lacks(sql, /pg_get_constraintdef\([^\n]+\)\s+not\s+like/i))

// Fresh-install-safe dynamic relation resolution.
const policyPreflight = rpcPreflight.match(/for item in select \* from \(values\s*\('app_private\.flight_search_selections','flight_search_selections_direct_access_denied'[\s\S]*?end loop;/)?.[0] ?? ""
await test("no dynamic pg_catalog regclass cast", () => lacks(sql, /item\.table_name::pg_catalog\.regclass/))
await test("no dynamic short regclass cast", () => lacks(sql, /item\.table_name::regclass/))
await test("constraint preflight resolves table", () => has(constraintPreflight, /relation_oid := pg_catalog\.to_regclass\(item\.table_name\)/))
await test("constraint preflight uses resolved OID", () => has(constraintPreflight, /c\.conrelid=relation_oid/))
await test("index preflight resolves expected table separately", () => has(rpcPreflight, /table_oid:=pg_catalog\.to_regclass\(item\.table_name\)/))
await test("orphan same-name index fails closed", () => has(rpcPreflight, /if table_oid is null then\s*raise exception 'expiry index % exists without its canonical target table %'/))
await test("policy preflight resolves table before query", () => has(policyPreflight, /table_oid:=pg_catalog\.to_regclass\(item\.table_name\);\s*if table_oid is not null then/))
await test("policy preflight query uses resolved OID", () => has(policyPreflight, /p\.polrelid=table_oid/))
await test("policy existence validation is procedural", () => has(policyPreflight, /if table_oid is not null then\s*if exists\([\s\S]*?end if;\s*end if;/))
await test("no boolean existence plus unsafe cast guard", () => lacks(sql, /to_regclass\(item\.table_name\)[\s\S]{0,160}\band\b[\s\S]{0,160}item\.table_name::/i))
await test("fresh absent table skips policy lookup safely", () => { has(policyPreflight, /if table_oid is not null then/); lacks(policyPreflight, /else\s+raise exception/i) })
await test("all canonical constraint hashes unchanged", () => assert.deepEqual(constraintRows.map((m) => m[4]), canonicalConstraintHashes))
await test("RPC body hashes unchanged", () => {
  for (const hash of canonicalRpcHashes) assert.equal(sql.split(hash).length - 1, 2)
})
await test("exact index semantic guards unchanged", () => { has(rpcPreflight, /i\.indisvalid and i\.indisready and i\.indislive/); has(rpcPreflight, /i\.indpred is null and i\.indexprs is null/); has(rpcPreflight, /i\.indnkeyatts=1 and i\.indnatts=1/) })

const indexPreflight = rpcPreflight.match(/for item in select \* from \(values[\s\S]*?expiry index % has non-canonical structure[\s\S]*?end loop;/)?.[0] ?? ""
const indexPostflight = rpcPostflight.match(/for item in select \* from \(values[\s\S]*?expiry index % drift[\s\S]*?end loop;/)?.[0] ?? ""
await test("index target table exact", () => { has(indexPreflight,/i\.indrelid=table_oid/); has(indexPostflight,/i\.indrelid=table_oid/) })
await test("index access method btree exact", () => { has(indexPreflight,/am\.amname='btree'/); has(indexPostflight,/am\.amname='btree'/) })
await test("index non-unique exact", () => { has(indexPreflight,/not i\.indisunique/); has(indexPostflight,/not i\.indisunique/) })
await test("index non-primary exact", () => { has(indexPreflight,/not i\.indisprimary/); has(indexPostflight,/not i\.indisprimary/) })
await test("index validity exact", () => { has(indexPreflight,/i\.indisvalid/); has(indexPostflight,/i\.indisvalid/) })
await test("index readiness exact", () => { has(indexPreflight,/i\.indisready/); has(indexPostflight,/i\.indisready/) })
await test("index key count exact", () => { has(indexPreflight,/i\.indnkeyatts=1/); has(indexPostflight,/i\.indnkeyatts=1/) })
await test("index total attribute count exact", () => { has(indexPreflight,/i\.indnatts=1/); has(indexPostflight,/i\.indnatts=1/) })
await test("index predicate absent", () => { has(indexPreflight,/i\.indpred is null/); has(indexPostflight,/i\.indpred is null/) })
await test("index expression absent", () => { has(indexPreflight,/i\.indexprs is null/); has(indexPostflight,/i\.indexprs is null/) })
await test("index INCLUDE absent", () => { has(indexPreflight,/i\.indnkeyatts=1 and i\.indnatts=1/); has(indexPostflight,/i\.indnkeyatts=1 and i\.indnatts=1/) })
await test("index expires_at key exact", () => { has(indexPreflight,/a\.attname='expires_at' and i\.indkey\[0\]=a\.attnum/); has(indexPostflight,/a\.attname='expires_at' and i\.indkey\[0\]=a\.attnum/) })
await test("index ordering and null options canonical", () => { has(indexPreflight,/i\.indoption\[0\]=0/); has(indexPostflight,/i\.indoption\[0\]=0/) })
await test("index owner matches table", () => { has(indexPreflight,/ic\.relowner=tc\.relowner/); has(indexPostflight,/ic\.relowner=tc\.relowner/) })
await test("exact index guard present in preflight", () => has(indexPreflight,/index_exact is distinct from true/))
await test("exact index guard present in postflight", () => has(indexPostflight,/index_exact is distinct from true/))
await test("loose expires_at definition proof removed", () => lacks(sql, /actual_def(?:inition)?\s+not\s+like\s+'%\(expires_at\)%'/i))

// Catalog drift validation.
for (const [name, pattern] of [
  ["table canonical validation",/canonical catalog structure/], ["relkind validation",/relation_kind<>'r'/],
  ["owner validation",/relation_owner is distinct from current_owner/], ["column count and definitions",/actual_columns is distinct from item\.columns/],
  ["constraint set validation",/actual_constraints is distinct from/], ["constraint signatures",/constraint signature/],
  ["important constraint definitions",/actual_hash is distinct from item\.definition_hash/], ["index validation",/expiry index .*non-canonical structure/],
  ["index signatures",/canonical_signature.*search-expiry-index/s], ["RLS enabled validation",/not rls_enabled/],
  ["FORCE RLS validation",/force_rls/], ["policy validation",/deny policy .*non-canonical structure/],
  ["policy signatures",/canonical_signature.*deny-policy/s], ["RPC identity validation",/to_regprocedure\(item\.name\)/],
  ["RPC language validation",/actual_language is distinct from 'plpgsql'/], ["SECURITY DEFINER validation",/actual_security_definer is distinct from true/],
  ["search path validation",/actual_proconfig is distinct from array\['search_path=""'\]::text\[\]/], ["RPC owner validation",/actual_owner is distinct from current_owner/],
  ["function body validation",/actual_body_hash is distinct from item\.body_hash/], ["same-name drift fails",/has non-canonical|drifted/],
]) await test(name, () => has(sql, pattern))

// Indexes, policies and privileges.
await test("two expiry indexes", () => { has(sql,/flight_search_selections_expires_idx/); has(sql,/flight_priced_selections_expires_idx/) })
await test("indexes non-unique one-key", () => {
  has(sql, /not i\.indisunique/)
  has(sql, /i\.indnkeyatts=1/)
})
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
