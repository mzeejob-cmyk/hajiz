import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { catalogFavoritesReducer, EMPTY_FAVORITES_STATE, favoriteItemKey, findCatalogFavorite, visibleFavoritesState } from "../src/features/catalog/data/catalogFavoritesState.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const PACKAGE = "11111111-1111-4111-8111-111111111111"
const OFFER = "22222222-2222-4222-8222-222222222222"
const FAVORITE = "33333333-3333-4333-8333-333333333333"
const session = ownerId => ({ status: "signed_in", user: { id: ownerId } })
const owner = (ownerId, generation = 1) => catalogFavoritesReducer(EMPTY_FAVORITES_STATE, { type: "owner", ownerId, generation })
const ready = (ownerId = A, generation = 1, rows = []) => catalogFavoritesReducer(owner(ownerId, generation), { type: "load_success", ownerId, generation, rows })
const savedPackage = { id: FAVORITE, kind: "package", canonicalId: PACKAGE }

await test("item identity includes kind", () => assert.equal(favoriteItemKey("package", PACKAGE), `package:${PACKAGE}`))
await test("package match uses kind and canonicalId", () => assert.equal(findCatalogFavorite([savedPackage], "package", PACKAGE), savedPackage))
await test("different canonicalId does not match", () => assert.equal(findCatalogFavorite([savedPackage], "package", OFFER), null))
await test("same ID different kind does not match", () => assert.equal(findCatalogFavorite([savedPackage], "offer", PACKAGE), null))
await test("empty rows have no match", () => assert.equal(findCatalogFavorite([], "package", PACKAGE), null))
await test("signed-in exact owner state visible", () => assert.ok(visibleFavoritesState(ready(), session(A))))
await test("different owner state masked", () => assert.equal(visibleFavoritesState(ready(), session(B)), null))
await test("signed-out state masked", () => assert.equal(visibleFavoritesState(ready(), { status: "signed_out", user: null }), null))
await test("checking state masked", () => assert.equal(visibleFavoritesState(ready(), { status: "checking", user: null }), null))
await test("auth error state masked", () => assert.equal(visibleFavoritesState(ready(), { status: "error", user: null }), null))

await test("new owner begins loading", () => assert.equal(owner(A).status, "loading"))
await test("new owner starts with no rows", () => assert.deepEqual(owner(A).rows, []))
await test("signed-out owner is idle", () => assert.equal(owner(null).status, "idle"))
await test("owner generation retained", () => assert.equal(owner(A, 7).generation, 7))
await test("A to signed-out masks rows immediately", () => assert.deepEqual(catalogFavoritesReducer(ready(A, 1, [savedPackage]), { type: "owner", ownerId: null, generation: 2 }).rows, []))
await test("A to B masks rows immediately", () => { const state = catalogFavoritesReducer(ready(A, 1, [savedPackage]), { type: "owner", ownerId: B, generation: 2 }); assert.equal(state.ownerId, B); assert.deepEqual(state.rows, []) })
await test("B starts clean loading", () => assert.equal(catalogFavoritesReducer(ready(A, 1, [savedPackage]), { type: "owner", ownerId: B, generation: 2 }).status, "loading"))
await test("late A read ignored after B", () => { const state = owner(B, 2); assert.equal(catalogFavoritesReducer(state, { type: "load_success", ownerId: A, generation: 1, rows: [savedPackage] }), state) })
await test("stale A retry ignored", () => { const state = owner(B, 3); assert.equal(catalogFavoritesReducer(state, { type: "load_success", ownerId: A, generation: 2, rows: [savedPackage] }), state) })
await test("older same-owner read ignored", () => { const state = owner(A, 4); assert.equal(catalogFavoritesReducer(state, { type: "load_success", ownerId: A, generation: 3, rows: [savedPackage] }), state) })
await test("current read accepted", () => assert.deepEqual(ready(A, 1, [savedPackage]).rows, [savedPackage]))
await test("read error is generic", () => assert.equal(catalogFavoritesReducer(owner(A), { type: "load_error", ownerId: A, generation: 1 }).error, "تعذر تحميل حالة المفضلة."))
await test("read error removes unknown rows", () => assert.deepEqual(catalogFavoritesReducer(owner(A), { type: "load_error", ownerId: A, generation: 1 }).rows, []))

const started = catalogFavoritesReducer(ready(), { type: "mutation_start", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:1" })
await test("per-item operation becomes busy", () => assert.equal(started.busy[favoriteItemKey("package", PACKAGE)], "1:1"))
await test("other item remains idle", () => assert.equal(started.busy[favoriteItemKey("offer", OFFER)], undefined))
await test("save success uses authoritative returned row", () => { const next = catalogFavoritesReducer(started, { type: "save_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:1", row: savedPackage }); assert.equal(next.rows[0], savedPackage) })
await test("save success clears item busy", () => { const next = catalogFavoritesReducer(started, { type: "save_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:1", row: savedPackage }); assert.equal(next.busy[favoriteItemKey("package", PACKAGE)], undefined) })
await test("save result from A ignored by B", () => { const b = owner(B, 2); assert.equal(catalogFavoritesReducer(b, { type: "save_success", ownerId: A, generation: 1, itemKey: "x", operationId: "1:1", row: savedPackage }), b) })
await test("save result from old generation ignored", () => { const a = owner(A, 2); assert.equal(catalogFavoritesReducer(a, { type: "save_success", ownerId: A, generation: 1, itemKey: "x", operationId: "1:1", row: savedPackage }), a) })
await test("wrong operation save ignored", () => assert.equal(catalogFavoritesReducer(started, { type: "save_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2", row: savedPackage }), started))
await test("save replaces same kind canonical identity", () => { const old = { ...savedPackage, id: "44444444-4444-4444-8444-444444444444" }; const busy = catalogFavoritesReducer(ready(A, 1, [old]), { type: "mutation_start", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:1" }); assert.deepEqual(catalogFavoritesReducer(busy, { type: "save_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:1", row: savedPackage }).rows, [savedPackage]) })

const existingReady = ready(A, 1, [savedPackage])
const removing = catalogFavoritesReducer(existingReady, { type: "mutation_start", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2" })
await test("delete retains authoritative row before success", () => assert.deepEqual(removing.rows, [savedPackage]))
await test("delete success removes favorite record ID", () => assert.deepEqual(catalogFavoritesReducer(removing, { type: "delete_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2", favoriteId: FAVORITE }).rows, []))
await test("delete success clears item busy", () => assert.deepEqual(catalogFavoritesReducer(removing, { type: "delete_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2", favoriteId: FAVORITE }).busy, {}))
await test("late A delete ignored by B", () => { const b = ready(B, 2, [savedPackage]); assert.equal(catalogFavoritesReducer(b, { type: "delete_success", ownerId: A, generation: 1, itemKey: "x", operationId: "1:2", favoriteId: FAVORITE }), b) })
await test("wrong operation delete ignored", () => assert.equal(catalogFavoritesReducer(removing, { type: "delete_success", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "wrong", favoriteId: FAVORITE }), removing))
await test("mutation error retains saved state", () => assert.deepEqual(catalogFavoritesReducer(removing, { type: "mutation_error", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2" }).rows, [savedPackage]))
await test("mutation error is generic", () => assert.equal(catalogFavoritesReducer(removing, { type: "mutation_error", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2" }).error, "تعذر تحديث المفضلة. حاول مجددًا."))
await test("mutation error clears matching busy", () => assert.deepEqual(catalogFavoritesReducer(removing, { type: "mutation_error", ownerId: A, generation: 1, itemKey: favoriteItemKey("package", PACKAGE), operationId: "1:2" }).busy, {}))
await test("stale mutation error ignored", () => { const b = owner(B, 2); assert.equal(catalogFavoritesReducer(b, { type: "mutation_error", ownerId: A, generation: 1, itemKey: "x", operationId: "1" }), b) })

const read = path => readFile(new URL(path, import.meta.url), "utf8")
const [component, stateSource, catalogSource, accountSource, packages, offers, home, router] = await Promise.all([
  read("../src/features/catalog/components/PublicCatalogCollection.jsx"), read("../src/features/catalog/data/catalogFavoritesState.js"),
  read("../src/services/publicCatalogDataSource.js"), read("../src/services/accountP2DataSource.js"),
  read("../src/features/packages/PackagesPage.jsx"), read("../src/features/offers/OffersPage.jsx"),
  read("../src/features/home/HomePage.jsx"), read("../src/app/router/AppRouter.jsx"),
])
const wiring = component + stateSource
const checks = [
  ["shared catalog component retained", packages + offers, /PublicCatalogCollection/],
  ["packages route remains public", router, /path="packages" element=\{<PackagesPage/],
  ["offers route remains public", router, /path="offers" element=\{<OffersPage/],
  ["existing catalog source reused", component, /publicCatalogDataSource/],
  ["existing Favorites source reused", component, /accountP2DataSource/],
  ["auth session hook reused", component, /useAuthSession/],
  ["signed-out login action", component, /تسجيل الدخول للحفظ/],
  ["login uses router state", component, /state=\{\{ returnTo:/],
  ["return path uses current internal location", component, /location\.pathname \+ location\.search \+ location\.hash/],
  ["Favorites list signed-in gated", component, /if \(!ownerId\) return[\s\S]*listFavorites/],
  ["save exact kind", component, /saveFavorite\(\{ kind: type, canonicalId: row\.id \}\)/],
  ["delete favorite record id", component, /deleteFavorite\(existing\.id\)/],
  ["package and offer identity helper", component, /findCatalogFavorite\(visibleFavorites\.rows, type, row\.id\)/],
  ["per-item busy map", component, /busyOperations\.current\.has\(itemKey\)/],
  ["duplicate action disabled", component, /disabled=\{busy\}/],
  ["authoritative save label", component, /حفظ في المفضلة/],
  ["authoritative remove label", component, /إزالة من المفضلة/],
  ["generic read failure", stateSource, /تعذر تحميل حالة المفضلة/],
  ["generic mutation failure", stateSource, /تعذر تحديث المفضلة/],
  ["Favorites-only retry", component, /setFavoritesAttempt/],
  ["catalog retry retained", component, /setAttempt/],
  ["owner-bound state", stateSource, /state\.ownerId === session\.user\?\.id/],
  ["generation-bound results", stateSource, /state\.generation === action\.generation/],
  ["late mutation token guarded", stateSource, /state\.busy\[action\.itemKey\] === action\.operationId/],
  ["component unmount invalidates", component, /generation\.current \+= 1/],
  ["no optimistic save", component, /await favoritesDataSource\.saveFavorite/],
  ["no optimistic delete", component, /await favoritesDataSource\.deleteFavorite/],
]
for (const [name, source, pattern] of checks) await test(name, () => assert.match(source, pattern))

for (const [name, pattern] of [
  ["no new Supabase client", /createClient|@supabase\/supabase-js/], ["no direct DB", /\.from\s*\(/],
  ["no direct RPC", /\.rpc\s*\(/], ["no service role", /service_role/], ["no localStorage", /localStorage/],
  ["no sessionStorage", /sessionStorage/], ["no owner input", /saveFavorite\(\{[^}]*owner|deleteFavorite\([^)]*owner/], ["no role inference", /admin|partner|finance|kyc/i],
  ["no booking CTA", /احجز|حجز الآن|الدفع|Checkout|Book now/], ["no price authority", /price|currency|inventory|availability/i],
]) await test(name, () => assert.equal(pattern.test(wiring), false, name))
await test("catalog source remains auth-independent", () => assert.equal(/auth|favorite|accountP2/i.test(catalogSource), false))
await test("Account source still owns Favorite ID generation", () => assert.match(accountSource, /saveFavorite\(input\)[\s\S]*recordId\(input\.id\)/))
await test("Account Favorite delete remains functional", () => assert.match(accountSource, /deleteFavorite\(id\)/))
await test("Home does not receive Favorite wiring", () => assert.equal(/favorite|accountP2|useAuthSession/i.test(home), false))
await test("Hotels are not part of wiring", () => assert.equal(/hotel/i.test(wiring), false))
await test("Packages public content retained", () => assert.match(packages, /type="package"/))
await test("Offers public content retained", () => assert.match(offers, /type="offer"/))

assert.ok(passed >= 60)
console.log(`\n${passed}/${passed} Customer Public Catalog Favorites tests passed`)
