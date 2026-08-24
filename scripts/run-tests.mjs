import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createServer } from "vite"
import { renderToStaticMarkup } from "react-dom/server"
import React from "react"
import { MemoryRouter } from "react-router-dom"

let passed = 0
const test = async (name, fn) => { await fn(); passed += 1; process.stdout.write(`✓ ${name}\n`) }
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" })
try {
  const { ROUTE_MANIFEST } = await vite.ssrLoadModule("/src/app/router/routeManifest.js")
  const { V1_SERVICE_IDS } = await vite.ssrLoadModule("/src/services/contracts/navigation.js")
  const { AppShell } = await vite.ssrLoadModule("/src/app/layouts/AppShell.jsx")
  const { default: HomePage } = await vite.ssrLoadModule("/src/features/home/HomePage.jsx")
  const { buildSearchTarget } = await vite.ssrLoadModule("/src/features/home/data/searchTarget.js")
  await test("route manifest contains every required V1 route", () => assert.deepEqual(ROUTE_MANIFEST.map(route => route.path), ["/", "/flights", "/hotels", "/insurance", "/packages", "/offers", "/checkout/*", "/bookings/:reference", "/account/*", "/partners/*", "/admin/*"]))
  await test("V1 scope excludes Visa and Ferries", () => { const scope = [...V1_SERVICE_IDS, ...ROUTE_MANIFEST.map(route => route.path)].join(" ").toLowerCase(); assert.equal(scope.includes("visa"), false); assert.equal(scope.includes("ferr"), false) })
  const shell = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AppShell, null, React.createElement("p", null, "shell-test"))))
  await test("shell renders global landmarks", () => { assert.match(shell, /<header/); assert.match(shell, /<main/); assert.match(shell, /<footer/); assert.match(shell, /shell-test/) })
  await test("mobile navigation is accessible and collapsible", () => { assert.match(shell, /aria-controls="mobile-navigation"/); assert.match(shell, /aria-expanded="false"/); assert.match(shell, /id="mobile-navigation"/) })
  const home = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(HomePage)))
  await test("Home search has exactly the four approved service tabs", () => { const tabs = [...home.matchAll(/data-service="([^"]+)"/g)].map(match => match[1]); assert.deepEqual(tabs, ["flights", "hotels", "insurance", "packages"]); assert.equal(tabs.includes("offers"), false) })
  await test("Offers is a section rather than a search tab", () => { assert.match(home, /عروض مختارة/); assert.match(home, /عرض رحلة مختار/); assert.equal(/data-service="offers"/.test(home), false) })
  await test("Home excludes Visa and Ferries", () => assert.equal(/تأشير|عبّار|بواخر|ferr|visa/i.test(home), false))
  await test("Home renders approved discovery and CTA sections", () => { for (const content of ["وجهات ورحلات شائعة", "دبي ← الخرطوم", "استكشف الإقامة", "عرض الفنادق", "باقات جاهزة", "أيام القاهرة", "تأمين السفر", "قارن التأمين", "حاجز للشركاء", "اكتشف الشراكة"]) assert.match(home, new RegExp(content)) })
  await test("unapproved trust and support narrative is absent", () => { assert.equal(/لماذا حاجز|رفيقك في كل خطوة|هل تحتاج مساعدة/.test(home), false) })
  await test("Home search creates safe synthetic navigation targets", () => { assert.equal(buildSearchTarget("flights", { from: "KRT", to: "JED", departure: "" }), "/flights?from=KRT&to=JED"); assert.equal(buildSearchTarget("insurance", {}), "/insurance") })
  await test("Home mobile form markup has labels and touch controls", () => { assert.match(home, /aria-label="البحث عن خدمات السفر"/); assert.match(home, /role="tablist"/); assert.match(home, /aria-label="تبديل نقطة المغادرة والوصول"/); assert.match(home, /type="submit"/) })
  await test("active Home implementation has no legacy or Supabase imports", async () => { const files = ["HomePage.jsx", "components/HeroSection.jsx", "components/HomeSearch.jsx", "components/OffersSection.jsx", "components/PopularRoutesSection.jsx", "components/HotelDestinationsSection.jsx", "components/PackagesSection.jsx", "components/HomeCTA.jsx"]; for (const file of files) { const source = await fs.readFile(new URL(`../src/features/home/${file}`, import.meta.url), "utf8"); assert.equal(/src\/legacy|supabase/i.test(source), false) } })
  await test("document is Arabic-first RTL", async () => { const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8"); assert.match(html, /<html lang="ar" dir="rtl">/) })
  process.stdout.write(`\n${passed} tests passed\n`)
} finally { await vite.close() }
