const freeze = (items) => Object.freeze(items.map((item) => Object.freeze(item)))
export const PARTNER_MODEL = "model-b"
export const PARTNER_SECTIONS = freeze([
  { id: "overview", label: "نظرة عامة", state: "presentation-only" },
  { id: "bookings", label: "الحجوزات", state: "read-contract-pending" },
  { id: "clients", label: "العملاء", state: "read-contract-pending" },
  { id: "commission", label: "العمولات", state: "policy-owned" },
  { id: "payouts", label: "الدفعات المستحقة", state: "contract-pending" },
  { id: "kyc", label: "التحقق KYC", state: "contract-pending" },
  { id: "referrals", label: "الإحالات", state: "contract-pending" },
  { id: "pricing-uplift", label: "هامش البيع", state: "policy-owned" },
])
export const PARTNER_PUBLIC_FIELDS = Object.freeze(["bookingReference", "clientLabel", "sellingAmount", "currency", "status", "commissionDisplay", "payoutStatus"])
export function toPartnerSafePresentation(record = {}) { const safe = {}; for (const key of PARTNER_PUBLIC_FIELDS) if (record[key] !== undefined) safe[key] = record[key]; return Object.freeze(safe) }
