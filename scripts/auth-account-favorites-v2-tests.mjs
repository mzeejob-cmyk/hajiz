import assert from "node:assert/strict"
import fs from "node:fs/promises"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { createServer } from "vite"

/**
 * HAJIZ V2 Auth + Account + Saved Travelers + Favorites regression suite.
 * Guards the node 19:2 grammar, reuse of the frozen auth, profile and P2
 * authorities, the truthful representation of unsupported capabilities,
 * account privacy, RTL/LTR, responsive rules, accessibility and motion safety.
 */

let passed = 0
const failures = []
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`\u2713 ${name}`) }
  catch (error) { failures.push(name); console.log(`\u2717 ${name}\n   ${error.message}`) }
}

const read = path => fs.readFile(new URL(path, import.meta.url), "utf8")
const [css, loginSource, shellSource, overviewSource, capabilitiesSource,
  authDataSource, accountDataSource, p2DataSource, presentationSource, mainSource] =
  await Promise.all([
    read("../src/features/account/account-v2.css"),
    read("../src/features/auth/LoginPage.jsx"),
    read("../src/features/account/AccountPage.jsx"),
    read("../src/features/account/components/AccountOverview.jsx"),
    read("../src/features/account/components/AccountCapabilities.jsx"),
    read("../src/services/authSessionDataSource.js"),
    read("../src/services/accountDataSource.js"),
    read("../src/services/accountP2DataSource.js"),
    read("../src/features/account/data/accountPresentation.js"),
    read("../src/main.jsx"),
  ])

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" })
const { default: LoginPage } = await vite.ssrLoadModule("/src/features/auth/LoginPage.jsx")
const { default: AccountPage } = await vite.ssrLoadModule("/src/features/account/AccountPage.jsx")
const { AccountCapabilities } = await vite.ssrLoadModule("/src/features/account/components/AccountCapabilities.jsx")
const presentation = await vite.ssrLoadModule("/src/features/account/data/accountPresentation.js")

const login = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(LoginPage)))
const shell = renderToStaticMarkup(React.createElement(MemoryRouter,
  { initialEntries: ["/account/trips"] },
  React.createElement(Routes, null, React.createElement(Route,
    { path: "/account/*", element: React.createElement(AccountPage) }))))
const capabilities = renderToStaticMarkup(React.createElement(AccountCapabilities))
const travelerSlice = overviewSource.slice(overviewSource.indexOf("export function TravelersFoundation"),
  overviewSource.indexOf("const emptyCatalogState"))
const favoritesSlice = overviewSource.slice(overviewSource.indexOf("export function FavoritesFoundation"))
const profileSlice = overviewSource.slice(overviewSource.indexOf("export function ProfileFoundation"),
  overviewSource.indexOf("export function TravelersFoundation"))

// ---- Canonical V2 grammar · node 19:2 --------------------------------------

await test("login renders the node 19:3 travel-welcome card", () => {
  assert.match(login, /auth-v2__card/)
  assert.match(login, /مرحبًا بعودتك/)
  assert.match(login, /رحلاتك ومستنداتك في مكان واحد\./)
  assert.match(css, /\.auth-v2__card \{[\s\S]*?background: var\(--hajiz-v2-color-surface-inverse\)/)
  assert.match(css, /\.auth-v2__card \{[\s\S]*?border-radius: var\(--hajiz-v2-radius-lg\)/)
})

await test("the login action matches node 19:12", () => {
  assert.match(css, /\.auth-v2__action \{[\s\S]*?background: var\(--hajiz-v2-gold-500\)/)
  assert.match(css, /\.auth-v2__action \{[\s\S]*?color: var\(--hajiz-v2-color-text-primary\)/)
})

await test("the account shell renders the node 19:15 overview", () => {
  assert.match(shell, /account-v2__layout/)
  assert.match(shell, /account-v2__nav/)
  assert.match(shell, /بيانات العميل الموثوقة فقط/)
  assert.match(css, /\.account-v2__layout \{[\s\S]*?grid-template-columns: 300px minmax\(0, 1fr\)/)
})

// ---- Auth authority reused ---------------------------------------------------

await test("login still uses the existing auth data source", () => {
  assert.match(loginSource, /authSessionDataSource/)
  assert.match(loginSource, /dataSource\.signIn\(\{ email: fields\.get\("email"\), password: fields\.get\("password"\) \}\)/)
  assert.match(authDataSource, /getAccountSessionClient/)
  assert.match(authDataSource, /auth\.getUser/)
  assert.match(authDataSource, /signInWithPassword/)
})

await test("no second Supabase client is created", () => {
  for (const [name, source] of [["auth data source", authDataSource], ["login", loginSource],
    ["shell", shellSource], ["overview", overviewSource], ["capabilities", capabilitiesSource]])
    assert.equal(/createClient\s*\(/.test(source), false, name)
})

await test("no browser storage or custom token handling is added", () => {
  for (const [name, source] of [["login", loginSource], ["shell", shellSource],
    ["overview", overviewSource], ["capabilities", capabilitiesSource], ["css", css]])
    assert.equal(/localStorage|sessionStorage|indexedDB|document\.cookie|access_token|refresh_token/.test(source), false, name)
})

await test("the internal-only returnTo guard is preserved", () => {
  assert.match(loginSource, /normalizeInternalReturnTo\(location\.state\?\.returnTo\)/)
  assert.match(loginSource, /\{ replace: true \}/)
  assert.equal(/window\.location|searchParams\.get\("returnTo"\)/.test(loginSource), false)
})

await test("the duplicate-submit guard and generic failure copy are intact", () => {
  assert.match(loginSource, /if \(submitState === "submitting"\) return/)
  assert.match(loginSource, /disabled=\{submitState === "submitting"\}/)
  assert.match(loginSource, /تعذر تسجيل الدخول\. تحقق من البريد الإلكتروني وكلمة المرور\./)
})

await test("no raw provider error can reach the customer", () => {
  assert.match(loginSource, /\} catch \{/)
  assert.equal(/error\.message|catch \(error\)|console\./.test(loginSource), false)
})

await test("the already-signed-in state is preserved", () => {
  assert.match(loginSource, /session\.status === "signed_in"/)
  assert.match(loginSource, /أنت مسجل الدخول بالفعل\./)
  assert.match(loginSource, /to="\/account\/trips"/)
})

// ---- Unsupported auth surfaces stay unsupported ---------------------------------

await test("signup, password reset, OTP and OAuth are stated, not implemented", () => {
  assert.match(login, /الإنشاء واستعادة كلمة المرور وOTP وOAuth: أسطح مستقبلية غير مفعّلة/)
  assert.match(login, /إنشاء حساب جديد غير متاح من هذه الواجهة حاليًا\./)
  // Match API calls, not the prose that names the unsupported surfaces.
  assert.equal(/\.signUp\(|resetPasswordForEmail|signInWithOtp|signInWithOAuth|verifyOtp|signInWithIdToken/.test(loginSource), false)
})

await test("no dead control or fake link is rendered for those surfaces", () => {
  const notes = [...login.matchAll(/<p class="auth-v2__note[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map(m => m[1])
  assert.ok(notes.length >= 2)
  for (const note of notes) assert.equal(/<a |<button|href=/.test(note), false)
})

await test("only the email and password fields exist on the login form", () => {
  const inputs = [...login.matchAll(/<input[^>]*name="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(inputs, ["email", "password"])
  assert.match(login, /autocomplete="email"/i)
  assert.match(login, /autocomplete="current-password"/i)
})

// ---- Profile authority --------------------------------------------------------

await test("profile still uses the existing account data source", () => {
  assert.match(profileSlice, /dataSource = accountDataSource/)
  assert.match(profileSlice, /dataSource\.saveProfile\(\{ displayName: profile\.displayName, phone: profile\.phone \}\)/)
  assert.match(accountDataSource, /update_my_profile/)
})

await test("only displayName and phone are editable", () => {
  assert.deepEqual(presentation.PROFILE_FIELDS.filter(field => field.editable).map(field => field.id),
    ["displayName", "phone"])
  assert.equal(presentation.PROFILE_FIELDS.find(field => field.id === "email").editable, false)
})

await test("email is rendered read-only and says so in words", () => {
  assert.match(overviewSource, /readOnly=\{!field\.editable\}/)
  assert.match(overviewSource, /aria-readonly=\{!field\.editable \|\| undefined\}/)
  assert.match(overviewSource, /للقراءة فقط/)
})

await test("protected fields are never exposed or submitted", () => {
  assert.deepEqual([...presentation.ACCOUNT_PRIVACY_CONTRACT.protectedFields],
    ["role", "finance_enabled", "commission_rate"])
  for (const field of ["role", "finance_enabled", "commission_rate"])
    assert.equal(overviewSource.includes(`"${field}"`), false, field)
  assert.match(presentationSource, /const allowed = \{ displayName: input\?\.displayName, phone: input\?\.phone \}/)
})

await test("no second profile API is introduced", () => {
  assert.equal(/fetch\s*\(|axios|["'`]https?:/i.test(overviewSource), false)
})

// ---- Saved travelers ------------------------------------------------------------

await test("travelers still use the existing P2 data source", () => {
  assert.match(travelerSlice, /dataSource = accountP2DataSource/)
  for (const op of ["listTravelers", "saveTraveler", "deleteTraveler"])
    assert.match(travelerSlice, new RegExp(`dataSource\\.${op}`), op)
})

await test("the traveler model stays firstName and lastName only", () => {
  const inputs = [...travelerSlice.matchAll(/name="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(inputs, ["firstName", "lastName"])
  assert.equal(/passport|nationality|birth|gender|visa|document/i.test(travelerSlice), false)
})

await test("the passport truth statement is preserved", () => {
  assert.match(travelerSlice, /نحفظ الاسم الأول واسم العائلة فقط\. لا تُحفظ بيانات الجواز هنا\./)
})

// ---- Favorites --------------------------------------------------------------------

await test("favorites still use the existing P2 and catalog authorities", () => {
  assert.match(favoritesSlice, /dataSource = accountP2DataSource/)
  assert.match(favoritesSlice, /catalogDataSource = publicCatalogDataSource/)
  assert.match(favoritesSlice, /dataSource\.listFavorites/)
  assert.match(favoritesSlice, /dataSource\.deleteFavorite/)
  assert.match(favoritesSlice, /joinFavoriteCatalogPresentation/)
})

await test("published catalog enrichment is preserved for packages and offers", () => {
  assert.match(favoritesSlice, /catalogDataSource\.loadPackages/)
  assert.match(favoritesSlice, /catalogDataSource\.loadOffers/)
  assert.match(favoritesSlice, /data-catalog-enrichment=\{catalogError \? "partial" : "available"\}/)
  assert.match(favoritesSlice, /تعذر تحميل تفاصيل بعض العناصر المحفوظة\./)
})

await test("an unpublished favorite still shows its canonical id verbatim", () => {
  assert.match(favoritesSlice, /!presentation\.published && <bdi className="account-v2__canonical" dir="ltr">\{favorite\.canonicalId\}<\/bdi>/)
  assert.match(css, /\.account-v2__canonical \{[\s\S]*?unicode-bidi: isolate/)
})

await test("no private catalog table is reached from the account surface", () => {
  assert.equal(/\.from\s*\(|\.rpc\s*\(|service_role/.test(overviewSource), false)
})

// ---- Language, currency and notifications ---------------------------------------------

await test("the locale preference stays ar and en only", () => {
  const locales = [...favoritesSlice.matchAll(/name="locale" value="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(locales, ["ar", "en"])
  assert.match(favoritesSlice, /dataSource\.savePreference\(next\)/)
})

await test("no currency preference is persisted or invented", () => {
  for (const [name, source] of [["overview", overviewSource], ["capabilities", capabilitiesSource],
    ["shell", shellSource]]) {
    assert.equal(/savePreference\([^)]*currency|currency\s*:\s*["\x27`]|name="currency"|<select/i.test(source), false, name)
  }
  assert.equal(/AED/.test(capabilities), false, "AED must not be presented as a saved preference")
  assert.match(capabilities, /تفضيل العملة غير قابل للضبط في هذه المرحلة/)
})

await test("notification settings are stated, never implemented", () => {
  assert.match(capabilities, /المزوّد غير مهيأ بالكامل/)
  assert.equal(/<button|<input|<select|onClick|onChange|useState/.test(capabilitiesSource), false)
  for (const source of [overviewSource, shellSource])
    assert.equal(/notificationPreference|notifications_enabled|name="notifications"/i.test(source), false)
})

// ---- Account shell and Execution 07 ------------------------------------------------------

await test("every account route is preserved", () => {
  for (const path of ["trips", "profile", "travelers", "favorites"])
    assert.match(shellSource, new RegExp(`path="${path}"`), path)
  assert.match(shellSource, /<Navigate to="trips" replace \/>/)
})

await test("My Trips is mounted exactly as Execution 07 left it", () => {
  assert.match(shellSource, /<Route path="trips" element=\{<MyTripsPage \/>\} \/>/)
  assert.equal(/myTripsDataSource|toMyTripsPresentation/.test(shellSource), false)
  assert.match(shell, /data-authority="authenticated-rpc"/)
  assert.match(shell, /data-trip-tabs="preview"/)
})

await test("the active account section is not signalled by colour alone", () => {
  assert.match(css, /\.account-v2__nav-link--active::before/)
  assert.match(shell, /account-v2__nav-link--active/)
})

// ---- Privacy -----------------------------------------------------------------------------

await test("the privacy contract is preserved and stated", () => {
  assert.equal(presentation.ACCOUNT_PRIVACY_CONTRACT.piiInUrl, false)
  assert.equal(presentation.ACCOUNT_PRIVACY_CONTRACT.browserStorage, false)
  assert.match(shell, /data-privacy="no-url-or-browser-storage"/)
  assert.match(overviewSource, /account-v2__privacy/)
})

await test("no personal value is placed in a URL", () => {
  for (const [name, source] of [["login", loginSource], ["shell", shellSource], ["overview", overviewSource]])
    assert.equal(/searchParams\.set|URLSearchParams|#\$\{|\?email=|\?phone=/.test(source), false, name)
})

await test("nothing logs credentials or personal data", () => {
  for (const [name, source] of [["login", loginSource], ["overview", overviewSource],
    ["capabilities", capabilitiesSource], ["shell", shellSource]])
    assert.equal(/console\.(log|warn|error|info)/.test(source), false, name)
})

// ---- RTL / LTR -------------------------------------------------------------------------------

await test("account CSS uses logical properties only", () => {
  const physical = css.match(/^\s*(?:margin|padding|border|inset)-(?:left|right):/gm) ?? []
  assert.deepEqual(physical, [], `physical properties: ${physical.join(", ")}`)
  assert.ok(!/float:/.test(css))
})

await test("credentials and identity values read left to right", () => {
  const emailInput = login.match(/<input[^>]*name="email"[^>]*>/)?.[0] ?? ""
  assert.match(emailInput, /auth-v2__input--latin/)
  assert.match(emailInput, /dir="ltr"/)
  assert.match(overviewSource, /dir=\{field\.id === "email" \? "ltr" : undefined\}/)
  assert.match(css, /\.auth-v2__input--latin,[\s\S]*?unicode-bidi: isolate/)
})

await test("both surfaces render structurally in LTR as well as RTL", async () => {
  const { DirectionProvider } = await vite.ssrLoadModule("/src/design-system/direction/DirectionProvider.jsx")
  for (const locale of ["ar", "en"]) {
    const html = renderToStaticMarkup(React.createElement(MemoryRouter, null,
      React.createElement(DirectionProvider, { initialLocale: locale }, React.createElement(LoginPage))))
    assert.match(html, /auth-v2__card/, locale)
    assert.match(html, /name="password"/, locale)
  }
})

// ---- Responsive ---------------------------------------------------------------------------------

await test("responsive steps exist for tablet, mobile and the narrowest viewport", () => {
  assert.match(css, /@media \(max-width: 1024px\)/)
  assert.match(css, /@media \(max-width: 900px\)/)
  assert.match(css, /@media \(max-width: 390px\)/)
})

await test("mobile stacks the account shell and widens row actions", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 900px)"))
  assert.match(mobile, /\.account-v2__layout \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(mobile, /\.account-v2__row \{[\s\S]*?flex-direction: column/)
  assert.match(mobile, /inline-size: 100%/)
})

await test("long values wrap instead of overflowing", () => {
  for (const selector of ["__canonical", "__row-name", "__row-summary", "__input"]) {
    const at = css.indexOf(selector)
    assert.match(css.slice(at, at + 460), /overflow-wrap: anywhere/, selector)
  }
  assert.match(css, /\.account-v2__nav \{[\s\S]*?min-inline-size: 0/)
  assert.match(css, /\.account-v2__main \{ min-inline-size: 0; \}/)
})

await test("no fixed width can overflow a 390px viewport", () => {
  const fixed = [...css.matchAll(/(?:^|[^-])(?:inline-size|width):\s*(\d+)px/g)]
    .map(m => Number(m[1])).filter(v => v > 360)
  assert.deepEqual(fixed, [], `fixed widths: ${fixed.join(", ")}`)
})

// ---- Accessibility and motion ------------------------------------------------------------------------

await test("every account control meets the 48px touch floor", () => {
  for (const selector of [".auth-v2__action", ".account-v2__nav-link", ".account-v2__submit",
    ".account-v2__row-action", ".account-v2__locale-option"]) {
    const at = css.indexOf(`${selector} {`)
    assert.ok(at > -1, selector)
    assert.match(css.slice(at, css.indexOf("}", at)), /min-block-size: var\(--hajiz-v2-touch-target\)/, selector)
  }
})

await test("focus is visible on every account control", () => {
  assert.match(css, /\.auth-v2__input:focus-visible/)
  assert.match(css, /\.account-v2__nav-link:focus-visible/)
  assert.match(css, /outline: var\(--hajiz-v2-stroke-focus\) solid var\(--hajiz-v2-color-border-focus\)/)
})

await test("labels are attached and the locale choice uses a fieldset", () => {
  assert.match(login, /<label class="auth-v2__field"><span class="auth-v2__label">البريد الإلكتروني<\/span><input/)
  assert.match(favoritesSlice, /<fieldset className="account-v2__locale"/)
  assert.match(favoritesSlice, /<legend className="account-v2__label">اللغة المفضلة<\/legend>/)
})

await test("save and submit operations expose a busy state", () => {
  assert.match(loginSource, /aria-busy=\{submitState === "submitting" \|\| undefined\}/)
  assert.match(overviewSource, /aria-busy=\{state === "saving" \|\| undefined\}/)
  assert.match(overviewSource, /aria-busy=\{busy \|\| undefined\}/)
  assert.match(overviewSource, /aria-busy=\{preferenceBusy \|\| undefined\}/)
})

await test("status is announced politely and errors use alert", () => {
  assert.match(overviewSource, /aria-live="polite"/)
  assert.match(loginSource, /role="alert"/)
  assert.match(favoritesSlice, /role="alert"/)
})

await test("no second motion system is introduced", () => {
  assert.ok(!/@keyframes/.test(css))
})

await test("reduced motion is honoured", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)")), /transition: none/)
})

await test("credentials, save state, errors and privacy copy never animate", () => {
  for (const selector of ["auth-v2__note", "auth-v2__error", "account-v2__status",
    "account-v2__privacy", "account-v2__partial", "account-v2__canonical", "account-v2__capability-note"]) {
    const at = css.indexOf(selector)
    assert.match(css.slice(at, at + 440), /animation: none/, `${selector} is not pinned static`)
  }
  assert.match(loginSource, /v2-no-motion/)
  assert.match(overviewSource, /v2-no-motion/)
})

// ---- Ownership -------------------------------------------------------------------------------------

await test("account CSS loads last, after every earlier V2 layer", () => {
  const order = ['./design-system/index.css', './features/home/home-v2.css',
    './features/flights/flight-results-v2.css', './features/flights/checkout-v2.css',
    './features/flights/payments-v2.css', './features/account/trips-v2.css',
    './features/account/account-v2.css']
  const positions = order.map(marker => mainSource.indexOf(marker))
  assert.ok(positions.every(position => position > -1))
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

await test("no account file crosses the frontend ownership boundary", () => {
  const restricted = /src\/server|supabase\/(migrations|functions)|src\/legacy|service_role/i
  for (const [name, source] of [["login", loginSource], ["shell", shellSource],
    ["overview", overviewSource], ["capabilities", capabilitiesSource], ["css", css]])
    assert.equal(restricted.test(source), false, name)
  assert.ok(!shellSource.includes("contracts/navigation.js"))
})

await test("the P2 data source business behaviour is untouched", () => {
  for (const op of ["listTravelers", "saveTraveler", "deleteTraveler", "listFavorites",
    "deleteFavorite", "loadPreference", "savePreference"])
    assert.match(p2DataSource, new RegExp(op), op)
})

const flightsPageSource = await read("../src/features/flights/FlightsPage.jsx")

await test("the retired legacy fixture views stay retired", () => {
  for (const view of ["fare", "traveler", "review"])
    assert.equal(new RegExp(`params\\.get\\("view"\\) === "${view}"`).test(flightsPageSource), false, view)
})

await vite.close()

console.log(`\n${passed} tests passed`)
if (failures.length) {
  console.log(`${failures.length} failed:\n - ${failures.join("\n - ")}`)
  process.exit(1)
}
