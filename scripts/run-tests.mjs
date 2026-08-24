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
  await test("route manifest contains every required V1 route", () => assert.deepEqual(ROUTE_MANIFEST.map(route => route.path), ["/", "/flights", "/hotels", "/insurance", "/packages", "/offers", "/checkout/*", "/bookings/:reference", "/account/*", "/partners/*", "/admin/*"]))
  await test("V1 scope excludes Visa and Ferries", () => { const scope = [...V1_SERVICE_IDS, ...ROUTE_MANIFEST.map(route => route.path)].join(" ").toLowerCase(); assert.equal(scope.includes("visa"), false); assert.equal(scope.includes("ferr"), false) })
  const shell = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AppShell, null, React.createElement("p", null, "shell-test"))))
  await test("shell renders global landmarks", () => { assert.match(shell, /<header/); assert.match(shell, /<main/); assert.match(shell, /<footer/); assert.match(shell, /shell-test/) })
  await test("mobile navigation is accessible and collapsible", () => { assert.match(shell, /aria-controls="mobile-navigation"/); assert.match(shell, /aria-expanded="false"/); assert.match(shell, /id="mobile-navigation"/) })
  await test("document is Arabic-first RTL", async () => { const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8"); assert.match(html, /<html lang="ar" dir="rtl">/) })
  process.stdout.write(`\n${passed} tests passed\n`)
} finally { await vite.close() }
