import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { joinFavoriteCatalogPresentation, requiredFavoriteCatalogTypes, resolveFavoritePresentation } from "../src/features/account/data/favoriteCatalogPresentation.js"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`) }
const SHARED = "11111111-1111-4111-8111-111111111111"
const PACKAGE_FAVORITE_ID = "22222222-2222-4222-8222-222222222222"
const OFFER_FAVORITE_ID = "33333333-3333-4333-8333-333333333333"
const packageFavorite = { id: PACKAGE_FAVORITE_ID, kind: "package", canonicalId: SHARED }
const offerFavorite = { id: OFFER_FAVORITE_ID, kind: "offer", canonicalId: SHARED }
const hotelFavorite = { id: "44444444-4444-4444-8444-444444444444", kind: "hotel", canonicalId: "hotel_one" }
const packageRow = { id: SHARED, type: "package", title: "باقة الخرطوم", summary: "تفاصيل الباقة المنشورة" }
const offerRow = { id: SHARED, type: "offer", title: "عرض الصيف", summary: "تفاصيل العرض المنشور" }

await test("Package Favorite requires Package Catalog", () => assert.deepEqual(requiredFavoriteCatalogTypes([packageFavorite]), { package: true, offer: false }))
await test("Offer Favorite requires Offer Catalog", () => assert.deepEqual(requiredFavoriteCatalogTypes([offerFavorite]), { package: false, offer: true }))
await test("mixed Favorites require both Catalog types", () => assert.deepEqual(requiredFavoriteCatalogTypes([packageFavorite, offerFavorite]), { package: true, offer: true }))
await test("Hotel Favorite requires no Catalog type", () => assert.deepEqual(requiredFavoriteCatalogTypes([hotelFavorite]), { package: false, offer: false }))
await test("empty Favorites require no Catalog type", () => assert.deepEqual(requiredFavoriteCatalogTypes([]), { package: false, offer: false }))
await test("required type plan is frozen", () => assert.equal(Object.isFrozen(requiredFavoriteCatalogTypes([])), true))

const packagePresentation = resolveFavoritePresentation({ favorite: packageFavorite, packages: [packageRow], offers: [offerRow] })
const offerPresentation = resolveFavoritePresentation({ favorite: offerFavorite, packages: [packageRow], offers: [offerRow] })
await test("Package match uses kind and canonical ID", () => assert.equal(packagePresentation.published, true))
await test("Package type label", () => assert.equal(packagePresentation.label, "باقة"))
await test("Package authoritative title", () => assert.equal(packagePresentation.title, packageRow.title))
await test("Package authoritative summary", () => assert.equal(packagePresentation.summary, packageRow.summary))
await test("Offer match uses kind and canonical ID", () => assert.equal(offerPresentation.published, true))
await test("Offer type label", () => assert.equal(offerPresentation.label, "عرض"))
await test("Offer authoritative title", () => assert.equal(offerPresentation.title, offerRow.title))
await test("Offer authoritative summary", () => assert.equal(offerPresentation.summary, offerRow.summary))
await test("same UUID wrong kind does not match Package", () => assert.equal(resolveFavoritePresentation({ favorite: packageFavorite, packages: [offerRow] }).published, false))
await test("same UUID wrong kind does not match Offer", () => assert.equal(resolveFavoritePresentation({ favorite: offerFavorite, offers: [packageRow] }).published, false))
await test("title matching cannot establish identity", () => assert.equal(resolveFavoritePresentation({ favorite: { ...packageFavorite, canonicalId: "99999999-9999-4999-8999-999999999999" }, packages: [packageRow] }).published, false))

const missingPackage = resolveFavoritePresentation({ favorite: packageFavorite })
const missingOffer = resolveFavoritePresentation({ favorite: offerFavorite })
const hotel = resolveFavoritePresentation({ favorite: hotelFavorite })
await test("missing Package uses safe title", () => assert.equal(missingPackage.title, "باقة محفوظة"))
await test("missing Package uses unpublished fallback", () => assert.equal(missingPackage.summary, "هذا العنصر لم يعد منشورًا حاليًا."))
await test("missing Offer uses safe title", () => assert.equal(missingOffer.title, "عرض محفوظ"))
await test("missing Offer uses unpublished fallback", () => assert.equal(missingOffer.summary, "هذا العنصر لم يعد منشورًا حاليًا."))
await test("missing content remains not published", () => assert.equal(missingPackage.published, false))
await test("loading Catalog does not claim unpublished", () => assert.equal(resolveFavoritePresentation({ favorite: packageFavorite, packageStatus: "loading" }).summary, "جارٍ تحميل تفاصيل العنصر المحفوظ."))
await test("failed Catalog uses unavailable fallback", () => assert.equal(resolveFavoritePresentation({ favorite: offerFavorite, offerStatus: "error" }).summary, "تعذر تحميل تفاصيل هذا العنصر المحفوظ."))
await test("Hotel uses generic label", () => assert.equal(hotel.label, "فندق"))
await test("Hotel uses generic title", () => assert.equal(hotel.title, "فندق محفوظ"))
await test("Hotel does not claim enrichment", () => assert.equal(hotel.published, false))

await test("join is driven by Favorite rows", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite], packages: [packageRow] }).length, 1))
await test("Catalog rows alone cannot create Favorites", () => assert.deepEqual(joinFavoriteCatalogPresentation({ favorites: [], packages: [packageRow], offers: [offerRow] }), []))
await test("deleted Favorite cannot be recreated by late Catalog", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [offerFavorite], packages: [packageRow], offers: [offerRow] })[0].favorite.id, OFFER_FAVORITE_ID))
await test("Favorite deletion handle is retained", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite], packages: [packageRow] })[0].favorite.id, PACKAGE_FAVORITE_ID))
await test("Favorite canonical identity is retained", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite], packages: [packageRow] })[0].favorite.canonicalId, SHARED))
await test("partial Package success enriches Package", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite, offerFavorite], packages: [packageRow], offers: [] })[0].presentation.published, true))
await test("partial Offer failure falls back", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite, offerFavorite], packages: [packageRow], offers: [] })[1].presentation.published, false))
await test("partial Offer success enriches Offer", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite, offerFavorite], packages: [], offers: [offerRow] })[1].presentation.published, true))
await test("partial Package failure falls back", () => assert.equal(joinFavoriteCatalogPresentation({ favorites: [packageFavorite, offerFavorite], packages: [], offers: [offerRow] })[0].presentation.published, false))

const read = path => readFile(new URL(path, import.meta.url), "utf8")
const [component, helper, accountSource, catalogSource, publicComponent, home, hotels, packagesPage, offersPage] = await Promise.all([
  read("../src/features/account/components/AccountOverview.jsx"), read("../src/features/account/data/favoriteCatalogPresentation.js"),
  read("../src/services/accountP2DataSource.js"), read("../src/services/publicCatalogDataSource.js"),
  read("../src/features/catalog/components/PublicCatalogCollection.jsx"), read("../src/features/home/HomePage.jsx"),
  read("../src/features/hotels/HotelsPage.jsx"), read("../src/features/packages/PackagesPage.jsx"), read("../src/features/offers/OffersPage.jsx"),
])
const accountFavorites = component.slice(component.indexOf("export function FavoritesFoundation"))
const wiring = accountFavorites + helper
const checks = [
  ["existing Favorites authoritative read retained", accountFavorites, /dataSource\.listFavorites\(\)/],
  ["existing Preference read retained", accountFavorites, /dataSource\.loadPreference\(\)/],
  ["Package Catalog selectively loaded", accountFavorites, /if \(required\.package\) load\("package", catalogDataSource\.loadPackages\)/],
  ["Offer Catalog selectively loaded", accountFavorites, /if \(required\.offer\) load\("offer", catalogDataSource\.loadOffers\)/],
  ["independent Favorite state", accountFavorites, /favoriteState/],
  ["independent Preference state", accountFavorites, /preferenceState/],
  ["independent Catalog state", accountFavorites, /catalogState/],
  ["Catalog request generation guard", accountFavorites, /version === catalogGeneration\.current/],
  ["confirmed deletion uses Favorite ID", accountFavorites, /deleteFavorite\(favorite\.id\)/],
  ["confirmed deletion removes Favorite row", accountFavorites, /rows\.filter\(row => row\.id !== favorite\.id\)/],
  ["delete remains available independent of Catalog", accountFavorites, /onClick=\{\(\) => remove\(favorite\)\}/],
  ["generic Catalog failure copy", accountFavorites, /تعذر تحميل تفاصيل بعض العناصر المحفوظة/],
  ["unpublished canonical ID remains visible", accountFavorites, /favorite\.canonicalId/],
  ["Preference save retained", accountFavorites, /dataSource\.savePreference\(next\)/],
  ["Account retry retained", accountFavorites, /setRevision\(value => value \+ 1\)/],
  ["existing Account source reused", component, /accountP2DataSource/],
  ["existing public Catalog source reused", component, /publicCatalogDataSource/],
]
for (const [name, source, pattern] of checks) await test(name, () => assert.match(source, pattern))

for (const [name, pattern] of [
  ["no price introduced", /price|currency/i], ["no availability introduced", /availability|inventory/i],
  ["no supplier introduced", /supplier/i], ["no booking authority", /booking|checkout|احجز|الدفع/i],
  ["no new Supabase client", /createClient|@supabase\/supabase-js/], ["no direct DB", /\.from\s*\(/],
  ["no direct RPC", /\.rpc\s*\(/], ["no service role", /service_role/], ["no Catalog write", /savePackage|saveOffer|publishPackage|publishOffer|unpublishPackage|unpublishOffer/],
  ["no browser owner authority", /ownerId|userId/], ["no browser storage", /localStorage|sessionStorage|indexedDB|document\.cookie/],
  ["no token handling", /access_token|refresh_token|Authorization/],
]) await test(name, () => assert.equal(pattern.test(wiring), false, name))

await test("Account P2 contract remains unchanged", () => assert.match(accountSource, /async listFavorites\(\)[\s\S]*async deleteFavorite\(id\)/))
await test("Catalog source remains read only", () => assert.equal(/\.save\s*\(|\.delete\s*\(|\.update\s*\(|\.insert\s*\(|method:\s*"(?:PUT|PATCH|DELETE)"/i.test(catalogSource), false))
await test("Public Catalog component unchanged by Account enrichment", () => assert.match(publicComponent, /PublicCatalogCollection/))
await test("Home remains without Account enrichment", () => assert.equal(/favoriteCatalogPresentation|FavoritesFoundation/.test(home), false))
await test("Hotels remain without Account enrichment", () => assert.equal(/favoriteCatalogPresentation|publicCatalogDataSource/.test(hotels), false))
await test("Packages page retains public Catalog component", () => assert.match(packagesPage, /PublicCatalogCollection type="package"/))
await test("Offers page retains public Catalog component", () => assert.match(offersPage, /PublicCatalogCollection type="offer"/))

assert.ok(passed >= 40)
console.log(`\n${passed}/${passed} Account Favorites Public-Catalog Enrichment tests passed`)
