import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import {
  HAJIZ_PRODUCTION_PROJECT,
  HAJIZ_STAGING_PROJECT,
  getSupabaseProjectForEnvironment,
  validateSupabaseProjectBoundary,
} from "../src/services/contracts/supabaseProjectBoundary.js"
import { resolveMyTripsConfig } from "../src/services/myTripsDataSource.js"
import { createPublicCatalogDataSource } from "../src/services/publicCatalogDataSource.js"
import {
  createProductP2Composition,
  createProductP2StagingComposition,
  HAJIZ_PRODUCTION_PROJECT_REF,
  HAJIZ_PRODUCTION_SUPABASE_URL,
  HAJIZ_STAGING_PROJECT_REF,
  HAJIZ_STAGING_SUPABASE_URL,
} from "../src/server/product/productP2StagingComposition.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`) }
const LEGACY = "ckqxmacpojierkyxmiip"
const ANON = "public-anon-test-value"
const clients = () => ({
  userClient: { auth: { async getUser() { return { data: { user: null }, error: {} } } } },
  serviceClient: { async rpc() { return { data: [], error: null } } },
})

await test("staging accepts exact staging identity", () => {
  assert.equal(validateSupabaseProjectBoundary({ environment: "staging", projectRef: HAJIZ_STAGING_PROJECT.projectRef, supabaseUrl: HAJIZ_STAGING_PROJECT.origin }).origin, HAJIZ_STAGING_PROJECT.origin)
})
await test("production accepts exact production identity", () => {
  assert.equal(validateSupabaseProjectBoundary({ environment: "production", projectRef: HAJIZ_PRODUCTION_PROJECT.projectRef, supabaseUrl: HAJIZ_PRODUCTION_PROJECT.origin }).origin, HAJIZ_PRODUCTION_PROJECT.origin)
})
await test("development and test are explicitly limited to staging", () => {
  for (const environment of ["development", "test"]) {
    assert.equal(getSupabaseProjectForEnvironment(environment), HAJIZ_STAGING_PROJECT)
    assert.throws(() => validateSupabaseProjectBoundary({ environment, projectRef: HAJIZ_PRODUCTION_PROJECT.projectRef, supabaseUrl: HAJIZ_PRODUCTION_PROJECT.origin }), /BOUNDARY_REJECTED/)
  }
})
await test("cross-environment combinations reject", () => {
  assert.throws(() => validateSupabaseProjectBoundary({ environment: "staging", projectRef: HAJIZ_PRODUCTION_PROJECT.projectRef, supabaseUrl: HAJIZ_PRODUCTION_PROJECT.origin }), /BOUNDARY_REJECTED/)
  assert.throws(() => validateSupabaseProjectBoundary({ environment: "production", projectRef: HAJIZ_STAGING_PROJECT.projectRef, supabaseUrl: HAJIZ_STAGING_PROJECT.origin }), /BOUNDARY_REJECTED/)
})
await test("legacy and unknown environments reject", () => {
  assert.throws(() => validateSupabaseProjectBoundary({ environment: "staging", projectRef: LEGACY, supabaseUrl: `https://${LEGACY}.supabase.co` }), /BOUNDARY_REJECTED/)
  for (const environment of [undefined, "", "legacy", "preview"]) assert.throws(() => getSupabaseProjectForEnvironment(environment), /BOUNDARY_REJECTED/)
})
await test("malformed protocol port path query hash and credentials reject", () => {
  const ref = HAJIZ_STAGING_PROJECT.projectRef
  for (const supabaseUrl of [
    `http://${ref}.supabase.co`, `ftp://${ref}.supabase.co`, `https://${ref}.supabase.co:444`,
    `https://${ref}.supabase.co/rest`, `https://${ref}.supabase.co?x=1`, `https://${ref}.supabase.co#x`,
    `https://user:pass@${ref}.supabase.co`, "not-a-url",
  ]) assert.throws(() => validateSupabaseProjectBoundary({ environment: "staging", projectRef: ref, supabaseUrl }), /BOUNDARY_REJECTED/)
})
await test("P2 staging compatibility path and exact production path work", () => {
  createProductP2StagingComposition({ environment: "staging", projectRef: HAJIZ_STAGING_PROJECT_REF, supabaseUrl: HAJIZ_STAGING_SUPABASE_URL, ...clients() })
  createProductP2Composition({ environment: "production", projectRef: HAJIZ_PRODUCTION_PROJECT_REF, supabaseUrl: HAJIZ_PRODUCTION_SUPABASE_URL, ...clients() })
})
await test("P2 composition rejects cross-environment and shared clients", () => {
  assert.throws(() => createProductP2Composition({ environment: "production", projectRef: HAJIZ_STAGING_PROJECT_REF, supabaseUrl: HAJIZ_STAGING_SUPABASE_URL, ...clients() }), /PROJECT_BOUNDARY/)
  const client = { auth: {}, rpc() {} }
  assert.throws(() => createProductP2Composition({ environment: "production", projectRef: HAJIZ_PRODUCTION_PROJECT_REF, supabaseUrl: HAJIZ_PRODUCTION_SUPABASE_URL, userClient: client, serviceClient: client }), /CLIENT_SEPARATION/)
})
await test("My Trips accepts only matching reviewed environment", () => {
  assert.equal(resolveMyTripsConfig({ VITE_APP_ENV: "production", VITE_SUPABASE_URL: HAJIZ_PRODUCTION_PROJECT.origin, VITE_SUPABASE_ANON_KEY: ANON }).projectRef, HAJIZ_PRODUCTION_PROJECT.projectRef)
  assert.equal(resolveMyTripsConfig({ VITE_APP_ENV: "staging", VITE_SUPABASE_URL: HAJIZ_STAGING_PROJECT.origin, VITE_SUPABASE_ANON_KEY: ANON }).projectRef, HAJIZ_STAGING_PROJECT.projectRef)
  assert.throws(() => resolveMyTripsConfig({ VITE_APP_ENV: "production", VITE_SUPABASE_URL: HAJIZ_STAGING_PROJECT.origin, VITE_SUPABASE_ANON_KEY: ANON }), /BOUNDARY_REJECTED/)
  assert.throws(() => resolveMyTripsConfig({ VITE_APP_ENV: "staging", VITE_SUPABASE_URL: HAJIZ_PRODUCTION_PROJECT.origin, VITE_SUPABASE_ANON_KEY: ANON }), /BOUNDARY_REJECTED/)
})
await test("Public Catalog derives production endpoint only after validation", async () => {
  const calls = []
  const source = createPublicCatalogDataSource({ appEnv: "production", supabaseUrl: HAJIZ_PRODUCTION_PROJECT.origin, fetchImpl: async (...args) => { calls.push(args); return { ok: true, async json() { return [] } } } })
  await source.loadPackages()
  assert.equal(calls[0][0], `${HAJIZ_PRODUCTION_PROJECT.origin}/functions/v1/catalog-public`)
  assert.throws(() => createPublicCatalogDataSource({ appEnv: "production", supabaseUrl: HAJIZ_STAGING_PROJECT.origin, fetchImpl: async () => ({}) }), /NOT_CONFIGURED/)
})
await test("Edge source requires explicit non-secret environment and reviewed URL", async () => {
  const source = await readFile(new URL("../supabase/functions/product-p2/index.ts", import.meta.url), "utf8")
  for (const name of ["HAJIZ_APP_ENV", "HAJIZ_SUPABASE_URL", "SUPABASE_URL"]) assert.ok(source.includes(name), name)
  assert.match(source, /runtimeUrl !== reviewedUrl/)
  assert.doesNotMatch(source, /environment:\s*["']staging["']/)
})
await test("browser-facing sources contain no private secret or legacy project", async () => {
  const files = ["../src/services/myTripsDataSource.js", "../src/services/publicCatalogDataSource.js", "../src/services/contracts/supabaseProjectBoundary.js"]
  const source = (await Promise.all(files.map(file => readFile(new URL(file, import.meta.url), "utf8")))).join("\n")
  assert.doesNotMatch(source, /service[_-]?role|SUPABASE_SECRET|SUPABASE_SERVICE|ckqxmacpojierkyxmiip/i)
})
await test("active V2 runtime has no legacy project dependency", async () => {
  const roots = [new URL("../src/app/", import.meta.url), new URL("../src/features/", import.meta.url), new URL("../src/server/", import.meta.url), new URL("../src/services/", import.meta.url)]
  for (const root of roots) for (const file of await readdir(root, { recursive: true })) if (/\.(?:js|jsx|ts|tsx)$/.test(file)) assert.equal((await readFile(new URL(file, root), "utf8")).includes(LEGACY), false, file)
})

console.log(`\n${passed}/${passed} Supabase project boundary tests passed`)
