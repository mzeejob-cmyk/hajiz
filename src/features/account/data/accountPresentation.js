const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)))

export const ACCOUNT_SECTIONS = freeze([
  { id: "trips", label: "حجوزاتي", path: "/account/trips", state: "authenticated-rpc" },
  { id: "profile", label: "الملف الشخصي", path: "/account/profile", state: "profile-rpc-boundary" },
  { id: "travelers", label: "المسافرون المحفوظون", path: "/account/travelers", state: "contract-pending" },
  { id: "favorites", label: "المفضلة والتفضيلات", path: "/account/favorites", state: "contract-pending" },
])

export const PROFILE_FIELDS = freeze([
  { id: "displayName", label: "الاسم المعروض", editable: true, source: "profiles.display_name" },
  { id: "phone", label: "رقم الهاتف", editable: true, source: "profiles.phone" },
  { id: "email", label: "البريد الإلكتروني", editable: false, source: "authenticated-identity" },
])

export function sanitizeProfileUpdate(input) {
  const allowed = { displayName: input?.displayName, phone: input?.phone }
  for (const [key, value] of Object.entries(allowed)) {
    if (typeof value !== "string" || value.trim().length > 80) throw new Error(`ACCOUNT_INVALID_${key.toUpperCase()}`)
    allowed[key] = value.trim()
  }
  return Object.freeze(allowed)
}

export const ACCOUNT_PRIVACY_CONTRACT = Object.freeze({ piiInUrl: false, browserStorage: false, logoutAuthority: "auth-session-provider", protectedFields: Object.freeze(["role", "finance_enabled", "commission_rate"]) })
