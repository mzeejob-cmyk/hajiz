import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 design system and app shell regression suite.
 * Guards the Figma-sourced token values, the primitive contracts, the
 * RTL/LTR foundation, motion safety rules and the accessibility baseline.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")

const [v2Tokens, bridge, typography, motion, primitivesCss, shellCss, dsIndex, shellSource, mainSource, providers] =
  await Promise.all([
    read("../src/design-system/tokens/v2-tokens.css"),
    read("../src/design-system/tokens/tokens.css"),
    read("../src/design-system/typography/typography.css"),
    read("../src/design-system/motion/motion.css"),
    read("../src/design-system/primitives/primitives.css"),
    read("../src/design-system/layout/app-shell-v2.css"),
    read("../src/design-system/index.css"),
    read("../src/app/layouts/AppShell.jsx"),
    read("../src/main.jsx"),
    read("../src/app/providers/AppProviders.jsx"),
  ])

// ---- Tokens: values must equal the Figma variable definitions -------------

const FIGMA_TOKENS = [
  ["--hajiz-v2-navy-900", "#0a1d2f"],
  ["--hajiz-v2-gold-500", "#d4a23a"],
  ["--hajiz-v2-gold-400", "#dfb348"],
  ["--hajiz-v2-neutral-500", "#6b7280"],
  ["--hajiz-v2-neutral-300", "#cdd2d9"],
  ["--hajiz-v2-neutral-200", "#e5e7eb"],
  ["--hajiz-v2-neutral-100", "#f5f6f8"],
  ["--hajiz-v2-color-text-primary", "#0a1d2f"],
  ["--hajiz-v2-color-text-secondary", "#525c6a"],
  ["--hajiz-v2-color-text-inverse", "#ffffff"],
  ["--hajiz-v2-color-text-accent", "#855711"],
  ["--hajiz-v2-color-surface-canvas", "#faf8f3"],
  ["--hajiz-v2-color-surface-primary", "#ffffff"],
  ["--hajiz-v2-color-surface-subtle", "#f5f6f8"],
  ["--hajiz-v2-color-surface-inverse", "#0a1d2f"],
  ["--hajiz-v2-color-surface-success", "#eaf5ef"],
  ["--hajiz-v2-color-surface-warning", "#fff9ec"],
  ["--hajiz-v2-color-action-primary", "#0a1d2f"],
  ["--hajiz-v2-color-action-hover", "#274257"],
  ["--hajiz-v2-color-border-focus", "#476b83"],
  ["--hajiz-v2-color-status-success", "#176448"],
  ["--hajiz-v2-color-status-warning", "#855711"],
  ["--hajiz-v2-color-status-error", "#a42d36"],
  ["--hajiz-v2-color-status-info", "#245d84"],
  ["--hajiz-v2-color-journey-line", "#ebc45f"],
  ["--hajiz-v2-stroke-focus", "2px"],
  ["--hajiz-v2-radius-md", "12px"],
  ["--hajiz-v2-radius-lg", "20px"],
  ["--hajiz-v2-space-1", "4px"],
  ["--hajiz-v2-space-2", "8px"],
  ["--hajiz-v2-space-3", "12px"],
  ["--hajiz-v2-space-4", "16px"],
  ["--hajiz-v2-space-6", "24px"],
  ["--hajiz-v2-space-8", "32px"],
  ["--hajiz-v2-space-12", "48px"],
  ["--hajiz-v2-space-16", "64px"],
]

for (const [token, value] of FIGMA_TOKENS) {
  await test(`token ${token} matches Figma (${value})`, () => {
    assert.match(v2Tokens, new RegExp(`${token}:\\s*${value};`))
  })
}

await test("every space token is a multiple of the 4px grid", () => {
  const spaces = [...v2Tokens.matchAll(/--hajiz-v2-space-\d+:\s*(\d+)px;/g)].map(m => Number(m[1]))
  assert.ok(spaces.length >= 11)
  assert.deepEqual(spaces.filter(value => value % 4 !== 0), [])
})

await test("touch target floor is 48px", () => {
  assert.match(v2Tokens, /--hajiz-v2-touch-target:\s*48px;/)
})

await test("every Task A token category is present", () => {
  for (const marker of [
    "--hajiz-v2-color-border-subtle", "--hajiz-v2-color-disabled-surface",
    "--hajiz-v2-radius-sm", "--hajiz-v2-shadow-md", "--hajiz-v2-shadow-lg",
    "--hajiz-v2-z-sticky", "--hajiz-v2-z-modal", "--hajiz-v2-container-desktop",
    "--hajiz-v2-gutter-mobile", "--hajiz-v2-bp-tablet", "--hajiz-v2-control-height-md",
    "--hajiz-v2-font-arabic", "--hajiz-v2-font-latin",
  ]) assert.ok(v2Tokens.includes(marker), `missing ${marker}`)
})

// ---- Compatibility bridge -------------------------------------------------

await test("legacy token names are preserved, not deleted", () => {
  for (const legacy of ["--hajiz-navy", "--hajiz-gold", "--hajiz-cream", "--hajiz-ink",
    "--hajiz-muted", "--hajiz-border", "--hajiz-focus", "--font-arabic", "--font-latin",
    "--container-max", "--touch-target", "--radius-sm", "--radius-md", "--radius-lg", "--shadow-soft"])
    assert.ok(bridge.includes(`${legacy}:`), `missing ${legacy}`)
})

await test("legacy tokens resolve to V2 values rather than literals", () => {
  const block = bridge.slice(bridge.indexOf("V1 -> V2 compatibility bridge"))
  for (const legacy of ["--hajiz-navy", "--hajiz-gold", "--hajiz-cream", "--hajiz-ink", "--touch-target"])
    assert.match(block, new RegExp(`${legacy}:\\s*var\\(--hajiz-v2-`))
})

await test("v2 tokens are imported before legacy declarations", () => {
  assert.ok(bridge.indexOf('@import "./v2-tokens.css"') < bridge.indexOf("--hajiz-navy:"))
})

await test("design system css loads after index.css so V2 wins by order", () => {
  assert.ok(mainSource.indexOf('import "./index.css"') < mainSource.indexOf('import "./design-system/index.css"'))
})

// ---- Typography -----------------------------------------------------------

await test("Arabic and English ramps both cover display through caption", () => {
  for (const marker of ["--hajiz-v2-ar-display", "--hajiz-v2-ar-h1", "--hajiz-v2-ar-h2",
    "--hajiz-v2-ar-h3", "--hajiz-v2-ar-body", "--hajiz-v2-ar-label", "--hajiz-v2-ar-caption",
    "--hajiz-v2-en-h1", "--hajiz-v2-en-h2", "--hajiz-v2-en-body", "--hajiz-v2-en-label",
    "--hajiz-v2-en-caption"]) assert.ok(typography.includes(marker), `missing ${marker}`)
})

await test("Arabic type styles match the Figma text styles", () => {
  assert.match(typography, /--hajiz-v2-ar-display:\s*700 56px\/72px/)
  assert.match(typography, /--hajiz-v2-ar-h1:\s*700 40px\/56px/)
  assert.match(typography, /--hajiz-v2-ar-h2:\s*700 32px\/44px/)
  assert.match(typography, /--hajiz-v2-ar-h3:\s*700 24px\/36px/)
  assert.match(typography, /--hajiz-v2-ar-body:\s*400 16px\/28px/)
  assert.match(typography, /--hajiz-v2-ar-label:\s*700 14px\/22px/)
})

await test("LTR switches the family to Inter without a separate component", () => {
  assert.match(typography, /\[dir="ltr"\] \.v2-h1/)
  assert.match(typography, /\[dir="ltr"\] \.v2-body/)
})

// ---- RTL / LTR foundation -------------------------------------------------

await test("direction contract exposes Arabic RTL and English LTR", async () => {
  const contract = await import("../src/design-system/direction/directionContract.js")
  assert.equal(contract.DEFAULT_LOCALE, "ar")
  assert.equal(contract.DIRECTION_LOCALES.ar.dir, "rtl")
  assert.equal(contract.DIRECTION_LOCALES.en.dir, "ltr")
  assert.equal(contract.resolveLocale("zz").code, "ar")
  assert.equal(contract.oppositeLocale("ar").code, "en")
  assert.equal(contract.oppositeLocale("en").code, "ar")
})

await test("DirectionProvider is composed into the app providers", () => {
  assert.match(providers, /DirectionProvider/)
})

await test("V2 stylesheets use logical properties, not physical sides", () => {
  for (const [name, css] of [["shell", shellCss], ["primitives", primitivesCss]]) {
    const physical = css.match(/^\s*(margin|padding|border|inset)-(left|right):/gm) ?? []
    assert.deepEqual(physical, [], `${name} uses physical properties: ${physical.join(", ")}`)
  }
})

await test("mobile header order is expressed as flex order, not floats", () => {
  assert.match(shellCss, /\.v2-brand \{ order: 2; margin-inline: auto; \}/)
  assert.ok(!shellCss.includes("float:"))
})

// ---- Motion ---------------------------------------------------------------

await test("motion ladder is 150 / 250 / 350ms", () => {
  assert.match(motion, /--hajiz-v2-duration-connect:\s*150ms;/)
  assert.match(motion, /--hajiz-v2-duration-move:\s*250ms;/)
  assert.match(motion, /--hajiz-v2-duration-arrive:\s*350ms;/)
})

await test("journey keyframes are transcribed from the Figma timeline", () => {
  assert.match(motion, /@keyframes hajiz-v2-node-origin/)
  assert.match(motion, /@keyframes hajiz-v2-line-connect/)
  assert.match(motion, /@keyframes hajiz-v2-node-arrive/)
  assert.match(motion, /--hajiz-v2-duration-journey:\s*2000ms;/)
})

await test("parallax budgets are 12px desktop and 6px mobile", () => {
  assert.match(motion, /--hajiz-v2-parallax-desktop:\s*12px;/)
  assert.match(motion, /--hajiz-v2-parallax-mobile:\s*6px;/)
})

await test("reduced motion resolves to a static composition", () => {
  assert.match(motion, /@media \(prefers-reduced-motion: reduce\)/)
  const block = motion.slice(motion.indexOf("prefers-reduced-motion"))
  assert.match(block, /animation-duration: 0\.001ms !important/)
  assert.match(block, /transition-duration: 0\.001ms !important/)
  assert.match(block, /transform: none !important/)
  assert.match(block, /--hajiz-v2-parallax-desktop:\s*0px/)
})

await test("a hard opt-out exists for protected regions", () => {
  assert.match(motion, /\.v2-no-motion/)
  assert.match(motion, /animation: none !important/)
})

await test("error state opts out of motion by construction", async () => {
  const source = await read("../src/design-system/primitives/ErrorState.jsx")
  assert.match(source, /v2-no-motion/)
  assert.match(source, /role="alert"/)
})

// ---- Primitives -----------------------------------------------------------

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const ds = await vite.ssrLoadModule("/src/design-system/index.js")
const render = element => renderToStaticMarkup(element)

await test("design system barrel exports every required primitive", () => {
  for (const name of ["Button", "IconButton", "TextField", "SelectTrigger", "SearchField",
    "Badge", "StatusBadge", "Card", "Divider", "Section", "Surface", "Spinner", "Skeleton",
    "EmptyState", "ErrorState", "NetworkMark", "Container", "DirectionProvider"])
    assert.equal(typeof ds[name], "function", `missing export ${name}`)
})

await test("Button renders all three Figma styles", () => {
  for (const variant of ["primary", "secondary", "ghost"]) {
    const html = render(React.createElement(ds.Button, { variant }, "ابحث"))
    assert.match(html, new RegExp(`v2-button--${variant}`))
  }
})

await test("Button disabled and loading states are both non-interactive", () => {
  const disabled = render(React.createElement(ds.Button, { disabled: true }, "x"))
  assert.match(disabled, /disabled=""/)
  const loading = render(React.createElement(ds.Button, { loading: true }, "x"))
  assert.match(loading, /aria-busy="true"/)
  assert.match(loading, /disabled=""/)
  assert.match(loading, /data-loading="true"/)
})

await test("Button loading keeps the label mounted so the box cannot shift", () => {
  const html = render(React.createElement(ds.Button, { loading: true }, "ابحث"))
  assert.match(html, /v2-button__label/)
  assert.match(html, /ابحث/)
})

await test("Button focus and pressed are styled without changing box size", () => {
  assert.match(primitivesCss, /\.v2-button:focus-visible/)
  assert.match(primitivesCss, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
  const focusBlock = primitivesCss.slice(primitivesCss.indexOf(".v2-button:focus-visible"))
  assert.ok(!/\.v2-button:focus-visible[^}]*border-width/.test(focusBlock))
})

await test("Button meets the 48px touch floor", () => {
  assert.match(primitivesCss, /\.v2-button \{[\s\S]*?min-height: var\(--hajiz-v2-touch-target\)/)
})

await test("IconButton requires an accessible label", () => {
  const html = render(React.createElement(ds.IconButton, { label: "فتح" }, "\u2630"))
  assert.match(html, /aria-label="فتح"/)
  assert.match(html, /aria-hidden="true"/)
})

await test("TextField associates its label and reports errors to AT", () => {
  const html = render(React.createElement(ds.TextField, { label: "من", error: "مطلوب", id: "f1" }))
  assert.match(html, /<label class="v2-field-label" for="f1">/)
  assert.match(html, /aria-invalid="true"/)
  assert.match(html, /aria-describedby="f1-error"/)
  assert.match(html, /role="alert"/)
})

await test("TextField without an error exposes no invalid state", () => {
  const html = render(React.createElement(ds.TextField, { label: "من", id: "f2" }))
  assert.ok(!html.includes('aria-invalid'))
  assert.match(html, /data-invalid="false"/)
})

await test("SelectTrigger announces itself as a popup control", () => {
  const html = render(React.createElement(ds.SelectTrigger, { label: "المسافرون", value: "1 بالغ", id: "s1" }))
  assert.match(html, /aria-haspopup="listbox"/)
  assert.match(html, /aria-labelledby="s1-label s1"/)
})

await test("SearchField exposes a search landmark and a real label", () => {
  const html = render(React.createElement(ds.SearchField, { label: "بحث", id: "q" }))
  assert.match(html, /role="search"/)
  assert.match(html, /for="q"/)
  assert.match(html, /type="search"/)
})

await test("StatusBadge maps tones to the Figma status tokens", () => {
  for (const tone of ["neutral", "info", "success", "warning", "error"]) {
    const html = render(React.createElement(ds.StatusBadge, { tone, label: tone }))
    assert.match(html, new RegExp(`v2-status-badge--${tone}`))
    assert.match(html, new RegExp(`data-tone="${tone}"`))
  }
})

await test("StatusBadge falls back to neutral for an unknown tone", () => {
  const html = render(React.createElement(ds.StatusBadge, { tone: "explode", label: "x" }))
  assert.match(html, /v2-status-badge--neutral/)
})

await test("StatusBadge renders only the supplied label and derives no state", async () => {
  const source = await read("../src/design-system/primitives/StatusBadge.jsx")
  assert.equal(/awaiting|confirmed|rejected|expired|refunded|under_review/.test(source), false)
})

await test("Skeleton and Spinner stay out of the accessibility tree by default", () => {
  assert.match(render(React.createElement(ds.Skeleton, {})), /aria-hidden="true"/)
  assert.match(render(React.createElement(ds.Spinner, {})), /aria-hidden="true"/)
  assert.match(render(React.createElement(ds.Spinner, { label: "جارٍ التحميل" })), /role="status"/)
})

await test("Empty and error shells render title, body and actions", () => {
  const empty = render(React.createElement(ds.EmptyState, { title: "لا نتائج", description: "جرب تواريخ أخرى" }))
  assert.match(empty, /لا نتائج/)
  assert.match(empty, /جرب تواريخ أخرى/)
  const error = render(React.createElement(ds.ErrorState, { title: "تعذر التحميل" }))
  assert.match(error, /role="alert"/)
  assert.match(error, /v2-no-motion/)
})

await test("Surface and Card expose the Figma elevation ramp", () => {
  assert.match(render(React.createElement(ds.Surface, { tone: "inverse", elevation: "floating" })), /v2-surface--inverse/)
  assert.match(render(React.createElement(ds.Surface, { tone: "inverse", elevation: "floating" })), /v2-surface--floating/)
  assert.match(primitivesCss, /--hajiz-v2-shadow-lg/)
  assert.match(render(React.createElement(ds.Card, null, "x")), /v2-card/)
})

await test("NetworkMark is decorative unless labelled and can be frozen", () => {
  const plain = render(React.createElement(ds.NetworkMark, {}))
  assert.match(plain, /aria-hidden="true"/)
  assert.match(plain, /v2-motion-origin/)
  const still = render(React.createElement(ds.NetworkMark, { animated: false, label: "حاجز" }))
  assert.match(still, /role="img"/)
  assert.ok(!still.includes("v2-motion-origin"))
})

await test("NetworkMark geometry matches the Figma nodes", () => {
  const md = render(React.createElement(ds.NetworkMark, {}))
  assert.match(md, /24px/)
  assert.match(md, /300px/)
  assert.match(md, /38px/)
  const sm = render(React.createElement(ds.NetworkMark, { size: "sm" }))
  assert.match(sm, /18px/)
  assert.match(sm, /160px/)
  assert.match(sm, /28px/)
})

// ---- App shell ------------------------------------------------------------

const { AppShell } = await vite.ssrLoadModule("/src/app/layouts/AppShell.jsx")
const shell = render(React.createElement(MemoryRouter, null,
  React.createElement(AppShell, null, React.createElement("p", null, "shell-test"))))

await test("shell renders brand, navigation and utilities", () => {
  assert.match(shell, /v2-brand/)
  assert.match(shell, /حاجز/)
  assert.match(shell, /aria-label="التنقل الرئيسي"/)
  assert.match(shell, /v2-utilities/)
})

await test("shell keeps every primary route from the navigation contract", async () => {
  const { PRIMARY_NAVIGATION } = await import("../src/services/contracts/navigation.js")
  for (const item of PRIMARY_NAVIGATION.slice(1)) {
    assert.ok(shell.includes(`href="${item.to}"`), `missing route ${item.to}`)
    assert.ok(shell.includes(item.label), `missing label ${item.label}`)
  }
})

await test("shell navigation is real routing, not mocked markup", () => {
  assert.match(shellSource, /NavLink/)
  assert.match(shellSource, /<Outlet \/>/)
  assert.ok(!shellSource.includes("<a href=\"/flights\""))
})

await test("shell exposes skip link, main landmark and footer", () => {
  assert.match(shell, /class="skip-link" href="#main-content"/)
  assert.match(shell, /id="main-content"/)
  assert.match(shell, /tabindex="-1"/)
  assert.match(shell, /v2-footer/)
})

await test("mobile navigation stays accessible and collapsible", () => {
  assert.match(shell, /aria-controls="mobile-navigation"/)
  assert.match(shell, /aria-expanded="false"/)
  assert.match(shell, /id="mobile-navigation"/)
  assert.match(shell, /hidden=""/)
})

await test("menu button carries a label and a decorative glyph", () => {
  assert.match(shell, /aria-label="فتح قائمة التنقل"/)
  assert.match(shell, /v2-menu-button__glyph" aria-hidden="true"/)
})

await test("language control names its target and is a real button", () => {
  assert.match(shell, /aria-label="Switch to English"/)
  assert.match(shell, /العربية/)
})

await test("shell stays stable while the session is still resolving", () => {
  // Rendered without an AuthSessionProvider, so status is "checking".
  assert.match(shell, /aria-live="polite">الحساب/)
  assert.ok(!shell.includes("رحلاتي"), "trips utility must not leak before sign-in")
  assert.ok(!shell.includes("حجوزاتي"))
})

await test("shell keeps both signed-in and signed-out account branches", () => {
  assert.match(shellSource, /signed_in[\s\S]*حسابي/)
  assert.match(shellSource, /signed_out[\s\S]*تسجيل الدخول/)
  // The trips utility is gated on an authenticated session, never rendered bare.
  assert.match(shellSource, /session\.status === "signed_in"[\s\S]*رحلاتي/)
})

await test("shell no longer pins direction imperatively", () => {
  assert.ok(!shellSource.includes('document.documentElement.dir = "rtl"'))
  assert.match(shellSource, /useDirection/)
})

await test("active navigation is not signalled by colour alone", () => {
  assert.match(shellCss, /\.v2-nav__link--active::after/)
})

await test("every interactive shell target meets the 48px floor", () => {
  for (const selector of [".v2-nav__link,", ".v2-menu-button", ".v2-brand"])
    assert.ok(shellCss.includes(selector), `missing ${selector}`)
  const touchRules = (shellCss.match(/min-block-size: var\(--hajiz-v2-touch-target\)|block-size: var\(--hajiz-v2-touch-target\)/g) ?? [])
  assert.ok(touchRules.length >= 4, `expected touch-target rules, found ${touchRules.length}`)
})

await test("focus is visible on every shell control", () => {
  for (const selector of [".v2-nav__link:focus-visible", ".v2-menu-button:focus-visible",
    ".v2-brand:focus-visible", ".v2-footer__nav a:focus-visible", ".skip-link:focus-visible"])
    assert.ok(shellCss.includes(selector), `missing focus style for ${selector}`)
})

await test("responsive behaviour is defined for the 900px breakpoint", () => {
  assert.match(shellCss, /@media \(max-width: 900px\)/)
  const mobile = shellCss.slice(shellCss.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.v2-nav \{ display: none; \}/)
  assert.match(mobile, /\.v2-menu-button \{ display: inline-flex; \}/)
})

await test("header heights match the canonical frames", () => {
  assert.match(v2Tokens, /--hajiz-v2-header-height-desktop:\s*88px;/)
  assert.match(v2Tokens, /--hajiz-v2-header-height-mobile:\s*68px;/)
})

await test("design system entry imports all four V2 layers", () => {
  for (const layer of ["typography/typography.css", "motion/motion.css",
    "primitives/primitives.css", "layout/app-shell-v2.css"])
    assert.ok(dsIndex.includes(layer), `missing ${layer}`)
})

// ---- Ownership boundary ---------------------------------------------------

await test("no V2 file reaches into server, supabase or payment authority", async () => {
  const path = await import("node:path")
  const { fileURLToPath } = await import("node:url")
  const roots = ["../src/design-system", "../src/app/layouts"].map(
    rel => fileURLToPath(new URL(rel, import.meta.url)))
  const files = []
  const walk = async dir => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (/\.(jsx?|css)$/.test(entry.name)) files.push(full)
    }
  }
  for (const root of roots) await walk(root)
  assert.ok(files.length >= 20, `expected the V2 surface, found ${files.length} files`)
  for (const file of files) {
    const source = await fs.readFile(file, "utf8")
    assert.equal(/src\/server|supabase\/(migrations|functions)|service_role|SUPABASE_SERVICE/.test(source),
      false, `${path.basename(file)} crosses the frontend ownership boundary`)
  }
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
