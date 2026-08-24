import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, Component } from "react";
import { signUpUser, signInUser } from "./auth.js";
import { createBooking, uploadReceipt, createPayment } from "./bookings.js";

// ═══════════════════════════════════════════════════════════════════════
// HAJIZ — OTA PLATFORM v4 (PRODUCTION ARCHITECTURE)
// Context-driven · Service-abstracted · Premium UX
// AppContext eliminates prop drilling · BackendService ready for real APIs
// ═══════════════════════════════════════════════════════════════════════

const HAJIZ_LOGO = "data:image/png;base64,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";

// ─── DESIGN TOKENS (single source of truth) ──────────────────────────
const T = {
  // LIGHT LUXURY PALETTE — airy, premium, Gulf-grade
  bg: "#F7F8FA", bg2: "#FFFFFF", card: "#FFFFFF", surface2: "#F1F4F8",
  text: "#0C1B2E", ink: "#FFFFFF", pure: "#FFFFFF",
  navy: "#0C1B2E", navyMid: "#12263D", navyLight: "#1B3A5C",
  gold: "#B8862F", goldLight: "#C9A34E", goldDark: "#9A6E22",
  offwhite: "#F7F8FA", white: "#FFFFFF",
  gray50: "#F7F8FA", gray100: "#EEF1F5", gray200: "#DDE3EA", gray300: "#C4CDD8",
  gray400: "#8A97A8", gray500: "#657486", gray600: "#4A5A6E", gray800: "#243447",
  green: "#0E9F6E", greenBg: "#E9F9F1",
  red: "#E02424", redBg: "#FDECEC",
  amber: "#C77A00", amberBg: "#FFF6E6",
  blue: "#2563EB", blueBg: "#EBF1FE",
};

// ─── BACKEND SERVICE (mock mode → swap env var for real API) ──────────
const API_BASE = typeof process !== "undefined" && process.env?.REACT_APP_API_URL || "https://api.hajiz.com/v1";
const IS_MOCK = true; // set false when backend is live

const BackendService = {
  _headers: (token) => ({
    "Content-Type": "application/json",
    "Accept-Language": "ar",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }),
  get: async (path, params = {}, token) => {
    if (IS_MOCK) return BackendService._mock(path, "GET", params);
    const url = new URL(`${API_BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const r = await fetch(url, { headers: BackendService._headers(token) });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  post: async (path, body, token) => {
    if (IS_MOCK) return BackendService._mock(path, "POST", body);
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: BackendService._headers(token), body: JSON.stringify(body) });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  upload: async (path, formData, token) => {
    if (IS_MOCK) return { success: true };
    const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
    if (!r.ok) throw await r.json();
    return r.json();
  },
  // Mock responses — mirrors real API contract
  _mock: async (path, method, body) => {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
    if (path.startsWith("/auth/otp")) return { success: true };
    if (path.startsWith("/auth/profile")) return { email: body?.email, userType: "customer" };
    if (path.startsWith("/hotels/search")) return { hotels: [], total: 0 };
    if (path.startsWith("/flights/search")) return { offers: [] };
    if (path.startsWith("/payments/init")) return { sessionId: `SES-${Math.random().toString(36).substr(2,8).toUpperCase()}`, bankakAccount: "1234 5678 9012", expiresAt: Date.now() + 900000 };
    if (path.startsWith("/user/bookings")) return { bookings: [] };
    if (path.startsWith("/user/favorites")) return { favorites: [] };
    return { success: true };
  },
};

// ─── APP CONTEXT (eliminates currency×118 + rates prop drilling) ───────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

// ─── AUTH CONTEXT (eliminates user×11 prop drilling) ──────────────────
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// ─── TOAST CONTEXT ────────────────────────────────────────────────────
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

// ─── FAVORITES CONTEXT ───────────────────────────────────────────────
const FavoritesContext = createContext(null);
const useFavorites = () => useContext(FavoritesContext);

// ─── GLOBAL STYLE ────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
    :root { --tr: all .25s cubic-bezier(.4,0,.2,1); --line: rgba(184,134,47,.14); --line-h: rgba(184,134,47,.45); }
    * { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { font-family:'Noto Kufi Arabic',sans-serif; background:#F7F8FA; color:#0C1B2E; direction:rtl; -webkit-font-smoothing:antialiased; }
    .num { font-family:'Space Grotesk','Noto Kufi Arabic',sans-serif !important; letter-spacing:.01em; }
    ::selection { background:rgba(184,134,47,.35); }
    ::-webkit-scrollbar { width:6px; height:6px; }
    ::-webkit-scrollbar-track { background:#EEF1F5; }
    ::-webkit-scrollbar-thumb { background:#C4CDD8; border-radius:3px; }
    ::-webkit-scrollbar-thumb:hover { background:#C9A34E; }
    button,input,select,textarea { font-family:inherit; }
    button { cursor:pointer; border:none; outline:none; }
    input,select,textarea { outline:none; }
    a { text-decoration:none; color:inherit; }
    input[type=date]::-webkit-calendar-picker-indicator { filter:sepia(.4) saturate(2) hue-rotate(2deg); cursor:pointer; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    @keyframes scaleIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
    @keyframes shimmer { from{background-position:200% 0} to{background-position:-200% 0} }
    @keyframes toastIn { from{opacity:0;transform:translateY(16px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes heartPop { 0%{transform:scale(1)} 50%{transform:scale(1.4)} 100%{transform:scale(1)} }
    @keyframes reveal { from{opacity:0;transform:translateY(34px);filter:blur(6px)} to{opacity:1;transform:translateY(0);filter:blur(0)} }
    @keyframes floatA { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.08)} }
    @keyframes floatB { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-50px,24px) scale(1.05)} }
    @keyframes flipIn { from{opacity:0;transform:perspective(1200px) rotateX(26deg) translateY(28px)} to{opacity:1;transform:perspective(1200px) rotateX(0) translateY(0)} }
    @keyframes chevron { 0%,100%{opacity:.3;transform:translateY(0)} 50%{opacity:1;transform:translateY(6px)} }
    .fade-up { animation:fadeUp .5s cubic-bezier(.4,0,.2,1) forwards; }
    .fade-in { animation:fadeIn .3s ease forwards; }
    .scale-in { animation:scaleIn .28s cubic-bezier(.4,0,.2,1) forwards; }
    .page-enter { animation:fadeUp .45s cubic-bezier(.4,0,.2,1) forwards; }
    .reveal-1 { opacity:0; animation:reveal .8s cubic-bezier(.2,.7,.2,1) .08s forwards; }
    .reveal-2 { opacity:0; animation:reveal .8s cubic-bezier(.2,.7,.2,1) .26s forwards; }
    .reveal-3 { opacity:0; animation:reveal .8s cubic-bezier(.2,.7,.2,1) .48s forwards; }
    .reveal-4 { opacity:0; animation:reveal .9s cubic-bezier(.2,.7,.2,1) .7s forwards; }
    .hover-lift { transition:var(--tr); border-color:var(--line) !important; }
    .hover-lift:hover { transform:translateY(-4px); border-color:var(--line-h) !important; box-shadow:0 16px 40px rgba(12,27,46,.14), 0 0 0 1px rgba(184,134,47,.20); }
    .skeleton-base { background:linear-gradient(90deg,#EEF1F5 25%,#F7F8FA 50%,#EEF1F5 75%); background-size:400% 100%; animation:shimmer 1.4s ease infinite; border-radius:8px; }
    .glass { background:rgba(255,255,255,.82); backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px); border:1px solid rgba(184,134,47,.18); box-shadow:0 20px 60px rgba(12,27,46,.12); }
    @media (max-width:768px){ .desktop-only{display:none!important;} }
    @media (min-width:769px){ .mobile-only{display:none!important;} }
    @media (max-width:768px){
      .checkout-grid{grid-template-columns:1fr!important;}
      .filter-rail{position:static!important;top:auto!important;max-height:none!important;}
      .summary-sticky{position:static!important;top:auto!important;}
      .search-row{grid-template-columns:1fr!important;}
      .footer-grid{grid-template-columns:1fr 1fr!important;}
      .results-grid{grid-template-columns:1fr!important;}
      .hero-bar{flex-direction:column!important;border-radius:16px!important;}
      .hero-bar > *{border-left:none!important;border-bottom:1px solid rgba(184,134,47,.14);}
      .hero-bar > button:last-child{border-radius:0 0 16px 16px!important;min-height:52px;}
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════════
// NEW COMPONENTS — added without removing anything
// ═══════════════════════════════════════════════════════════════════════

// ─── SKELETON LOADERS ─────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 18, r = 8, style = {} }) => (
  <div className="skeleton-base" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

const SkeletonCard = () => (
  <div style={{ background: T.card, borderRadius: 16, padding: 20, boxShadow: "var(--shadow-card)", border: `1px solid ${T.gray100}` }}>
    <Skeleton h={160} r={12} style={{ marginBottom: 16 }} />
    <Skeleton h={18} w="70%" style={{ marginBottom: 10 }} />
    <Skeleton h={14} w="50%" style={{ marginBottom: 14 }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Skeleton h={24} w="30%" />
      <Skeleton h={36} w={88} r={12} />
    </div>
  </div>
);

const FlightSkeleton = () => (
  <div style={{ background: T.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${T.gray100}`, display: "flex", gap: 16, alignItems: "center" }}>
    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 130 }}>
      <div className="skeleton-base" style={{ width: 30, height: 30, borderRadius: 8 }} />
      <div><div className="skeleton-base" style={{ width: 70, height: 12, marginBottom: 6 }} /><div className="skeleton-base" style={{ width: 44, height: 9 }} /></div>
    </div>
    <div style={{ flex: 1, display: "flex", gap: 14, alignItems: "center", justifyContent: "center" }}>
      <div className="skeleton-base" style={{ width: 44, height: 22 }} />
      <div className="skeleton-base" style={{ flex: 1, maxWidth: 120, height: 2 }} />
      <div className="skeleton-base" style={{ width: 44, height: 22 }} />
    </div>
    <div style={{ minWidth: 100, textAlign: "left" }}><div className="skeleton-base" style={{ width: 80, height: 22, marginBottom: 8 }} /><div className="skeleton-base" style={{ width: 70, height: 30, borderRadius: 10 }} /></div>
  </div>
);

const SkeletonRow = () => (
  <div style={{ background: T.card, borderRadius: 16, padding: 22, boxShadow: "var(--shadow-card)", border: `1px solid ${T.gray100}`, display: "flex", gap: 20, alignItems: "center" }}>
    <Skeleton w={180} h={120} r={12} style={{ flexShrink: 0 }} />
    <div style={{ flex: 1 }}>
      <Skeleton h={20} w="60%" style={{ marginBottom: 10 }} />
      <Skeleton h={14} w="40%" style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Skeleton h={24} w={80} r={20} />
        <Skeleton h={24} w={100} r={20} />
      </div>
    </div>
    <div style={{ minWidth: 120, textAlign: "left" }}>
      <Skeleton h={28} w={90} style={{ marginBottom: 8 }} />
      <Skeleton h={36} w={88} r={12} />
    </div>
  </div>
);

const SkeletonForm = () => (
  <div>
    {[1,2,3,4].map(i => (
      <div key={i} style={{ marginBottom: 16 }}>
        <Skeleton h={14} w={100} style={{ marginBottom: 8 }} />
        <Skeleton h={48} r={12} />
      </div>
    ))}
  </div>
);

// ─── TOAST SYSTEM ────────────────────────────────────────────────────
const TOAST_ICONS = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️", booking: "🎉" };
const TOAST_COLORS = {
  success: { bg: T.greenBg, border: T.green, text: T.green },
  error:   { bg: T.redBg,   border: T.red,   text: T.red },
  info:    { bg: T.blueBg,  border: T.blue,  text: T.blue },
  warning: { bg: T.amberBg, border: T.amber, text: T.amber },
  booking: { bg: `${T.gold}18`, border: T.gold, text: T.goldDark },
};

const ToastContainer = ({ toasts, dismiss }) => (
  <div style={{ position: "fixed", bottom: 88, left: "50%", transform: "translateX(-50%)", zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", pointerEvents: "none", minWidth: 300, maxWidth: 420 }}>
    {toasts.map(t => {
      const c = TOAST_COLORS[t.type] || TOAST_COLORS.info;
      return (
        <div key={t.id} onClick={() => dismiss(t.id)}
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, borderRadius: 14, padding: "12px 18px", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 10, animation: `toastIn .3s ease forwards`, boxShadow: "0 8px 24px rgba(0,0,0,.12)", pointerEvents: "all", cursor: "pointer", maxWidth: "100%" }}>
          <span style={{ fontSize: 18 }}>{TOAST_ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      );
    })}
  </div>
);

// ─── EMPTY STATE ─────────────────────────────────────────────────────
const EmptyState = ({ icon = "🔍", title, sub, action, actionLabel }) => (
  <div style={{ textAlign: "center", padding: "56px 24px" }} className="fade-in">
    <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
    <h3 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>{title}</h3>
    {sub && <p style={{ fontSize: 15, color: T.gray500, marginBottom: 24, maxWidth: 360, margin: "0 auto 24px", lineHeight: 1.7 }}>{sub}</p>}
    {action && <Btn onClick={action}>{actionLabel || "حاول مجدداً"}</Btn>}
  </div>
);

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>حدث خطأ غير متوقع</h3>
        <p style={{ color: T.gray500, marginBottom: 20 }}>يرجى إعادة تحميل الصفحة أو التواصل مع الدعم</p>
        <button onClick={() => window.location.reload()} style={{ padding: "12px 24px", borderRadius: 12, background: T.navy, color: T.gold, fontSize: 14, fontWeight: 600 }}>إعادة التحميل</button>
      </div>
    );
    return this.props.children;
  }
}

// ─── FAVORITE BUTTON ─────────────────────────────────────────────────
const FavoriteBtn = ({ type, id, style = {} }) => {
  const fav = useFavorites();
  const favorites = fav?.favorites || new Set();
  const toggle = fav?.toggle || (() => {});
  const key = `${type}:${id}`;
  const isFav = favorites.has(key);
  return (
    <button onClick={e => { e.stopPropagation(); toggle(type, id); }}
      style={{ width: 36, height: 36, borderRadius: "50%", background: isFav ? T.redBg : `${T.white}CC`, backdropFilter: "blur(4px)", border: `1px solid ${isFav ? T.red : T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, transition: "var(--transition)", ...style }}
      aria-label={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}>
      <span style={{ animation: isFav ? "heartPop .3s ease" : "none" }}>{isFav ? "❤️" : "🤍"}</span>
    </button>
  );
};

// ─── RATING BADGE ─────────────────────────────────────────────────────
const RatingBadge = ({ value, count, size = "md" }) => {
  const fs = size === "sm" ? 11 : 13;
  const rating = value >= 9 ? "استثنائي" : value >= 8 ? "ممتاز" : value >= 7 ? "جيد جداً" : "جيد";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ background: value >= 8 ? T.green : T.amber, color: T.pure, fontSize: fs, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{value}</span>
      <div>
        <div style={{ fontSize: fs, fontWeight: 600, color: T.text }}>{rating}</div>
        {count && <div style={{ fontSize: 11, color: T.gray400 }}>{count.toLocaleString()} تقييم</div>}
      </div>
    </div>
  );
};

// ─── PRICE DISPLAY ───────────────────────────────────────────────────
const PriceDisplay = ({ amount, size = "md", label, strike }) => {
  const app = useApp();
  const currency = app?.currency || "USD";
  const rates = app?.rates || { sdg: 2400, aed: 3.67 };
  const conv = (n) => currency === "AED" ? Math.round(n * rates.aed) : currency === "SDG" ? Math.round(n * rates.sdg) : Math.round(n);
  const suffix = currency === "AED" ? "د.إ" : currency === "SDG" ? "ج.س" : "";
  const prefix = currency === "USD" ? "$" : "";
  const fs = { sm: 16, md: 22, lg: 28, xl: 34 };
  return (
    <div>
      {strike ? <div className="num" style={{ fontSize: 12, color: T.gray400, textDecoration: "line-through", direction: "ltr" }}>{prefix}{conv(strike).toLocaleString()} {suffix}</div> : null}
      <div className="num" style={{ fontSize: fs[size] || 22, fontWeight: 700, color: T.gold, lineHeight: 1.1, direction: "ltr", display: "inline-flex", alignItems: "baseline", gap: 4 }}>
        {prefix}<CountUp value={conv(amount)} />{suffix && <span style={{ fontSize: "0.55em", fontWeight: 700 }}>{suffix}</span>}
      </div>
      {label ? <div style={{ fontSize: 11, color: T.gray400 }}>{label}</div> : null}
    </div>
  );
};

// ─── PAGE TRANSITION WRAPPER ──────────────────────────────────────────
const PageTransition = ({ children, pageKey }) => (
  <div key={pageKey} className="page-enter" style={{ minHeight: "60vh" }}>
    {children}
  </div>
);

// ═══ LAUNCH CONFIG — CMS-driven (mirror of admin panel controls) ═══
const SERVICES_CONFIG = {
  flights:   { id: "flights",   label: "طيران",   icon: "✈️", live: true,  order: 1, sub: "رحلات بأفضل الأسعار" },
  hotels:    { id: "hotels",    label: "فنادق",   icon: "🏨", live: true,  order: 2, sub: "إقامة مؤكدة فوراً" },
  ferries:   { id: "ferries",   label: "بواخر",   icon: "🚢", live: false, order: 3, sub: "بورتسودان ⇄ جدة", eta: "التحديث الثاني", teaser: "خط بورتسودان ⇄ جدة مع 4 شركات ملاحية — حجز مباشر، كبائن واضحة، وأسعار شفافة." },
  packages:  { id: "packages",  label: "باقات",   icon: "🎒", live: false, order: 4, sub: "رحلات متكاملة", eta: "التحديث الثالث", teaser: "عمرة، إسطنبول، شهر عسل — باقات مصممة بعناية تشمل كل شيء." },
  visas:     { id: "visas",     label: "تأشيرات", icon: "🛂", live: false, order: 5, sub: "معالجة موثوقة", eta: "التحديث الثاني", teaser: "e-Visa لتركيا وقطر والبحرين وأكثر — نتقدّم بالطلب نيابةً عنك ونتابع حتى الصدور." },
  insurance: { id: "insurance", label: "تأمين",   icon: "🛡️", live: false, order: 6, sub: "تغطية شاملة", eta: "التحديث الثالث", teaser: "تأمين سفر شامل يحميك أينما كنت — خطط تناسب كل رحلة." },
};
const NAV_ORDER = ["flights", "hotels", "ferries", "packages", "visas", "insurance"];
const PAYMENT_CONFIG = { enabled: ["bankak"] };

// ═══ COUNT-UP (Space Grotesk numerals) ═══
const CountUp = ({ value, dur = 650 }) => {
  const [v, setV] = useState(value);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current; prev.current = value;
    let raf; const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (value - from) * e));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <span className="num">{v.toLocaleString()}</span>;
};

// ═══ ANNOUNCEMENT BAR (CMS-controlled) ═══
const ANNOUNCEMENT_CMS = { on: true, text: "🚀 الإطلاق التجريبي: طيران وفنادق متاحة الآن — الدفع عبر بنكك" };
const AnnouncementBar = () => {
  const [open, setOpen] = useState(ANNOUNCEMENT_CMS.on);
  if (!open) return null;
  return (
    <div style={{ background: "linear-gradient(90deg, rgba(184,134,47,.12), rgba(184,134,47,.04))", borderBottom: "1px solid rgba(184,134,47,.20)", color: T.goldDark, fontSize: 13, fontWeight: 600, padding: "9px 44px", textAlign: "center", position: "relative", zIndex: 1001 }}>
      {ANNOUNCEMENT_CMS.text}
      <button onClick={() => setOpen(false)} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", color: T.goldLight, fontSize: 15, opacity: .8 }}>✕</button>
    </div>
  );
};

// ═══ COMING SOON — luxury teaser + email capture ═══
const ComingSoonPage = ({ svc }) => {
  const toastCtx = useToast();
  const [email, setEmail] = useState("");
  return (
    <PageWrap maxW={640}>
      <div style={{ textAlign: "center", padding: "44px 0" }} className="fade-up">
        <div style={{ width: 110, height: 110, borderRadius: 30, margin: "0 auto 26px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, background: "rgba(184,134,47,.06)", border: "1px solid rgba(184,134,47,.26)" }}>{svc.icon}</div>
        <Badge color="gold">قريباً على حاجز</Badge>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: T.text, margin: "18px 0 10px" }}>{svc.label}</h1>
        <p style={{ fontSize: 15, color: T.gray400, lineHeight: 1.9, maxWidth: 440, margin: "0 auto 30px" }}>{svc.teaser}</p>
        <div style={{ display: "flex", gap: 10, maxWidth: 440, margin: "0 auto" }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="بريدك الإلكتروني" dir="ltr"
            style={{ flex: 1, padding: "14px 18px", borderRadius: 14, border: `1.5px solid ${T.gray200}`, background: T.card, color: T.text, fontSize: 14 }}
            onFocus={e => e.target.style.borderColor = T.gold} onBlur={e => e.target.style.borderColor = T.gray200} />
          <Btn onClick={() => { if (email.includes("@")) { toastCtx && toastCtx.addToast("تمام — سنخبرك أول ما تنطلق ✨", "success"); setEmail(""); } }}>أشعرني</Btn>
        </div>
        <p style={{ fontSize: 12, color: T.gray400, marginTop: 16 }}>ضمن {svc.eta} · طيران وفنادق متاحة الآن للحجز</p>
      </div>
    </PageWrap>
  );
};

// ═══ OTA-STANDARD SEARCH WIDGETS (Trip.com / Booking.com parity) ═══
const AIRPORTS = [
  { c: "KRT", city: "الخرطوم", n: "الخرطوم الدولي", cc: "السودان" },
  { c: "PZU", city: "بورتسودان", n: "بورتسودان الجديد", cc: "السودان" },
  { c: "JED", city: "جدة", n: "الملك عبدالعزيز الدولي", cc: "السعودية" },
  { c: "MED", city: "المدينة المنورة", n: "الأمير محمد بن عبدالعزيز", cc: "السعودية" },
  { c: "RUH", city: "الرياض", n: "الملك خالد الدولي", cc: "السعودية" },
  { c: "DXB", city: "دبي", n: "دبي الدولي", cc: "الإمارات" },
  { c: "AUH", city: "أبوظبي", n: "زايد الدولي", cc: "الإمارات" },
  { c: "DOH", city: "الدوحة", n: "حمد الدولي", cc: "قطر" },
  { c: "CAI", city: "القاهرة", n: "القاهرة الدولي", cc: "مصر" },
  { c: "IST", city: "إسطنبول", n: "إسطنبول الدولي", cc: "تركيا" },
  { c: "ADD", city: "أديس أبابا", n: "بولي الدولي", cc: "إثيوبيا" },
  { c: "NBO", city: "نيروبي", n: "جومو كينياتا", cc: "كينيا" },
];
const HOTEL_CITIES = ["مكة المكرمة", "المدينة المنورة", "جدة", "الرياض", "دبي", "أبوظبي", "الدوحة", "القاهرة", "إسطنبول", "الخرطوم", "بورتسودان"];
const CABINS = { economy: "اقتصادية", premium: "اقتصادية مميزة", business: "رجال أعمال", first: "أولى" };




// ═══ SEGMENTED BAR CELLS — Booking.com-style unified bar, luxury skin ═══
const BarCell = ({ icon, children, grow = 1, last, minW = 0 }) => (
  <div style={{ flex: grow, minWidth: minW, display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderLeft: last ? "none" : "1px solid rgba(184,134,47,.16)", position: "relative" }}>
    <span style={{ fontSize: 16, color: T.gold, flexShrink: 0 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);
const CellLabel = ({ children }) => <div style={{ fontSize: 10, color: T.gray400, marginBottom: 1, fontWeight: 600 }}>{children}</div>;
const cellInput = { width: "100%", background: "transparent", border: "none", fontSize: 14, fontWeight: 700, color: T.text, padding: 0 };

// Airport cell — inline autocomplete inside the bar
const AirportCell = ({ label, value, onSelect, exclude, icon }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = AIRPORTS.filter(a => a.c !== exclude?.c && (q.length < 1 || a.city.includes(q) || a.c.toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderLeft: "1px solid rgba(12,27,46,.08)" }}>
        <span style={{ fontSize: 16, color: T.gold }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CellLabel>{label}</CellLabel>
          <input value={open ? q : (value ? `${value.city} (${value.c})` : "")}
            onChange={e => { setQ(e.target.value); }}
            onFocus={() => { setQ(""); setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 180)}
            placeholder="المدينة أو المطار" style={cellInput} />
        </div>
      </div>
      {open && list.length > 0 && (
        <div className="scale-in" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 290, background: "#FFFFFF", border: "1px solid rgba(184,134,47,.22)", borderRadius: 16, boxShadow: "0 24px 60px rgba(12,27,46,.18)", zIndex: 300, maxHeight: 300, overflowY: "auto" }}>
          {list.map(a => (
            <div key={a.c} onMouseDown={() => { onSelect(a); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", borderBottom: `1px solid ${T.gray100}` }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <span className="num" style={{ minWidth: 44, textAlign: "center", fontSize: 12, fontWeight: 700, color: T.goldLight, background: "rgba(184,134,47,.12)", borderRadius: 8, padding: "4px 0" }}>{a.c}</span>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{a.city}</div>
                <div style={{ fontSize: 11, color: T.gray400 }}>{a.n} · {a.cc}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SwapBtn = ({ onClick }) => (
  <button onClick={onClick} title="تبديل الاتجاه"
    style={{ position: "relative", zIndex: 2, width: 34, height: 34, margin: "0 -17px", borderRadius: "50%", background: "#FFFFFF", border: "1.5px solid rgba(184,134,47,.45)", color: T.goldDark, fontSize: 14, alignSelf: "center", flexShrink: 0, transition: "var(--tr)" }}
    onMouseEnter={e => e.currentTarget.style.transform = "rotate(180deg)"}
    onMouseLeave={e => e.currentTarget.style.transform = "rotate(0deg)"}>⇄</button>
);

// Full flight search block — one/round/multi (OTA standard) — reused by Hero + FlightsPage
const FlightSearchBlock = ({ initial, onSubmit, compact }) => {
  const [tripType, setTripType] = useState(initial?.tripType || "round");
  const [fromA, setFromA] = useState(initial?.from || AIRPORTS[0]);
  const [toA, setToA] = useState(initial?.to || AIRPORTS[2]);
  const [dep, setDep] = useState(initial?.dep || "");
  const [ret, setRet] = useState(initial?.ret || "");
  const [segments, setSegments] = useState(initial?.segments || [
    { from: AIRPORTS[0], to: AIRPORTS[2], date: "" },
    { from: AIRPORTS[2], to: AIRPORTS[5], date: "" },
  ]);
  const [pax, setPax] = useState(initial?.pax || { adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState(initial?.cabin || "economy");
  const [paxOpen, setPaxOpen] = useState(false);
  const total = pax.adults + pax.children + pax.infants;

  const setSeg = (i, patch) => setSegments(s => s.map((x, y) => y === i ? { ...x, ...patch } : x));
  const canGo = tripType === "multi"
    ? segments.every(s => s.from && s.to && s.date)
    : fromA && toA && dep && (tripType !== "round" || ret);

  const bar = { display: "flex", alignItems: "stretch", background: "#FFFFFF", border: "1px solid rgba(184,134,47,.25)", borderRadius: 16, overflow: "visible", boxShadow: "0 6px 24px rgba(12,27,46,.08)" };

  const PaxCell = (
    <div style={{ position: "relative", minWidth: 168 }}>
      <button onClick={() => setPaxOpen(!paxOpen)} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "transparent", textAlign: "right", borderLeft: "1px solid rgba(12,27,46,.08)" }}>
        <span style={{ fontSize: 16, color: T.gold }}>👥</span>
        <div style={{ flex: 1 }}>
          <CellLabel>المسافرون والدرجة</CellLabel>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{total} مسافر · {CABINS[cabin]}</div>
        </div>
        <span style={{ fontSize: 9, color: T.gray400 }}>{paxOpen ? "▲" : "▼"}</span>
      </button>
      {paxOpen && (
        <div className="scale-in" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 300, background: "#FFFFFF", border: "1px solid rgba(184,134,47,.22)", borderRadius: 16, boxShadow: "0 24px 60px rgba(12,27,46,.18)", zIndex: 300, padding: 16 }}>
          <Counter label="بالغون" sub="12 سنة فأكثر" value={pax.adults} setValue={v => setPax({ ...pax, adults: v, infants: Math.min(pax.infants, v) })} min={1} max={9} />
          <Counter label="أطفال" sub="2 - 11 سنة" value={pax.children} setValue={v => setPax({ ...pax, children: v })} max={8} />
          <Counter label="رضّع" sub="أقل من سنتين" value={pax.infants} setValue={v => setPax({ ...pax, infants: Math.min(v, pax.adults) })} max={pax.adults} />
          <div style={{ borderTop: `1px solid ${T.gray100}`, paddingTop: 12, marginTop: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.gray800, marginBottom: 8 }}>درجة المقصورة</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {Object.entries(CABINS).map(([v, l]) => (
                <button key={v} onClick={() => setCabin(v)}
                  style={{ padding: "9px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1.5px solid ${cabin === v ? T.gold : T.gray200}`, background: cabin === v ? "rgba(184,134,47,.10)" : "transparent", color: cabin === v ? T.goldLight : T.gray400 }}>{l}</button>
              ))}
            </div>
          </div>
          <Btn full size="sm" style={{ marginTop: 14 }} onClick={() => setPaxOpen(false)}>تم</Btn>
        </div>
      )}
    </div>
  );

  const submit = () => onSubmit(tripType === "multi"
    ? { tripType, segments, ...pax, cabin }
    : { tripType, from: fromA, to: toA, dep, ret: tripType === "round" ? ret : "", ...pax, cabin });

  return (
    <div>
      {/* Trip type — the 3 standard modes */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["round", "ذهاب وعودة"], ["oneway", "ذهاب فقط"], ["multi", "مدن متعددة"]].map(([t, l]) => (
          <button key={t} onClick={() => setTripType(t)}
            style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: tripType === t ? "rgba(184,134,47,.10)" : "transparent", color: tripType === t ? T.goldDark : "rgba(12,27,46,.5)", border: `1px solid ${tripType === t ? "rgba(184,134,47,.4)" : "rgba(12,27,46,.12)"}` }}>{l}</button>
        ))}
      </div>

      {tripType !== "multi" ? (
        <div style={bar} className="hero-bar">
          <AirportCell label="من" value={fromA} onSelect={setFromA} exclude={toA} icon="🛫" />
          <SwapBtn onClick={() => { const t = fromA; setFromA(toA); setToA(t); }} />
          <AirportCell label="إلى" value={toA} onSelect={setToA} exclude={fromA} icon="🛬" />
          <BarCell icon="📅" minW={128}>
            <CellLabel>الذهاب</CellLabel>
            <input type="date" value={dep} onChange={e => setDep(e.target.value)} style={cellInput} />
          </BarCell>
          {tripType === "round" && (
            <BarCell icon="📅" minW={128}>
              <CellLabel>العودة</CellLabel>
              <input type="date" value={ret} onChange={e => setRet(e.target.value)} style={cellInput} />
            </BarCell>
          )}
          {PaxCell}
          <button onClick={submit} disabled={!canGo}
            style={{ minWidth: 118, borderRadius: "0 16px 16px 0", background: canGo ? `linear-gradient(135deg,${T.gold},${T.goldDark})` : T.gray100, color: canGo ? T.ink : T.gray400, fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "var(--tr)" }}>
            🔍 بحث
          </button>
        </div>
      ) : (
        <div>
          {segments.map((s, i) => (
            <div key={i} style={{ ...bar, marginBottom: 8 }} className="hero-bar">
              <div style={{ display: "flex", alignItems: "center", padding: "0 12px", minWidth: 62 }}>
                <span className="num" style={{ fontSize: 11, fontWeight: 700, color: T.goldDark, background: "rgba(184,134,47,.10)", borderRadius: 8, padding: "4px 9px" }}>رحلة {i + 1}</span>
              </div>
              <AirportCell label="من" value={s.from} onSelect={v => setSeg(i, { from: v })} exclude={s.to} icon="🛫" />
              <AirportCell label="إلى" value={s.to} onSelect={v => setSeg(i, { to: v })} exclude={s.from} icon="🛬" />
              <BarCell icon="📅" minW={128} last={segments.length <= 2}>
                <CellLabel>التاريخ</CellLabel>
                <input type="date" value={s.date} onChange={e => setSeg(i, { date: e.target.value })} style={cellInput} />
              </BarCell>
              {segments.length > 2 && (
                <button onClick={() => setSegments(segments.filter((_, y) => y !== i))}
                  style={{ width: 44, background: "transparent", color: T.red, fontSize: 16 }}>×</button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
            {segments.length < 5 && (
              <button onClick={() => setSegments([...segments, { from: segments[segments.length - 1].to, to: null, date: "" }])}
                style={{ padding: "11px 18px", borderRadius: 13, background: "transparent", border: "1.5px dashed rgba(184,134,47,.45)", color: T.goldDark, fontSize: 13, fontWeight: 700 }}>+ إضافة رحلة</button>
            )}
            <div style={{ ...bar, flex: 1, minWidth: 220 }}>{PaxCell}</div>
            <button onClick={submit} disabled={!canGo}
              style={{ minWidth: 130, borderRadius: 14, background: canGo ? `linear-gradient(135deg,${T.gold},${T.goldDark})` : T.gray100, color: canGo ? T.ink : T.gray400, fontSize: 15, fontWeight: 800 }}>🔍 بحث</button>
          </div>
        </div>
      )}
      <p style={{ fontSize: 11, color: "rgba(12,27,46,.5)", marginTop: 10, textAlign: "right" }}>الأسعار النهائية شاملة الضرائب والرسوم — بدون مفاجآت</p>
    </div>
  );
};

// Hotel search bar — same segmented standard
const HotelSearchBlock = ({ initial, onSubmit }) => {
  const [dest, setDest] = useState(initial?.dest || "مكة المكرمة");
  const [destOpen, setDestOpen] = useState(false);
  const [ci, setCi] = useState(initial?.checkin || "");
  const [co, setCo] = useState(initial?.checkout || "");
  const [occ, setOcc] = useState(initial?.occ || { rooms: 1, adults: 2, childrenAges: [] });
  const [occOpen, setOccOpen] = useState(false);
  const cities = HOTEL_CITIES.filter(c => !dest || c.includes(dest));
  const canGo = dest && ci && co;
  const bar = { display: "flex", alignItems: "stretch", background: "#FFFFFF", border: "1px solid rgba(184,134,47,.25)", borderRadius: 16, boxShadow: "0 6px 24px rgba(12,27,46,.08)" };
  return (
    <div>
      <div style={bar} className="hero-bar">
        <div style={{ position: "relative", flex: 1.4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px" }}>
            <span style={{ fontSize: 16, color: T.gold }}>📍</span>
            <div style={{ flex: 1 }}>
              <CellLabel>الوجهة</CellLabel>
              <input value={dest} onChange={e => { setDest(e.target.value); setDestOpen(true); }}
                onFocus={e => { setDestOpen(true); e.target.select(); }} onBlur={() => setTimeout(() => setDestOpen(false), 160)}
                placeholder="مدينة أو فندق أو معلم" style={cellInput} />
            </div>
          </div>
          {destOpen && cities.length > 0 && (
            <div className="scale-in" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: 260, background: "#FFFFFF", border: "1px solid rgba(184,134,47,.22)", borderRadius: 16, boxShadow: "0 24px 60px rgba(12,27,46,.18)", zIndex: 300, maxHeight: 260, overflowY: "auto" }}>
              {cities.map(c => (
                <div key={c} onMouseDown={() => { setDest(c); setDestOpen(false); }}
                  style={{ padding: "11px 16px", cursor: "pointer", fontSize: 14, fontWeight: 700, color: T.text, borderBottom: `1px solid ${T.gray100}` }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface2} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>🏙️ {c}</div>
              ))}
            </div>
          )}
        </div>
        <BarCell icon="📅" minW={126}>
          <CellLabel>الدخول</CellLabel>
          <input type="date" value={ci} onChange={e => setCi(e.target.value)} style={cellInput} />
        </BarCell>
        <BarCell icon="📅" minW={126}>
          <CellLabel>الخروج</CellLabel>
          <input type="date" value={co} onChange={e => setCo(e.target.value)} style={cellInput} />
        </BarCell>
        <div style={{ position: "relative", minWidth: 178 }}>
          <button onClick={() => setOccOpen(!occOpen)} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "transparent", textAlign: "right", borderLeft: "1px solid rgba(12,27,46,.08)" }}>
            <span style={{ fontSize: 16, color: T.gold }}>🛏️</span>
            <div style={{ flex: 1 }}>
              <CellLabel>الغرف والضيوف</CellLabel>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{occ.rooms} غرفة · {occ.adults + occ.childrenAges.length} ضيف</div>
            </div>
            <span style={{ fontSize: 9, color: T.gray400 }}>{occOpen ? "▲" : "▼"}</span>
          </button>
          {occOpen && (
            <div className="scale-in" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 300, background: "#FFFFFF", border: "1px solid rgba(184,134,47,.22)", borderRadius: 16, boxShadow: "0 24px 60px rgba(12,27,46,.18)", zIndex: 300, padding: 16 }}>
              <Counter label="الغرف" value={occ.rooms} setValue={v => setOcc({ ...occ, rooms: v })} min={1} max={8} />
              <Counter label="البالغون" sub="12+ سنة" value={occ.adults} setValue={v => setOcc({ ...occ, adults: v })} min={1} max={16} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>الأطفال</div><div style={{ fontSize: 12, color: T.gray400 }}>0-11 سنة</div></div>
                <Btn size="sm" variant="gold_outline" onClick={() => setOcc({ ...occ, childrenAges: [...occ.childrenAges, 8] })}>+ طفل</Btn>
              </div>
              {occ.childrenAges.map((age, x) => (
                <div key={x} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: T.gray400, minWidth: 50 }}>طفل {x + 1}</span>
                  <select value={age} onChange={e => setOcc({ ...occ, childrenAges: occ.childrenAges.map((a, y) => y === x ? +e.target.value : a) })}
                    style={{ flex: 1, padding: "8px 12px", border: `1.5px solid ${T.gray200}`, borderRadius: 10, fontSize: 13, background: T.surface2, color: T.text }}>
                    {Array.from({ length: 12 }, (_, a) => <option key={a} value={a}>{a === 0 ? "أقل من سنة" : `${a} سنوات`}</option>)}
                  </select>
                  <button onClick={() => setOcc({ ...occ, childrenAges: occ.childrenAges.filter((_, y) => y !== x) })} style={{ width: 28, height: 28, borderRadius: 8, background: T.redBg, color: T.red }}>×</button>
                </div>
              ))}
              <Btn full size="sm" style={{ marginTop: 8 }} onClick={() => setOccOpen(false)}>تم</Btn>
            </div>
          )}
        </div>
        <button onClick={() => canGo && onSubmit({ dest, checkin: ci, checkout: co, ...occ })} disabled={!canGo}
          style={{ minWidth: 118, borderRadius: "0 16px 16px 0", background: canGo ? `linear-gradient(135deg,${T.gold},${T.goldDark})` : T.gray100, color: canGo ? T.ink : T.gray400, fontSize: 15, fontWeight: 800 }}>🔍 بحث</button>
      </div>
      <p style={{ fontSize: 11, color: "rgba(12,27,46,.5)", marginTop: 10, textAlign: "right" }}>الأسعار شاملة الضرائب · إلغاء مجاني على معظم الغرف · تأكيد فوري</p>
    </div>
  );
};

const Logo = ({ height = 44, light = false }) => (
  light ? (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", borderRadius: 12, padding: "6px 14px", boxShadow: "0 2px 10px rgba(0,0,0,.15)" }}>
      <img src={HAJIZ_LOGO} alt="حاجز" style={{ height: height * 0.82, width: "auto", objectFit: "contain", display: "block" }} />
    </div>
  ) : (
    <img src={HAJIZ_LOGO} alt="حاجز" style={{ height, width: "auto", objectFit: "contain", display: "block" }} />
  )
);

// ─── PRIMITIVES ──────────────────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", size = "md", disabled, full, style = {}, type }) => {
  const sizes = { sm: "9px 18px", md: "13px 26px", lg: "16px 36px" };
  const fs = { sm: 13, md: 15, lg: 16 };
  const variants = {
    primary: { background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, color: T.ink, boxShadow: `0 4px 14px ${T.gold}44` },
    dark: { background: T.navy, color: T.pure },
    outline: { background: "transparent", color: T.text, border: `1.5px solid ${T.gray200}` },
    gold_outline: { background: "transparent", color: T.goldDark, border: `1.5px solid ${T.gold}` },
    ghost: { background: T.gray100, color: T.gray800 },
    success: { background: T.green, color: T.pure },
    danger: { background: T.red, color: T.pure },
    whatsapp: { background: "#25D366", color: T.pure },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, fontWeight: 600, fontSize: fs[size], padding: sizes[size], transition: "all .2s", width: full ? "100%" : "auto", opacity: disabled ? 0.5 : 1, ...variants[variant], ...style }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
      {children}
    </button>
  );
};

const Spinner = ({ color = T.gold, size = 18 }) => (
  <span style={{ display: "inline-block", width: size, height: size, border: `2.5px solid ${color}33`, borderTopColor: color, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
);

const Field = ({ label, value, onChange, placeholder, type = "text", icon, note, error, dir, required }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.gray800, marginBottom: 7 }}>{label}{required && <span style={{ color: T.red }}> *</span>}</label>}
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 17, color: T.gold, pointerEvents: "none" }}>{icon}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} dir={dir}
        style={{ width: "100%", padding: icon ? "13px 44px 13px 16px" : "13px 16px", border: `1.5px solid ${error ? T.red : T.gray200}`, borderRadius: 12, fontSize: 15, color: T.text, background: T.card, transition: "border-color .2s" }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = error ? T.red : T.gray200} />
    </div>
    {note && <p style={{ fontSize: 12, color: T.gray400, marginTop: 5 }}>{note}</p>}
    {error && <p style={{ fontSize: 12, color: T.red, marginTop: 5 }}>{error}</p>}
  </div>
);

const Picker = ({ label, value, onChange, options, icon, required }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: T.gray800, marginBottom: 7 }}>{label}{required && <span style={{ color: T.red }}> *</span>}</label>}
    <div style={{ position: "relative" }}>
      {icon && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 17, color: T.gold, pointerEvents: "none" }}>{icon}</span>}
      <select value={value} onChange={onChange}
        style={{ width: "100%", padding: icon ? "13px 44px 13px 16px" : "13px 16px", border: `1.5px solid ${T.gray200}`, borderRadius: 12, fontSize: 15, color: T.text, background: T.card, appearance: "none", cursor: "pointer" }}
        onFocus={e => e.target.style.borderColor = T.gold}
        onBlur={e => e.target.style.borderColor = T.gray200}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: T.gray400, pointerEvents: "none", fontSize: 12 }}>▼</span>
    </div>
  </div>
);

const Card = ({ children, style = {}, onClick, hover }) => (
  <div onClick={onClick} className={hover ? "hover-lift" : ""}
    style={{ background: T.card, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,.06)", border: `1px solid ${T.gray100}`, cursor: onClick ? "pointer" : "default", ...style }}>
    {children}
  </div>
);

const Badge = ({ children, color = "gold" }) => {
  const c = { gold: { bg: `${T.gold}22`, color: T.goldDark }, green: { bg: T.greenBg, color: T.green }, red: { bg: T.redBg, color: T.red }, navy: { bg: `${T.navy}13`, color: T.text }, gray: { bg: T.gray100, color: T.gray600 }, amber: { bg: T.amberBg, color: T.amber }, blue: { bg: T.blueBg, color: T.blue } };
  return <span style={{ display: "inline-block", padding: "3px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600, ...c[color] }}>{children}</span>;
};

const Counter = ({ value, setValue, min = 0, max = 99, label, sub }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: T.gray400 }}>{sub}</div>}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <button onClick={() => setValue(Math.max(min, value - 1))} style={{ width: 32, height: 32, borderRadius: "50%", background: T.gray100, fontSize: 18, color: T.text, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
      <span style={{ fontSize: 17, fontWeight: 700, color: T.text, minWidth: 22, textAlign: "center" }}>{value}</span>
      <button onClick={() => setValue(Math.min(max, value + 1))} style={{ width: 32, height: 32, borderRadius: "50%", background: T.navy, fontSize: 18, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
    </div>
  </div>
);

const CurrencyToggle = ({ currency, setCurrency, light }) => (
  <div style={{ display: "flex", background: light ? `${T.white}1A` : T.gray100, borderRadius: 10, padding: 3 }}>
    {["SDG", "USD", "AED"].map(c => (
      <button key={c} onClick={() => setCurrency(c)}
        style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: currency === c ? T.gold : "transparent", color: currency === c ? T.ink : (light ? T.pure : T.gray400), transition: "all .2s" }}>{c}</button>
    ))}
  </div>
);

const fmt = (usd, currency = "USD", rates = { sdg: 2400, aed: 3.67 }) => {
  const n = Number(usd) || 0;
  if (currency === "AED") return `${Math.round(n * rates.aed).toLocaleString()} د.إ`;
  if (currency === "SDG") return `${Math.round(n * rates.sdg).toLocaleString()} ج.س`;
  return `$${n.toLocaleString()}`;
};

const Stepper = ({ steps, current }) => (
  <div style={{ display: "flex", alignItems: "center", maxWidth: 640, margin: "0 auto 28px" }}>
    {steps.map((s, i) => (
      <div key={i} style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: i < current ? T.green : i === current ? T.gold : T.gray200, color: i < current ? T.ink : i === current ? T.ink : T.gray400, transition: "all .3s" }}>
            {i < current ? "✓" : i + 1}
          </div>
          <span style={{ fontSize: 11, color: i === current ? T.gold : T.gray400, marginTop: 6, fontWeight: i === current ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
        </div>
        {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? T.green : T.gray200, margin: "0 6px", marginBottom: 20 }} />}
      </div>
    ))}
  </div>
);

const PageWrap = ({ title, sub, children, maxW = 1100 }) => (
  <div style={{ maxWidth: maxW, margin: "0 auto", padding: "40px 24px 20px" }} className="fade-in">
    {title && (
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text }}>{title}</h1>
        {sub && <p style={{ fontSize: 15, color: T.gray400, marginTop: 6 }}>{sub}</p>}
      </div>
    )}
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════
// PAYMENT GATEWAY — every method is a real working flow
// Bankak: reference + 15min timer + receipt upload + waiting
// Visa/MC: card form  ·  Apple Pay / Google Pay: device sheets
// ═══════════════════════════════════════════════════════════

const PaymentGateway = ({ total, currency, rates, summary, onConfirmed, onBack }) => {
  const { user } = useAuth();
  const [method, setMethod] = useState(null); // null until chosen
  const ALL_METHODS = [
    { id: "bankak", icon: "🏦", name: "بنكك", desc: "تحويل محلي — تأكيد يدوي خلال 30 دقيقة", tag: "متاح الآن" },
    { id: "card", icon: "💳", name: "فيزا / ماستركارد", desc: "بطاقات دولية", tag: "قريباً" },
    { id: "apple", icon: "", emoji: "🍎", name: "Apple Pay", desc: "الدفع بلمسة", tag: "قريباً" },
    { id: "google", icon: "", emoji: "🇬", name: "Google Pay", desc: "محفظة جوجل", tag: "قريباً" },
    { id: "bnpl", icon: "📅", name: "تقسيط 2-4 دفعات", desc: "Tabby / Tamara", tag: "تحديث قادم" },
  ];
  const methods = ALL_METHODS.map(m => ({ ...m, disabled: !PAYMENT_CONFIG.enabled.includes(m.id) }));

  if (method === "bankak") return <BankakPayment total={total} currency={currency} rates={rates} summary={summary} currentUser={user} onConfirmed={onConfirmed} onBack={() => setMethod(null)} />;
  if (method === "card") return <CardPayment total={total} currency={currency} rates={rates} onConfirmed={onConfirmed} onBack={() => setMethod(null)} />;
  if (method === "apple") return <WalletPayment kind="apple" total={total} currency={currency} rates={rates} onConfirmed={onConfirmed} onBack={() => setMethod(null)} />;
  if (method === "google") return <WalletPayment kind="google" total={total} currency={currency} rates={rates} onConfirmed={onConfirmed} onBack={() => setMethod(null)} />;

  return (
    <div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 6 }}>اختر طريقة الدفع</h3>
      <p style={{ fontSize: 13, color: T.gray400, marginBottom: 18 }}>المبلغ المطلوب: <strong style={{ color: T.gold, fontSize: 16 }}>{fmt(total, currency, rates)}</strong></p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {methods.map(m => (
          <div key={m.id} onClick={() => !m.disabled && setMethod(m.id)}
            style={{ padding: "16px 18px", borderRadius: 14, cursor: m.disabled ? "not-allowed" : "pointer", transition: "all .2s", border: `2px solid ${T.gray200}`, background: m.disabled ? T.gray50 : T.card, display: "flex", alignItems: "center", gap: 14, opacity: m.disabled ? 0.6 : 1 }}
            onMouseEnter={e => !m.disabled && (e.currentTarget.style.borderColor = T.gold)}
            onMouseLeave={e => !m.disabled && (e.currentTarget.style.borderColor = T.gray200)}>
            <span style={{ fontSize: 26 }}>{m.icon || m.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{m.name}</span>
                {m.tag && <Badge color="gold">{m.tag}</Badge>}
              </div>
              <div style={{ fontSize: 12, color: T.gray400 }}>{m.desc}</div>
            </div>
            <span style={{ color: T.gray300, fontSize: 18 }}>‹</span>
          </div>
        ))}
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: T.gray400, marginTop: 16 }}>🔒 جميع المعاملات مشفّرة وآمنة</p>
    </div>
  );
};

// ── BANKAK: the full required flow ───────────────────────────
const BankakPayment = ({ total, currency, rates, summary, onConfirmed, onBack, currentUser }) => {
  const [stage, setStage] = useState("instructions"); // instructions → upload → waiting
  const [timeLeft, setTimeLeft] = useState(900); // 15 minutes
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const genRef = () => {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
    const seq = String(Math.floor(Math.random()*9999)+1).padStart(4,"0");
    return `HJZ-${ymd}-${seq}`;
  };
  const [ref] = useState(genRef);
  const [realFile, setRealFile] = useState(null);
  const fileInputRef = useRef(null);
  const bankAccount = "1234 5678 9012"; // Hajiz Bankak account (placeholder)

  useEffect(() => {
    if (stage !== "instructions" && stage !== "upload") return;
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => (p <= 1 ? (clearInterval(t), 0) : p - 1)), 1000);
    return () => clearInterval(t);
  }, [stage, timeLeft]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");
  const pct = (timeLeft / 900) * 100;
  const expired = timeLeft <= 0;

  const doUpload = () => { fileInputRef.current?.click(); };
  const onFilePicked = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRealFile(f);
    setUploaded(true);
    setFileName(f.name);
  };
  const submit = async () => {
    setVerifying(true);
    try {
      const bookingRes = await createBooking({ ...(summary || {}), title: summary?.title || "حجز", price: total, ref }, currentUser);
      let receiptPath = null;
      if (realFile && currentUser) {
        const up = await uploadReceipt(realFile, currentUser, ref);
        if (up.ok) receiptPath = up.path;
      }
      if (bookingRes.ok) {
        await createPayment(bookingRes.booking.id, { reference: ref, amount: total, currency: "SDG", receiptPath });
      }
    } catch (err) {
      console.error("Payment save error:", err);
    }
    setVerifying(false);
    setStage("waiting");
    if (onConfirmed) onConfirmed();
  };

  if (stage === "waiting") return (
    <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 60, marginBottom: 18, animation: "pulse 2s infinite" }}>⏳</div>
      <h3 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 10 }}>في انتظار مراجعة دفعتك</h3>
      <p style={{ fontSize: 14, color: T.gray600, lineHeight: 1.8, marginBottom: 22, maxWidth: 380, margin: "0 auto 22px" }}>
        استلمنا إيصالك. فريق المالية في حاجز يراجعه الآن يدوياً للتأكد. ستصلك رسالة تأكيد بالبريد وعبر واتساب خلال <strong>30 دقيقة</strong> كحد أقصى، وتُضاف تذكرتك في "رحلاتي".
      </p>
      <Card style={{ padding: 18, background: T.navy, maxWidth: 340, margin: "0 auto 20px" }}>
        <div style={{ color: `${T.white}99`, fontSize: 12 }}>رقم الحجز — احتفظ به</div>
        <div style={{ color: T.gold, fontSize: 24, fontWeight: 800, letterSpacing: "0.12em" }}>{ref}</div>
      </Card>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn onClick={onConfirmed}>الذهاب لرحلاتي</Btn>
        <Btn variant="whatsapp" onClick={() => {}}>📱 متابعة عبر واتساب</Btn>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ color: T.gold, fontSize: 13, fontWeight: 600, marginBottom: 16, background: "none" }}>← طرق دفع أخرى</button>

      {/* Reference + Timer card */}
      <Card style={{ padding: 24, background: T.navy, marginBottom: 18, textAlign: "center" }}>
        <p style={{ color: `${T.white}99`, fontSize: 13, marginBottom: 6 }}>رقم المرجع</p>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.gold, letterSpacing: "0.15em", marginBottom: 14 }}>{ref}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: `${T.white}12`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: `${T.white}99`, fontSize: 11 }}>المبلغ</div>
            <div style={{ color: T.gold, fontSize: 16, fontWeight: 700 }}>${total.toLocaleString()}</div>
          </div>
          <div style={{ background: `${T.white}12`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ color: `${T.white}99`, fontSize: 11 }}>حساب حاجز - بنكك</div>
            <div style={{ color: T.pure, fontSize: 15, fontWeight: 700, letterSpacing: "0.05em" }}>{bankAccount}</div>
          </div>
        </div>
        {!expired ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: timeLeft < 120 ? "#FF6B6B" : T.gold }}>{mins}:{secs}</div>
              <span style={{ color: `${T.white}99`, fontSize: 13 }}>متبقي لإتمام الدفع</span>
            </div>
            <div style={{ height: 5, background: `${T.white}1A`, borderRadius: 3, marginTop: 12, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: timeLeft < 120 ? "#FF6B6B" : T.gold, transition: "width 1s linear" }} />
            </div>
          </>
        ) : (
          <div style={{ padding: "12px", background: "#FF6B6B22", borderRadius: 10, color: "#FF6B6B", fontSize: 14, fontWeight: 600 }}>
            ⏰ انتهى الوقت — ابدأ الحجز من جديد للحصول على رقم مرجع جديد
          </div>
        )}
      </Card>

      {!expired && <>
        {/* Steps */}
        <Card style={{ padding: 22, marginBottom: 16 }}>
          <h4 style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 14 }}>خطوات الدفع عبر بنكك</h4>
          {[
            ["١", `افتح تطبيق بنكك وحوّل المبلغ لحساب حاجز: ${bankAccount}`],
            ["٢", `اكتب رقم المرجع في خانة الملاحظات/البيان: ${ref}`],
            ["٣", "صوّر إيصال التحويل (screenshot أو صورة)"],
            ["٤", "ارفع الإيصال هنا قبل انتهاء الوقت"],
          ].map(([n, txt]) => (
            <div key={n} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: T.navy, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{n}</div>
              <span style={{ fontSize: 14, color: T.gray800, lineHeight: 1.5, paddingTop: 2 }}>{txt}</span>
            </div>
          ))}
        </Card>

        {/* Upload */}
        <Card style={{ padding: 22, marginBottom: 18, border: `2px dashed ${uploaded ? T.green : T.gold}`, background: uploaded ? T.greenBg : T.card }}>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={onFilePicked} />
          {!uploaded ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📎</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 4 }}>رفع إيصال التحويل</p>
              <p style={{ fontSize: 12, color: T.gray400, marginBottom: 16 }}>JPG · PNG · PDF (حتى 10 ميجابايت)</p>
              <Btn onClick={doUpload} disabled={uploading}>{uploading ? <><Spinner size={16} /> جاري الرفع...</> : "⬆️ اختر ملف الإيصال"}</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14, justifyContent: "center" }}>
              <div style={{ fontSize: 36 }}>✅</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: T.green }}>تم رفع الإيصال</p>
                <p style={{ fontSize: 12, color: T.gray500 }}>{fileName} · <button onClick={() => { setUploaded(false); setFileName(""); }} style={{ color: T.gold, background: "none", fontSize: 12 }}>تغيير</button></p>
              </div>
            </div>
          )}
        </Card>

        <Btn full size="lg" disabled={!uploaded || verifying} onClick={submit}>
          {verifying ? <><Spinner size={16} /> جاري الإرسال للمراجعة...</> : "✅ إرسال للمراجعة"}
        </Btn>
        <p style={{ textAlign: "center", fontSize: 12, color: T.gray400, marginTop: 12 }}>
          🔒 يراجع فريق المالية كل دفعة يدوياً — لا تأكيد تلقائي لضمان حقوقك
        </p>
      </>}
    </div>
  );
};

// ── CARD (Visa/Mastercard/mada) ──────────────────────────────
const CardPayment = ({ total, currency, rates, onConfirmed, onBack }) => {
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const fmtCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d; };
  const valid = card.number.replace(/\s/g, "").length === 16 && card.name && card.expiry.length === 5 && card.cvv.length >= 3;

  const pay = () => { setProcessing(true); setTimeout(() => { setProcessing(false); setDone(true); setTimeout(onConfirmed, 1600); }, 2200); };

  if (done) return (
    <div className="fade-in" style={{ textAlign: "center", padding: "30px 0" }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
      <h3 style={{ fontSize: 22, fontWeight: 700, color: T.green, marginBottom: 8 }}>تم الدفع بنجاح</h3>
      <p style={{ fontSize: 14, color: T.gray600 }}>جاري تأكيد حجزك وتحويلك...</p>
    </div>
  );

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ color: T.gold, fontSize: 13, fontWeight: 600, marginBottom: 16, background: "none" }}>← طرق دفع أخرى</button>

      {/* Visual card */}
      <div style={{ background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, borderRadius: 18, padding: 24, marginBottom: 22, color: T.pure, minHeight: 160, position: "relative", boxShadow: "0 10px 30px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
          <div style={{ width: 44, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${T.gold}, ${T.goldDark})` }} />
          <span style={{ fontSize: 13, letterSpacing: "0.1em", opacity: 0.8 }}>{currency} {total.toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 20, letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 18, direction: "ltr", textAlign: "left" }}>
          {card.number || "•••• •••• •••• ••••"}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", direction: "ltr" }}>
          <div><div style={{ fontSize: 9, opacity: 0.6 }}>CARDHOLDER</div><div style={{ fontSize: 13 }}>{card.name || "YOUR NAME"}</div></div>
          <div><div style={{ fontSize: 9, opacity: 0.6 }}>EXPIRES</div><div style={{ fontSize: 13 }}>{card.expiry || "MM/YY"}</div></div>
        </div>
      </div>

      <Field label="رقم البطاقة" value={card.number} onChange={e => setCard({ ...card, number: fmtCard(e.target.value) })} placeholder="0000 0000 0000 0000" icon="💳" dir="ltr" />
      <Field label="الاسم على البطاقة" value={card.name} onChange={e => setCard({ ...card, name: e.target.value.toUpperCase() })} placeholder="FULL NAME" icon="👤" dir="ltr" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="تاريخ الانتهاء" value={card.expiry} onChange={e => setCard({ ...card, expiry: fmtExp(e.target.value) })} placeholder="MM/YY" icon="📅" dir="ltr" />
        <Field label="CVV" value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="123" icon="🔒" type="password" dir="ltr" />
      </div>

      <Btn full size="lg" disabled={!valid || processing} onClick={pay} style={{ marginTop: 6 }}>
        {processing ? <><Spinner size={16} /> جاري معالجة الدفع...</> : `ادفع ${fmt(total, currency, rates)}`}
      </Btn>
      <p style={{ textAlign: "center", fontSize: 12, color: T.gray400, marginTop: 12 }}>🔒 معاملة مشفّرة بمعيار PCI DSS</p>
    </div>
  );
};

// ── WALLET (Apple Pay / Google Pay) ──────────────────────────
const WalletPayment = ({ kind, total, currency, rates, onConfirmed, onBack }) => {
  const [stage, setStage] = useState("ready"); // ready → authenticating → done
  const isApple = kind === "apple";
  const brand = isApple ? "Apple Pay" : "Google Pay";
  const emoji = isApple ? "🍎" : "🇬";

  const pay = () => {
    setStage("authenticating");
    setTimeout(() => { setStage("done"); setTimeout(onConfirmed, 1500); }, 2200);
  };

  return (
    <div className="fade-in">
      <button onClick={onBack} style={{ color: T.gold, fontSize: 13, fontWeight: 600, marginBottom: 16, background: "none" }}>← طرق دفع أخرى</button>
      <div style={{ textAlign: "center", padding: "20px 0" }}>
        {stage === "ready" && <>
          <div style={{ width: 90, height: 90, borderRadius: 24, background: isApple ? "#000" : T.card, border: isApple ? "none" : `2px solid ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(0,0,0,.15)" }}>{emoji}</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>الدفع عبر {brand}</h3>
          <p style={{ fontSize: 14, color: T.gray600, marginBottom: 6 }}>المبلغ: <strong style={{ color: T.gold }}>{fmt(total, currency, rates)}</strong></p>
          <p style={{ fontSize: 13, color: T.gray400, marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
            اضغط الزر بالأسفل لفتح {brand} وتأكيد الدفع ببصمتك أو وجهك
          </p>
          <button onClick={pay} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, background: isApple ? "#000" : T.navy, color: T.pure, borderRadius: 14, padding: "16px 40px", fontSize: 17, fontWeight: 600, minWidth: 240 }}>
            <span style={{ fontSize: 22 }}>{emoji}</span> ادفع عبر {brand}
          </button>
        </>}
        {stage === "authenticating" && <div style={{ padding: "30px 0" }}>
          <Spinner size={48} color={T.gold} />
          <p style={{ fontSize: 15, color: T.gray600, marginTop: 20 }}>جاري التحقق عبر {brand}...</p>
          <p style={{ fontSize: 13, color: T.gray400, marginTop: 6 }}>أكّد ببصمتك على جهازك</p>
        </div>}
        {stage === "done" && <div className="fade-in" style={{ padding: "30px 0" }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: T.green, marginBottom: 8 }}>تم الدفع بنجاح</h3>
          <p style={{ fontSize: 14, color: T.gray600 }}>جاري تأكيد حجزك...</p>
        </div>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HOTELS — built to real OTA API standards
// occupancies (rooms/adults/children + ages), board types,
// cancellation policies, rateType (RECHECK), taxes,
// pay now/later/at property, full filter set
// ═══════════════════════════════════════════════════════════

// Mock data shaped exactly like Hotelbeds/Booking.com responses
const HOTELS_DB = [
  {
    code: 3424, name: "سويس أوتيل المقام مكة", categoryCode: "5EST", stars: 5,
    destinationName: "مكة المكرمة", zoneName: "العزيزية", distance: "بجوار الحرم · 200م",
    latitude: 21.4225, longitude: 39.8262, guestRating: 9.2, reviews: 1840,
    images: ["🕌"], amenities: ["wifi", "breakfast", "parking", "ac", "shuttle"],
    description: "فندق فاخر يطل على الحرم المكي مباشرة، يوفر غرفاً واسعة وخدمة متميزة على مدار الساعة.",
    checkInHour: "15:00", checkOutHour: "12:00",
    fees: "ضريبة بلدية 2.5% تُدفع في الفندق. يتطلب بطاقة ائتمانية عند الوصول للنثريات.",
    rooms: [
      { code: "DBL.ST", name: "غرفة مزدوجة قياسية", capacity: 2,
        rates: [
          { rateKey: "rk1", boardName: "مع الإفطار", boardCode: "BB", rateType: "BOOKABLE", net: 235, allotment: 5, paymentType: "AT_WEB", payOption: "now",
            cancellation: { type: "free", until: "2026-07-01", text: "إلغاء مجاني حتى 1 يوليو" }, taxes: { included: true, amount: 12 } },
          { rateKey: "rk2", boardName: "غرفة فقط", boardCode: "RO", rateType: "BOOKABLE", net: 210, allotment: 8, paymentType: "AT_WEB", payOption: "property",
            cancellation: { type: "nonref", text: "غير قابل للاسترداد" }, taxes: { included: true, amount: 10 } },
        ] },
      { code: "SUITE", name: "جناح يطل على الحرم", capacity: 3,
        rates: [
          { rateKey: "rk3", boardName: "نصف إقامة", boardCode: "HB", rateType: "RECHECK", net: 420, allotment: 2, paymentType: "AT_WEB", payOption: "now",
            cancellation: { type: "partial", until: "2026-06-29", text: "إلغاء جزئي حتى 29 يونيو (رسوم ليلة)" }, taxes: { included: true, amount: 21 } },
        ] },
    ],
  },
  {
    code: 168, name: "هيلتون سويتس مكة", categoryCode: "5EST", stars: 5,
    destinationName: "مكة المكرمة", zoneName: "إبراهيم الخليل", distance: "إبراهيم الخليل · 600م",
    latitude: 21.4180, longitude: 39.8250, guestRating: 8.7, reviews: 2310,
    images: ["🏨"], amenities: ["wifi", "breakfast", "ac", "gym"],
    description: "يقع على بُعد دقائق من الحرم، يوفر أجنحة عصرية مع مطبخ صغير وإطلالات بانورامية.",
    checkInHour: "15:00", checkOutHour: "12:00",
    fees: "لا توجد رسوم إضافية. الإفطار اختياري.",
    rooms: [
      { code: "STD", name: "غرفة ستوديو", capacity: 2,
        rates: [
          { rateKey: "rk4", boardName: "غرفة فقط", boardCode: "RO", rateType: "BOOKABLE", net: 180, allotment: 12, paymentType: "AT_WEB", payOption: "later",
            cancellation: { type: "free", until: "2026-07-02", text: "إلغاء مجاني حتى 2 يوليو" }, taxes: { included: true, amount: 9 } },
          { rateKey: "rk5", boardName: "مع الإفطار", boardCode: "BB", rateType: "BOOKABLE", net: 205, allotment: 6, paymentType: "AT_WEB", payOption: "now",
            cancellation: { type: "free", until: "2026-07-02", text: "إلغاء مجاني حتى 2 يوليو" }, taxes: { included: true, amount: 11 } },
        ] },
    ],
  },
  {
    code: 990, name: "موفنبيك واحة جدة", categoryCode: "5EST", stars: 5,
    destinationName: "جدة", zoneName: "الكورنيش", distance: "الكورنيش · على البحر",
    latitude: 21.5810, longitude: 39.1390, guestRating: 8.9, reviews: 1520,
    images: ["🌊"], amenities: ["wifi", "breakfast", "pool", "parking", "ac", "gym"],
    description: "منتجع على الواجهة البحرية بجدة، مع مسبح خارجي وإطلالات على البحر الأحمر.",
    checkInHour: "16:00", checkOutHour: "12:00",
    fees: "ضريبة سياحية 5% تُدفع في الفندق.",
    rooms: [
      { code: "SEA", name: "غرفة بإطلالة بحرية", capacity: 2,
        rates: [
          { rateKey: "rk6", boardName: "مع الإفطار", boardCode: "BB", rateType: "BOOKABLE", net: 165, allotment: 10, paymentType: "AT_WEB", payOption: "now",
            cancellation: { type: "free", until: "2026-07-03", text: "إلغاء مجاني حتى 3 يوليو" }, taxes: { included: true, amount: 8 } },
        ] },
    ],
  },
];

const AMENITY_LABELS = { wifi: "📶 واي فاي", breakfast: "🍳 إفطار", parking: "🚗 موقف", ac: "❄️ تكييف", pool: "🏊 مسبح", gym: "💪 صالة", shuttle: "🚐 مواصلات للحرم" };
const BOARD_COLORS = { BB: "green", RO: "gray", HB: "blue", FB: "gold" };

const HotelsPage = ({ currency, rates, onBook, user, requireAuth, prefill }) => {
  const [phase, setPhase] = useState("search"); // search | results | detail | book
  const [searching, setSearching] = useState(false);
  const hydratedH = useRef(0);
  // Search params — matching real API: occupancies (rooms/adults/children+ages)
  const [dest, setDest] = useState("مكة المكرمة");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [rooms, setRooms] = useState(1);
  const [adults, setAdults] = useState(2);
  const [childrenAges, setChildrenAges] = useState([]); // array of ages — API standard
  const [showGuests, setShowGuests] = useState(false);

  useEffect(() => {
    if (prefill?.svc === "hotels" && prefill.ts !== hydratedH.current) {
      hydratedH.current = prefill.ts;
      const q = prefill.params;
      setDest(q.dest); setCheckin(q.checkin); setCheckout(q.checkout);
      setRooms(q.rooms); setAdults(q.adults); setChildrenAges(q.childrenAges || []);
      setSearching(true); setPhase("results"); setTimeout(() => setSearching(false), 1100);
    }
  }, [prefill]);
  // Results filters
  const [filters, setFilters] = useState({ minStars: 0, maxPrice: 1000, amenities: [], freeCancel: false, breakfast: false });
  const [sortBy, setSortBy] = useState("recommended");
  // Selection
  const [hotel, setHotel] = useState(null);
  const [rate, setRate] = useState(null);
  const [rechecking, setRechecking] = useState(false);

  const nights = checkin && checkout ? Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 86400000)) : 3;
  const totalGuests = adults + childrenAges.length;

  const addChild = () => setChildrenAges([...childrenAges, 8]);
  const removeChild = (i) => setChildrenAges(childrenAges.filter((_, idx) => idx !== i));
  const setChildAge = (i, age) => setChildrenAges(childrenAges.map((a, idx) => idx === i ? age : a));

  // Filtered + sorted results
  const results = HOTELS_DB.filter(h => {
    if (filters.minStars && h.stars < filters.minStars) return false;
    const cheapest = Math.min(...h.rooms.flatMap(r => r.rates.map(rt => rt.net)));
    if (cheapest > filters.maxPrice) return false;
    if (filters.amenities.length && !filters.amenities.every(a => h.amenities.includes(a))) return false;
    if (filters.freeCancel && !h.rooms.some(r => r.rates.some(rt => rt.cancellation.type === "free"))) return false;
    if (filters.breakfast && !h.rooms.some(r => r.rates.some(rt => rt.boardCode === "BB"))) return false;
    return true;
  }).sort((a, b) => {
    const pa = Math.min(...a.rooms.flatMap(r => r.rates.map(rt => rt.net)));
    const pb = Math.min(...b.rooms.flatMap(r => r.rates.map(rt => rt.net)));
    if (sortBy === "price_low") return pa - pb;
    if (sortBy === "price_high") return pb - pa;
    if (sortBy === "rating") return b.guestRating - a.guestRating;
    if (sortBy === "stars") return b.stars - a.stars;
    return b.guestRating - a.guestRating; // recommended
  });

  const cheapestRate = (h) => Math.min(...h.rooms.flatMap(r => r.rates.map(rt => rt.net)));

  // ── SEARCH — segmented standard bar ──
  if (phase === "search") return (
    <PageWrap title="حجز الفنادق" sub="أسعار نهائية شاملة الضرائب · إلغاء مجاني على معظم الغرف · تأكيد فوري">
      <Card style={{ padding: "26px 24px", maxWidth: 980, background: "#FFFFFF" }}>
        <HotelSearchBlock
          initial={{ dest, checkin, checkout, occ: { rooms, adults, childrenAges } }}
          onSubmit={(q) => {
            setDest(q.dest); setCheckin(q.checkin); setCheckout(q.checkout);
            setRooms(q.rooms); setAdults(q.adults); setChildrenAges(q.childrenAges || []);
            setSearching(true); setPhase("results"); setTimeout(() => setSearching(false), 1100);
          }} />
      </Card>
      <div style={{ display: "flex", gap: 22, marginTop: 22, flexWrap: "wrap" }}>
        {[["🏷️", "السعر النهائي يشمل الضرائب"], ["🛏️", "board واضح: غرفة فقط / مع إفطار"], ["↩️", "سياسة الإلغاء ظاهرة قبل الدفع"]].map(([ic, tx], x) => (
          <div key={x} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.gray400 }}><span style={{ color: T.gold }}>{ic}</span>{tx}</div>
        ))}
      </div>
    </PageWrap>
  );

  // ── RESULTS ──
  if (phase === "results") return (
    <PageWrap title={`فنادق ${dest}`} sub={`${checkin || "—"} ← ${checkout || "—"} · ${nights} ليالٍ · ${rooms} غرفة · ${totalGuests} ضيف`}>
      <button onClick={() => setPhase("search")} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 20, background: "none" }}>← تعديل البحث</button>
      <FilterBar count={((filters.minStars>0?1:0)+(filters.maxPrice<1000?1:0)+(filters.amenities.length)+(filters.freeCancel?1:0)+(filters.breakfast?1:0))} resultCount={searching ? null : results.length}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: T.gray800, display: "block", marginBottom: 8 }}>تصنيف النجوم</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setFilters({ ...filters, minStars: s })}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${filters.minStars === s ? T.gold : T.gray200}`, background: filters.minStars === s ? "rgba(184,134,47,.10)" : "transparent", color: filters.minStars === s ? T.goldDark : T.gray400 }}>
                  {s === 0 ? "الكل" : `${s}★+`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: T.gray800, display: "block", marginBottom: 8 }}>أقصى سعر/ليلة: <span className="num" style={{ color: T.goldDark }}>{fmt(filters.maxPrice, currency, rates)}</span></label>
            <input type="range" min={50} max={1000} step={25} value={filters.maxPrice} onChange={e => setFilters({ ...filters, maxPrice: +e.target.value })} style={{ width: "100%", accentColor: T.gold }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: T.gray800, display: "block", marginBottom: 8 }}>المرافق</label>
            {Object.entries(AMENITY_LABELS).map(([k, label]) => (
              <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={filters.amenities.includes(k)} onChange={() => setFilters({ ...filters, amenities: filters.amenities.includes(k) ? filters.amenities.filter(a => a !== k) : [...filters.amenities, k] })} style={{ accentColor: T.gold, width: 16, height: 16 }} />
                <span style={{ fontSize: 13, color: T.gray800 }}>{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: T.gray800, display: "block", marginBottom: 8 }}>خيارات</label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={filters.freeCancel} onChange={() => setFilters({ ...filters, freeCancel: !filters.freeCancel })} style={{ accentColor: T.gold, width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: T.gray800 }}>✓ إلغاء مجاني فقط</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={filters.breakfast} onChange={() => setFilters({ ...filters, breakfast: !filters.breakfast })} style={{ accentColor: T.gold, width: 16, height: 16 }} />
              <span style={{ fontSize: 13, color: T.gray800 }}>🍳 إفطار مشمول</span>
            </label>
          </div>
        </FilterBar>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 14, color: T.gray600 }}>
              {searching ? "جاري البحث..." : `${results.length} فندق متاح · الأسعار لليلة شاملة الضرائب`}
            </span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              style={{ padding: "9px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 10, fontSize: 13, background: T.card, color: T.text }}>
              <option value="recommended">الأنسب</option>
              <option value="price_low">السعر: من الأقل</option>
              <option value="price_high">السعر: من الأعلى</option>
              <option value="rating">تقييم النزلاء</option>
              <option value="stars">عدد النجوم</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {searching ? (
              [1, 2, 3].map(i => <SkeletonRow key={i} />)
            ) : results.length === 0 ? (
              <EmptyState icon="🏨" title="لا توجد فنادق بهذه المعايير"
                sub="جرّب توسيع نطاق الأسعار أو إزالة بعض الفلاتر"
                action={() => setFilters({ minStars: 0, maxPrice: 1000, amenities: [], freeCancel: false, breakfast: false })}
                actionLabel="مسح كل الفلاتر" />
            ) : results.map(h => {
              const minRate = h.rooms.flatMap(r => r.rates).reduce((m, r) => r.net < m.net ? r : m);
              return (
                <div key={h.code} style={{ position: "relative" }}>
                  <div style={{ position: "absolute", top: 14, left: 14, zIndex: 2 }}>
                    <FavoriteBtn type="hotel" id={String(h.code)} />
                  </div>
                  <Card hover onClick={() => { setHotel(h); setPhase("detail"); }} style={{ overflow: "hidden", display: "flex", flexDirection: "row" }}>
                    <div style={{ width: 180, minHeight: 140, background: "linear-gradient(145deg, #16345A 0%, #0C1E36 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, flexShrink: 0 }}>{h.images[0]}</div>
                    <div style={{ padding: 18, flex: 1, display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>{Array(h.stars).fill().map((_, i) => <span key={i} style={{ color: T.gold, fontSize: 12 }}>★</span>)}</div>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>{h.name}</h3>
                        <p style={{ fontSize: 13, color: T.gray400, marginBottom: 10 }}>📍 {h.distance}</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          <Badge color={BOARD_COLORS[minRate.boardCode]}>{minRate.boardName}</Badge>
                          {minRate.cancellation.type === "free" && <Badge color="green">✓ إلغاء مجاني</Badge>}
                          {minRate.payOption === "property" && <Badge color="blue">ادفع بالفندق</Badge>}
                          {minRate.payOption === "later" && <Badge color="blue">ادفع لاحقاً</Badge>}
                          {minRate.allotment <= 5 && <Badge color="red">⚡ {minRate.allotment} غرف فقط</Badge>}
                        </div>
                        <RatingBadge value={h.guestRating} count={h.reviews} size="sm" />
                      </div>
                      <div style={{ textAlign: "left", display: "flex", flexDirection: "column", justifyContent: "flex-end", minWidth: 130 }}>
                        <PriceDisplay amount={minRate.net} size="md" label={`${fmt(minRate.net * nights, currency, rates)} / ${nights} ليالٍ · شاملة الضرائب`} />
                        <Btn size="sm" style={{ marginTop: 10 }}>عرض الغرف</Btn>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
    </PageWrap>
  );

  // ── DETAIL (rooms + rates with full API info) ──
  if (phase === "detail" && hotel) return (
    <PageWrap title={hotel.name} sub={`${hotel.destinationName} · ${hotel.distance}`}>
      <button onClick={() => setPhase("results")} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 20, background: "none" }}>← رجوع للنتائج</button>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
        <div>
          <Card style={{ overflow: "hidden", marginBottom: 20 }}>
            <div style={{ height: 220, background: "linear-gradient(145deg, #16345A 0%, #0C1E36 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>{hotel.images[0]}</div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 4 }}>{Array(hotel.stars).fill().map((_, i) => <span key={i} style={{ color: T.gold }}>★</span>)}</div>
                <RatingBadge value={hotel.guestRating} count={hotel.reviews} />
              </div>
              <p style={{ fontSize: 14, color: T.gray600, lineHeight: 1.8, marginBottom: 16 }}>{hotel.description}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {hotel.amenities.map(a => <Badge key={a} color="gray">{AMENITY_LABELS[a]}</Badge>)}
              </div>
            </div>
          </Card>

          {/* Hotel policies — ALL from API */}
          <Card style={{ padding: 22, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>معلومات وسياسات الفندق</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ background: T.bg2, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.gray400 }}>تسجيل الدخول</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>من {hotel.checkInHour}</div>
              </div>
              <div style={{ background: T.bg2, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, color: T.gray400 }}>تسجيل الخروج</div>
                <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>حتى {hotel.checkOutHour}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "12px 14px", background: T.amberBg, borderRadius: 10 }}>
              <span style={{ fontSize: 16 }}>ℹ️</span>
              <p style={{ fontSize: 13, color: T.amber, lineHeight: 1.6 }}>{hotel.fees}</p>
            </div>
          </Card>

          {/* Rooms + rates */}
          <h3 style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 14 }}>الغرف المتاحة</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {hotel.rooms.map(room => (
              <Card key={room.code} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ background: T.bg2, padding: "14px 18px", borderBottom: `1px solid ${T.gray100}` }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{room.name}</div>
                  <div style={{ fontSize: 12, color: T.gray400 }}>👥 تتسع لـ {room.capacity} أشخاص</div>
                </div>
                {room.rates.map(rt => (
                  <div key={rt.rateKey} style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: `1px solid ${T.gray100}`, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                        <Badge color={BOARD_COLORS[rt.boardCode]}>{rt.boardName}</Badge>
                        {rt.cancellation.type === "free" && <Badge color="green">✓ {rt.cancellation.text}</Badge>}
                        {rt.cancellation.type === "partial" && <Badge color="amber">{rt.cancellation.text}</Badge>}
                        {rt.cancellation.type === "nonref" && <Badge color="red">{rt.cancellation.text}</Badge>}
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: T.gray500 }}>
                        <span>{rt.payOption === "now" ? "💳 ادفع الآن" : rt.payOption === "later" ? "📅 ادفع لاحقاً" : "🏨 ادفع في الفندق"}</span>
                        {rt.taxes.included && <span>✓ شامل الضرائب ({fmt(rt.taxes.amount, currency, rates)})</span>}
                        {rt.allotment <= 5 && <span style={{ color: T.red }}>⚡ تبقى {rt.allotment} غرف</span>}
                        {rt.rateType === "RECHECK" && <span style={{ color: T.amber }}>↻ يتطلب تأكيد السعر</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "left", minWidth: 140 }}>
                      <PriceDisplay amount={rt.net} size="sm" label={`${fmt(rt.net * nights, currency, rates)} / ${nights} ليالٍ`} />
                      <Btn size="sm" style={{ marginTop: 8 }} onClick={() => {
                        if (!user) { requireAuth(); return; }
                        if (rt.rateType === "RECHECK") {
                          setRechecking(true);
                          setTimeout(() => { setRechecking(false); setRate({ ...rt, room }); setPhase("book"); }, 1500);
                        } else { setRate({ ...rt, room }); setPhase("book"); }
                      }}>{rechecking ? <Spinner size={14} color={T.ink} /> : "احجز"}</Btn>
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </div>

        {/* Sticky summary */}
        <Card style={{ padding: 22, position: "sticky", top: 90 }} className="summary-sticky">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>تفاصيل إقامتك</h3>
          <div style={{ fontSize: 13, color: T.gray600, lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>الوجهة</span><strong style={{ color: T.text }}>{hotel.destinationName}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>الدخول</span><strong className="num" style={{ color: T.text }}>{checkin || "—"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>الخروج</span><strong className="num" style={{ color: T.text }}>{checkout || "—"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>المدة</span><strong style={{ color: T.text }}>{nights} ليالٍ</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>الإقامة</span><strong style={{ color: T.text }}>{rooms} غرفة · {totalGuests} ضيف</strong></div>
          </div>
          <div style={{ marginTop: 14, padding: "12px 14px", background: T.greenBg, borderRadius: 10, fontSize: 12, color: T.green, lineHeight: 1.6 }}>
            ✓ تأكيد فوري · ✓ أسعار شاملة الضرائب · ✓ دعم عربي 24/7
          </div>
        </Card>
      </div>
    </PageWrap>
  );

  // ── BOOK (guest details + payment) ──
  if (phase === "book" && hotel && rate) {
    const total = rate.net * nights;
    return (
      <PageWrap title="إتمام حجز الفندق" maxW={1000}>
        <Stepper steps={["البحث", "اختيار الغرفة", "البيانات", "الدفع"]} current={2} />
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
          <Card style={{ padding: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 18 }}>بيانات النزيل الرئيسي</h3>
            <HotelGuestForm hotel={hotel} rate={rate} nights={nights} total={total} currency={currency} rates={rates} onBook={onBook} />
          </Card>
          <Card style={{ padding: 22, position: "sticky", top: 90 }} className="summary-sticky">
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{hotel.name}</div>
            <p style={{ fontSize: 12, color: T.gray400, marginBottom: 14 }}>{rate.room.name}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge color={BOARD_COLORS[rate.boardCode]}>{rate.boardName}</Badge>
              {rate.cancellation.type === "free" && <Badge color="green">إلغاء مجاني</Badge>}
            </div>
            <div style={{ fontSize: 13, color: T.gray600, lineHeight: 1.9, borderTop: `1px solid ${T.gray100}`, paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>{fmt(rate.net, currency, rates)} × {nights} ليالٍ</span><span className="num" style={{ direction: "ltr" }}>{fmt(rate.net * nights, currency, rates)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: T.green }}><span>الضرائب والرسوم</span><span>مشمولة ✓</span></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: T.text, paddingTop: 12, marginTop: 8, borderTop: `1px solid ${T.gray200}` }}>
              <span>الإجمالي</span><span className="num" style={{ color: T.gold, direction: "ltr" }}>{fmt(total, currency, rates)}</span>
            </div>
          </Card>
        </div>
      </PageWrap>
    );
  }
  return null;
};

// Guest form → payment gateway (holder shape = Hotelbeds book API)
const HotelGuestForm = ({ hotel, rate, nights, total, currency, rates, onBook }) => {
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "", special: "" });
  const [showPayment, setShowPayment] = useState(false);
  const valid = guest.firstName.trim().length > 1 && guest.lastName.trim().length > 1 && guest.email.includes("@") && guest.phone.length > 6;

  if (showPayment) return (
    <PaymentGateway total={total} currency={currency} rates={rates}
      summary={`${hotel.name} · ${rate.room.name} · ${nights} ليالٍ`}
      onConfirmed={() => onBook({ type: "hotel", title: hotel.name, total })}
      onBack={() => setShowPayment(false)} />
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="search-row">
        <Field label="الاسم الأول (EN)" value={guest.firstName} onChange={e => setGuest({ ...guest, firstName: e.target.value.toUpperCase() })} placeholder="AHMED" icon="👤" dir="ltr" required />
        <Field label="اسم العائلة (EN)" value={guest.lastName} onChange={e => setGuest({ ...guest, lastName: e.target.value.toUpperCase() })} placeholder="ALTAYEB" dir="ltr" required />
      </div>
      <Field label="البريد الإلكتروني" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} placeholder="you@email.com" icon="📧" type="email" dir="ltr" required />
      <Field label="رقم الهاتف (واتساب)" value={guest.phone} onChange={e => setGuest({ ...guest, phone: e.target.value })} placeholder="+249 9xxxxxxxx" icon="📱" dir="ltr" required />
      <Field label="طلبات خاصة (اختياري)" value={guest.special} onChange={e => setGuest({ ...guest, special: e.target.value })} placeholder="سرير إضافي، طابق عالٍ، غرف متجاورة..." icon="📝" note="تُرسل للفندق ولا تُعد مؤكدة حتى موافقته" />
      <Btn full size="lg" disabled={!valid} onClick={() => setShowPayment(true)} style={{ marginTop: 8 }}>متابعة للدفع الآمن →</Btn>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// FLIGHTS — OTA standard (Trip.com parity)
// segmented bar · one/round/multi · sort tabs w/ live values ·
// filter rail · Duffel-shaped offers incl. taxes
// ═══════════════════════════════════════════════════════════
const AIRLINES = [
  { code: "SV", name: "السعودية", logo: "🟢" },
  { code: "J4", name: "بدر", logo: "🔵" },
  { code: "ET", name: "الإثيوبية", logo: "🟡" },
  { code: "FZ", name: "فلاي دبي", logo: "🟠" },
  { code: "QR", name: "القطرية", logo: "🟣" },
  { code: "MS", name: "مصر للطيران", logo: "⚪" },
];

const buildOffers = (from, to, mode, segs) => {
  const isRound = mode === "round";
  const isMulti = mode === "multi";
  const nSeg = isMulti ? Math.max(segs.length, 2) : (isRound ? 2 : 1);
  const R = isMulti ? 0.92 * nSeg : (isRound ? 1.85 : 1);
  const mk = (i, al, dep, durMin, stops, base, bag, refund, change, seats, stopCity) => {
    const dh = +dep.split(":")[0];
    const am = dh * 60 + +dep.split(":")[1] + durMin;
    const arr = `${String(Math.floor(am / 60) % 24).padStart(2, "0")}:${String(am % 60).padStart(2, "0")}`;
    return { id: i, airline: al, dep, arr, durMin, depHour: dh, stops, stopCity,
      price: Math.round(base * R), seats,
      fare: { cls: ["Q", "V", "L", "K"][i % 4], cabinBag: "7 كجم", checkedBag: bag, refund, change },
      slices: isMulti
        ? segs.map((s, si) => ({ dir: `رحلة ${si + 1}`, from: s.from?.c || "—", to: s.to?.c || "—", date: s.date, dep: ["08:30", "13:10", "17:40", "10:20", "20:05"][si % 5], arr: ["10:15", "15:00", "19:25", "12:05", "21:50"][si % 5], dur: `${Math.floor(durMin / 60)}س ${durMin % 60}د`, fno: `${al.code}${400 + i * 37 + si}` }))
        : [
          { dir: "الذهاب", from, to, dep, arr, dur: `${Math.floor(durMin / 60)}س ${durMin % 60}د`, fno: `${al.code}${400 + i * 37}` },
          ...(isRound ? [{ dir: "العودة", from: to, to: from, dep: "17:20", arr: "19:05", dur: `${Math.floor(durMin / 60)}س ${durMin % 60}د`, fno: `${al.code}${401 + i * 37}` }] : []),
        ] };
  };
  return [
    mk(0, AIRLINES[0], "08:30", 105, 0, 280, "30 كجم", { ok: true, fee: 45 }, { ok: true, fee: 25 }, 6),
    mk(1, AIRLINES[1], "13:00", 110, 0, 250, "23 كجم", { ok: false }, { ok: true, fee: 40 }, 3),
    mk(2, AIRLINES[3], "06:15", 130, 0, 262, "20 كجم", { ok: false }, { ok: false }, 9),
    mk(3, AIRLINES[4], "16:45", 285, 1, 238, "30 كجم", { ok: true, fee: 60 }, { ok: true, fee: 30 }, 12, "الدوحة"),
    mk(4, AIRLINES[2], "02:40", 320, 1, 214, "23 كجم", { ok: false }, { ok: true, fee: 55 }, 15, "أديس أبابا"),
    mk(5, AIRLINES[5], "20:10", 265, 1, 231, "23 كجم", { ok: true, fee: 50 }, { ok: true, fee: 35 }, 7, "القاهرة"),
  ];
};

// ═══ COLLAPSIBLE FILTER PANEL — click to expand/collapse (both flights & hotels) ═══
const FilterBar = ({ count, children, resultCount }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <button onClick={() => setOpen(!open)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: T.card, border: `1.5px solid ${open ? T.gold : T.gray200}`, borderRadius: open ? "14px 14px 0 0" : 14, transition: "all .2s", boxShadow: open ? "0 -1px 0 transparent" : "0 2px 10px rgba(12,27,46,.05)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, color: T.text }}>
          <span style={{ fontSize: 17 }}>⚙️</span> تصفية النتائج
          {count > 0 && <span className="num" style={{ background: T.gold, color: T.ink, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20 }}>{count}</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {resultCount != null && <span style={{ fontSize: 13, color: T.gray400 }}>{resultCount} نتيجة</span>}
          <span style={{ fontSize: 12, color: T.gray400, transition: "transform .2s", transform: open ? "rotate(180deg)" : "none", display: "inline-block" }}>▼</span>
        </span>
      </button>
      {open && (
        <div className="fade-in" style={{ background: T.card, border: `1.5px solid ${T.gold}`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 22, alignItems: "start" }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const TIME_SLOTS = [["all", "الكل", ""], ["dawn", "00-06", "🌙"], ["morning", "06-12", "🌅"], ["noon", "12-18", "☀️"], ["night", "18-24", "🌆"]];
const inSlot = (h, s) => s === "all" || (s === "dawn" && h < 6) || (s === "morning" && h >= 6 && h < 12) || (s === "noon" && h >= 12 && h < 18) || (s === "night" && h >= 18);

const FlightsPage = ({ currency, rates, onBook, user, requireAuth, prefill }) => {
  const [phase, setPhase] = useState("search");
  const [searching, setSearching] = useState(false);
  const [tripType, setTripType] = useState("round");
  const [fromA, setFromA] = useState(AIRPORTS[0]);
  const [toA, setToA] = useState(AIRPORTS[2]);
  const [dep, setDep] = useState("");
  const [ret, setRet] = useState("");
  const [segments, setSegments] = useState([]);
  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState("economy");
  const [sortBy, setSortBy] = useState("recommended");
  const [flt, setFlt] = useState({ stops: "all", airlines: new Set(), slot: "all", maxPrice: 1500, refundOnly: false });
  const [expanded, setExpanded] = useState(null);
  const [selected, setSelected] = useState(null);
  const hydrated = useRef(0);

  const doSearch = () => { setSearching(true); setPhase("results"); setExpanded(null); setTimeout(() => setSearching(false), 1000); };

  useEffect(() => {
    if (prefill?.svc === "flights" && prefill.ts !== hydrated.current) {
      hydrated.current = prefill.ts;
      const q = prefill.params;
      setTripType(q.tripType);
      if (q.tripType === "multi") { setSegments(q.segments); setFromA(q.segments[0].from); setToA(q.segments[q.segments.length - 1].to); }
      else { setFromA(q.from); setToA(q.to); setDep(q.dep); setRet(q.ret || ""); }
      setPax({ adults: q.adults, children: q.children, infants: q.infants }); setCabin(q.cabin);
      doSearch();
    }
  }, [prefill]);

  const paxCount = pax.adults + pax.children;
  const offers = useMemo(() => buildOffers(fromA?.c || "KRT", toA?.c || "JED", tripType, segments), [fromA, toA, tripType, segments]);

  const airlineMinPrice = useMemo(() => {
    const m = {};
    offers.forEach(o => { m[o.airline.code] = Math.min(m[o.airline.code] ?? Infinity, o.price); });
    return m;
  }, [offers]);

  const filtered = useMemo(() => offers.filter(o =>
    (flt.stops === "all" || o.stops === flt.stops) &&
    (flt.airlines.size === 0 || flt.airlines.has(o.airline.code)) &&
    inSlot(o.depHour, flt.slot) &&
    o.price <= flt.maxPrice &&
    (!flt.refundOnly || o.fare.refund.ok)
  ), [offers, flt]);

  const best = useMemo(() => ({
    cheap: Math.min(...offers.map(o => o.price)),
    fast: Math.min(...offers.map(o => o.durMin)),
    early: Math.min(...offers.map(o => o.depHour)),
  }), [offers]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sortBy === "cheapest") return a.price - b.price;
    if (sortBy === "fastest") return a.durMin - b.durMin;
    if (sortBy === "earliest") return a.depHour - b.depHour;
    return (a.price / best.cheap) * 0.6 + (a.durMin / best.fast) * 0.4 - ((b.price / best.cheap) * 0.6 + (b.durMin / best.fast) * 0.4);
  }), [filtered, sortBy, best]);

  const fmtDur = (m) => `${Math.floor(m / 60)}س ${m % 60}د`;

  // ── SEARCH — segmented standard bar (one/round/multi) ──
  if (phase === "search") return (
    <PageWrap title="حجز تذاكر الطيران" sub="ذهاب · ذهاب وعودة · مدن متعددة — أسعار نهائية شاملة الضرائب">
      <Card style={{ padding: "26px 24px", maxWidth: 980, background: "#FFFFFF" }}>
        <FlightSearchBlock
          initial={{ tripType, from: fromA, to: toA, dep, ret, segments: segments.length ? segments : undefined, pax, cabin }}
          onSubmit={(q) => {
            setTripType(q.tripType);
            if (q.tripType === "multi") { setSegments(q.segments); setFromA(q.segments[0].from); setToA(q.segments[q.segments.length - 1].to); }
            else { setFromA(q.from); setToA(q.to); setDep(q.dep); setRet(q.ret || ""); setSegments([]); }
            setPax({ adults: q.adults, children: q.children, infants: q.infants }); setCabin(q.cabin);
            doSearch();
          }} />
      </Card>
      <div style={{ display: "flex", gap: 22, marginTop: 22, flexWrap: "wrap" }}>
        {[["🏷️", "أسعار نهائية بلا رسوم خفية"], ["↩️", "شروط الاسترداد واضحة قبل الدفع"], ["🏦", "ادفع ببنكك بكل ثقة"]].map(([ic, tx], x) => (
          <div key={x} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.gray400 }}><span style={{ color: T.gold }}>{ic}</span>{tx}</div>
        ))}
      </div>
    </PageWrap>
  );

  // ── PASSENGER ──
  if (phase === "passenger" && selected) {
    const total = selected.price * pax.adults + Math.round(selected.price * .75) * pax.children + Math.round(selected.price * .1) * pax.infants;
    return (
      <PageWrap title="بيانات المسافرين والدفع" maxW={1060}>
        <Stepper steps={["البحث", "الاختيار", "بيانات المسافرين", "الدفع"]} current={2} />
        <FlightBooking selected={{ airline: selected.airline.name, logo: selected.airline.logo, price: selected.price }}
          form={{ from: fromA?.city, to: toA?.city, cabin }} paxDetail={pax} total={total}
          currency={currency} rates={rates} onBook={onBook} user={user} requireAuth={requireAuth} />
      </PageWrap>
    );
  }

  // ── RESULTS ──
  return (
    <PageWrap title={tripType === "multi" ? `رحلة متعددة المدن · ${segments.length} مقاطع` : `${fromA?.city} ${tripType === "round" ? "⇄" : "←"} ${toA?.city}`}
      sub={tripType === "multi" ? `${segments.map(s => s.from?.c).join(" ← ")} ← ${segments[segments.length - 1]?.to?.c || ""} · ${paxCount} مسافر · ${CABINS[cabin]}` : `${dep || "—"}${tripType === "round" ? ` ← ${ret || "—"}` : ""} · ${paxCount} مسافر · ${CABINS[cabin]}`}>
      <button onClick={() => setPhase("search")} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 18, background: "none" }}>← تعديل البحث</button>

      {/* #5 MULTI-CITY: total journey summary + tight transit warning */}
      {tripType === "multi" && segments.length > 0 && (
        <Card style={{ padding: "14px 18px", marginBottom: 18, background: "rgba(37,99,235,.05)", border: `1px solid ${T.blue}22`, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 20 }}>🗺️</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>رحلة من {segments.length} مقاطع</div>
              <div className="num" style={{ fontSize: 12, color: T.gray500 }}>{segments.map(s => s.from?.c).join(" ← ")} ← {segments[segments.length - 1]?.to?.c}</div>
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="num" style={{ fontSize: 16, fontWeight: 800, color: T.blue }}>~{segments.length * 4}س</div>
            <div style={{ fontSize: 10, color: T.gray400 }}>إجمالي وقت الطيران</div>
          </div>
          {segments.length >= 3 && (
            <div style={{ padding: "6px 12px", background: T.amberBg, borderRadius: 8, fontSize: 11, color: T.amber, fontWeight: 700 }}>
              ⚠️ تحقق من أوقات الترانزيت بين المقاطع
            </div>
          )}
        </Card>
      )}

      {/* #2 PRICE CALENDAR — cheapest days around selected date */}
      {tripType !== "multi" && !searching && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>📅 أرخص أيام السفر — اختر لتوفّر</div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
            {(() => {
              const baseDate = dep ? new Date(dep) : new Date();
              return [-3, -2, -1, 0, 1, 2, 3].map(off => {
                const d = new Date(baseDate); d.setDate(d.getDate() + off);
                const iso = d.toISOString().slice(0, 10);
                const prices = [298, 275, 262, best.cheap, 271, 285, 312];
                const price = prices[off + 3];
                const isCheapest = price === Math.min(...prices);
                const isSelected = iso === dep;
                return (
                  <button key={off} onClick={() => { setDep(iso); doSearch(); }}
                    style={{ minWidth: 84, padding: "10px 12px", borderRadius: 12, textAlign: "center", flexShrink: 0, border: `1.5px solid ${isSelected ? T.gold : isCheapest ? T.green : T.gray200}`, background: isSelected ? "rgba(184,134,47,.10)" : isCheapest ? "rgba(14,159,110,.06)" : T.card, transition: "all .2s" }}>
                    <div style={{ fontSize: 11, color: T.gray400 }}>{d.toLocaleDateString("ar", { weekday: "short" })}</div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.getDate()}/{d.getMonth() + 1}</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 800, color: isCheapest ? T.green : T.gold, marginTop: 2, direction: "ltr" }}>{fmt(price, currency, rates)}</div>
                    {isCheapest && <div style={{ fontSize: 8, color: T.green, fontWeight: 700 }}>الأرخص</div>}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* SORT TABS with live values */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 18, maxWidth: 720 }}>
        {[["recommended", "الأنسب", ""],
          ["cheapest", "الأرخص", `${fmt(best.cheap, currency, rates)}`],
          ["fastest", "الأسرع", fmtDur(best.fast)],
          ["earliest", "الأبكر", `${String(best.early).padStart(2, "0")}:00`]].map(([k, l, v]) => (
          <button key={k} onClick={() => setSortBy(k)}
            style={{ padding: "10px 8px", borderRadius: 13, textAlign: "center", border: `1.5px solid ${sortBy === k ? T.gold : T.gray200}`, background: sortBy === k ? "rgba(184,134,47,.10)" : T.card, transition: "all .2s" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: sortBy === k ? T.goldLight : T.gray600 }}>{l}</div>
            {v && <div className="num" style={{ fontSize: 11, color: T.gray400, marginTop: 2, direction: "ltr" }}>{v}</div>}
          </button>
        ))}
      </div>

      <FilterBar count={((flt.stops!=="all"?1:0)+(flt.airlines.size)+(flt.slot!=="all"?1:0)+(flt.maxPrice<1500?1:0)+(flt.refundOnly?1:0))} resultCount={searching ? null : sorted.length}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.gray800, marginBottom: 8 }}>التوقفات</div>
            {[["all", "الكل"], [0, "مباشر فقط"], [1, "توقف واحد"]].map(([v, l]) => (
              <button key={String(v)} onClick={() => setFlt({ ...flt, stops: v })}
                style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 10px", borderRadius: 9, fontSize: 12, fontWeight: 700, marginBottom: 4, background: flt.stops === v ? "rgba(184,134,47,.10)" : "transparent", color: flt.stops === v ? T.goldDark : T.gray400, border: `1px solid ${flt.stops === v ? "rgba(184,134,47,.30)" : T.gray100}` }}>{l}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.gray800, marginBottom: 8 }}>وقت المغادرة</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {TIME_SLOTS.map(([v, l, ic]) => (
                <button key={v} onClick={() => setFlt({ ...flt, slot: v })}
                  style={{ padding: "8px 4px", borderRadius: 9, fontSize: 11, fontWeight: 700, border: `1px solid ${flt.slot === v ? T.gold : T.gray200}`, background: flt.slot === v ? "rgba(184,134,47,.10)" : "transparent", color: flt.slot === v ? T.goldDark : T.gray400 }}>{ic} {l}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.gray800, marginBottom: 8 }}>شركات الطيران</div>
            {AIRLINES.filter(a => airlineMinPrice[a.code] !== undefined).map(a => (
              <label key={a.code} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", cursor: "pointer" }}>
                <input type="checkbox" checked={flt.airlines.has(a.code)}
                  onChange={() => { const s = new Set(flt.airlines); s.has(a.code) ? s.delete(a.code) : s.add(a.code); setFlt({ ...flt, airlines: s }); }}
                  style={{ accentColor: T.gold, width: 15, height: 15 }} />
                <span style={{ fontSize: 12, color: T.gray800, flex: 1 }}>{a.logo} {a.name}</span>
                <span className="num" style={{ fontSize: 10, color: T.gray400, direction: "ltr" }}>{fmt(airlineMinPrice[a.code], currency, rates)}</span>
              </label>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.gray800, marginBottom: 6 }}>أقصى سعر: <span className="num" style={{ color: T.goldDark }}>{fmt(flt.maxPrice, currency, rates)}</span></div>
            <input type="range" min={150} max={1500} step={25} value={flt.maxPrice} onChange={e => setFlt({ ...flt, maxPrice: +e.target.value })} style={{ width: "100%", accentColor: T.gold }} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", marginTop: 14 }}>
              <input type="checkbox" checked={flt.refundOnly} onChange={() => setFlt({ ...flt, refundOnly: !flt.refundOnly })} style={{ accentColor: T.gold, width: 15, height: 15 }} />
              <span style={{ fontSize: 12, color: T.gray800 }}>✓ قابلة للاسترداد فقط</span>
            </label>
          </div>
        </FilterBar>
        <div>
          <div style={{ fontSize: 13, color: T.gray400, marginBottom: 12 }}>
            {searching ? "جاري البحث في كل الخطوط..." : `${sorted.length} رحلة · الأسعار للمسافر الواحد ${tripType === "round" ? "ذهاباً وعودة" : tripType === "multi" ? "لكل المقاطع" : ""} شاملة الضرائب`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {searching ? [1, 2, 3, 4].map(i => <FlightSkeleton key={i} />) :
              sorted.length === 0 ? (
                <EmptyState icon="✈️" title="لا رحلات بهذه الفلاتر" sub="جرّب توسيع نطاق السعر أو إلغاء بعض الفلاتر"
                  action={() => setFlt({ stops: "all", airlines: new Set(), slot: "all", maxPrice: 1500, refundOnly: false })} actionLabel="مسح كل الفلاتر" />
              ) : sorted.map(o => (
                <Card key={o.id} style={{ overflow: "hidden" }}>
                  <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 130 }}>
                      <span style={{ fontSize: 26 }}>{o.airline.logo}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{o.airline.name}</div>
                        <div className="num" style={{ fontSize: 10, color: T.gray400 }}>{o.slices[0].fno} · {o.fare.cls}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, justifyContent: "center", minWidth: 220 }}>
                      <div style={{ textAlign: "center" }}>
                        <div className="num" style={{ fontSize: 21, fontWeight: 700, color: T.text }}>{o.dep}</div>
                        <div className="num" style={{ fontSize: 11, color: T.gray400 }}>{tripType === "multi" ? o.slices[0].from : fromA?.c}</div>
                      </div>
                      <div style={{ textAlign: "center", flex: 1, maxWidth: 150 }}>
                        <div className="num" style={{ fontSize: 11, color: T.gray400 }}>{fmtDur(o.durMin)}</div>
                        <div style={{ height: 2, background: T.gray200, position: "relative", margin: "6px 0" }}>
                          <span style={{ position: "absolute", left: "50%", top: -8, transform: "translateX(-50%)", fontSize: 12, background: T.card, padding: "0 4px" }}>✈️</span>
                          {o.stops > 0 && tripType !== "multi" && <span style={{ position: "absolute", left: "50%", top: -3, transform: "translateX(-50%)", width: 6, height: 6, borderRadius: "50%", background: T.amber }} />}
                        </div>
                        <Badge color={tripType === "multi" ? "blue" : o.stops === 0 ? "green" : "amber"}>{tripType === "multi" ? `${o.slices.length} مقاطع` : o.stops === 0 ? "مباشر" : `توقف · ${o.stopCity}`}</Badge>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className="num" style={{ fontSize: 21, fontWeight: 700, color: T.text }}>{o.arr}</div>
                        <div className="num" style={{ fontSize: 11, color: T.gray400 }}>{tripType === "multi" ? o.slices[o.slices.length - 1].to : toA?.c}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 128 }}>
                      <PriceDisplay amount={o.price} size="md" label={tripType === "round" ? "ذهاب وعودة · للمسافر" : tripType === "multi" ? "كل المقاطع · للمسافر" : "للمسافر · شامل الضرائب"} />
                      {o.seats <= 6 && <div style={{ fontSize: 10, color: T.red, margin: "3px 0" }}>⚡ تبقى {o.seats} مقاعد</div>}
                      <Btn size="sm" style={{ marginTop: 6 }} onClick={() => { if (!user) { requireAuth(); return; } setSelected(o); setPhase("passenger"); }}>اختيار</Btn>
                    </div>
                  </div>
                  {/* Meta + expandable fare details */}
                  <div style={{ padding: "0 20px 14px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 11, color: T.gray400 }}>
                    <span>🧳 {o.fare.checkedBag} مسجلة</span>
                    <span>👜 {o.fare.cabinBag} مقصورة</span>
                    <span style={{ color: o.fare.refund.ok ? T.green : T.red }}>{o.fare.refund.ok ? `↩️ استرداد برسوم $${o.fare.refund.fee}` : "✗ غير قابلة للاسترداد"}</span>
                    <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                      style={{ marginRight: "auto", background: "none", color: T.goldLight, fontSize: 12, fontWeight: 700 }}>
                      {expanded === o.id ? "إخفاء التفاصيل ▲" : "تفاصيل الرحلة والأجرة ▼"}
                    </button>
                  </div>
                  {expanded === o.id && (
                    <div className="fade-in" style={{ borderTop: `1px solid ${T.gray100}`, padding: 20, background: T.bg2 }}>
                      {o.slices.map((s, si) => (
                        <div key={si} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: si < o.slices.length - 1 ? 14 : 0 }}>
                          <div style={{ minWidth: 62 }}><Badge color={si === 0 ? "gold" : "blue"}>{s.dir}</Badge></div>
                          <div style={{ flex: 1, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.dep}</span>
                            <span className="num" style={{ fontSize: 12, color: T.gray400 }}>{s.from}</span>
                            <span style={{ color: T.gold }}>←</span>
                            <span className="num" style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.arr}</span>
                            <span className="num" style={{ fontSize: 12, color: T.gray400 }}>{s.to}</span>
                            <span className="num" style={{ fontSize: 11, color: T.gray400 }}>· {s.dur} · {s.fno}{s.date ? ` · ${s.date}` : ""}</span>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${T.gray200}` }}>
                        <div style={{ fontSize: 12 }}><div style={{ color: T.gray400, marginBottom: 3 }}>الأمتعة المسجلة</div><div style={{ color: T.text, fontWeight: 700 }}>🧳 {o.fare.checkedBag}</div></div>
                        <div style={{ fontSize: 12 }}><div style={{ color: T.gray400, marginBottom: 3 }}>أمتعة المقصورة</div><div style={{ color: T.text, fontWeight: 700 }}>👜 {o.fare.cabinBag}</div></div>
                        <div style={{ fontSize: 12 }}><div style={{ color: T.gray400, marginBottom: 3 }}>الإلغاء والاسترداد</div><div style={{ color: o.fare.refund.ok ? T.green : T.red, fontWeight: 700 }}>{o.fare.refund.ok ? `✓ برسوم $${o.fare.refund.fee}` : "✗ غير مسموح"}</div></div>
                        <div style={{ fontSize: 12 }}><div style={{ color: T.gray400, marginBottom: 3 }}>تغيير التاريخ</div><div style={{ color: o.fare.change.ok ? T.green : T.red, fontWeight: 700 }}>{o.fare.change.ok ? `✓ برسوم $${o.fare.change.fee}` : "✗ غير مسموح"}</div></div>
                      </div>
                      <p style={{ fontSize: 11, color: T.gray400, marginTop: 12 }}>السعر النهائي شامل كل الضرائب والرسوم · درجة الحجز {o.fare.cls} · الشروط من نظام شركة الطيران مباشرة</p>
                    </div>
                  )}
                </Card>
              ))}
          </div>
        </div>
    </PageWrap>
  );
};

const FlightBooking = ({ selected, form, paxDetail, total, currency, rates, onBook, user, requireAuth }) => {
  // Duffel-standard passenger list: type, title, given/family (EN as passport), DOB, nationality, passport no + expiry
  const buildPax = () => {
    const list = [];
    for (let k = 0; k < paxDetail.adults; k++) list.push({ type: "adult", label: `بالغ ${k + 1}` });
    for (let k = 0; k < paxDetail.children; k++) list.push({ type: "child", label: `طفل ${k + 1} (2-11)` });
    for (let k = 0; k < paxDetail.infants; k++) list.push({ type: "infant_without_seat", label: `رضيع ${k + 1}` });
    return list.map(x => ({ ...x, title: "mr", given: "", family: "", dob: "", nationality: "السودان", passport: "", expiry: "" }));
  };
  const [passengers, setPassengers] = useState(buildPax);
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [agree, setAgree] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const setP = (i, patch) => setPassengers(ps => ps.map((p, y) => y === i ? { ...p, ...patch } : p));
  const pValid = (p) => p.given.trim().length > 1 && p.family.trim().length > 1 && p.dob && p.passport.trim().length > 4 && p.expiry;
  const valid = passengers.every(pValid) && contact.email.includes("@") && contact.phone.length > 6 && agree;

  if (showPayment) return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <PaymentGateway total={total} currency={currency} rates={rates} summary={`${selected.airline} · ${form.from}→${form.to}`}
        onConfirmed={() => onBook({ type: "flight", title: `${selected.airline} ${form.from}→${form.to}`, total })}
        onBack={() => setShowPayment(false)} />
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
      <div>
        {passengers.map((p, i) => (
          <Card key={i} style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text }}>👤 {p.label}</h3>
              {pValid(p) ? <Badge color="green">✓ مكتمل</Badge> : <Badge color="gray">بيانات الجواز</Badge>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr", gap: 12 }} className="search-row">
              <Picker label="اللقب" value={p.title} onChange={e => setP(i, { title: e.target.value })}
                options={[{ value: "mr", label: "السيد" }, { value: "mrs", label: "السيدة" }, { value: "ms", label: "الآنسة" }]} />
              <Field label="الاسم الأول (EN كما في الجواز)" value={p.given} onChange={e => setP(i, { given: e.target.value.toUpperCase() })} placeholder="AHMED" dir="ltr" required />
              <Field label="اسم العائلة (EN)" value={p.family} onChange={e => setP(i, { family: e.target.value.toUpperCase() })} placeholder="ALTAYEB" dir="ltr" required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="search-row">
              <Field label="تاريخ الميلاد" type="date" value={p.dob} onChange={e => setP(i, { dob: e.target.value })} required />
              <Picker label="الجنسية" value={p.nationality} onChange={e => setP(i, { nationality: e.target.value })} icon="🌍"
                options={[{ value: "السودان", label: "السودان" }, { value: "السعودية", label: "السعودية" }, { value: "مصر", label: "مصر" }, { value: "الإمارات", label: "الإمارات" }, { value: "أخرى", label: "أخرى" }]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="search-row">
              <Field label="رقم جواز السفر" value={p.passport} onChange={e => setP(i, { passport: e.target.value.toUpperCase() })} placeholder="P0123456" icon="📄" dir="ltr" required />
              <Field label="تاريخ انتهاء الجواز" type="date" value={p.expiry} onChange={e => setP(i, { expiry: e.target.value })} required note="يجب أن يكون سارياً 6 أشهر من تاريخ السفر" />
            </div>
          </Card>
        ))}

        <Card style={{ padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 16 }}>📬 بيانات التواصل — تصلها التذكرة والتحديثات</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="search-row">
            <Field label="البريد الإلكتروني" value={contact.email} onChange={e => setContact({ ...contact, email: e.target.value })} placeholder="you@email.com" icon="📧" dir="ltr" required />
            <Field label="رقم الهاتف (واتساب)" value={contact.phone} onChange={e => setContact({ ...contact, phone: e.target.value })} placeholder="+249 9xxxxxxxx" icon="📱" dir="ltr" required />
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginTop: 6 }}>
            <div onClick={() => setAgree(!agree)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${agree ? T.gold : T.gray300}`, background: agree ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>{agree && <span style={{ color: T.ink, fontSize: 13 }}>✓</span>}</div>
            <span style={{ fontSize: 13, color: T.gray600, lineHeight: 1.6 }}>أقرّ بصحة بيانات الجوازات وموافقتي على شروط الأجرة (الأمتعة، الاسترداد، التغيير) المعروضة في تفاصيل الرحلة</span>
          </label>
          <Btn full size="lg" disabled={!valid} onClick={() => { if (!user) { requireAuth(); return; } setShowPayment(true); }} style={{ marginTop: 18 }}>
            متابعة للدفع الآمن →
          </Btn>
        </Card>
      </div>

      {/* Fare summary — OTA standard breakdown */}
      <Card style={{ padding: 22, position: "sticky", top: 90 }} className="summary-sticky">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${T.gray100}` }}>
          <span style={{ fontSize: 26 }}>{selected?.logo}</span>
          <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{selected?.airline}</div>
            <div style={{ fontSize: 12, color: T.gray400 }}>{form.from} ← {form.to} · {CABINS[form.cabin]}</div></div>
        </div>
        <div style={{ fontSize: 13, color: T.gray600, lineHeight: 2 }}>
          {paxDetail.adults > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>بالغ × {paxDetail.adults}</span><span className="num" style={{ direction: "ltr" }}>{fmt(selected?.price * paxDetail.adults || 0, currency, rates)}</span></div>}
          {paxDetail.children > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>طفل × {paxDetail.children} (75%)</span><span className="num" style={{ direction: "ltr" }}>{fmt(Math.round(selected?.price * .75) * paxDetail.children, currency, rates)}</span></div>}
          {paxDetail.infants > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>رضيع × {paxDetail.infants} (10%)</span><span className="num" style={{ direction: "ltr" }}>{fmt(Math.round(selected?.price * .1) * paxDetail.infants, currency, rates)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", color: T.green }}><span>الضرائب والرسوم</span><span>مشمولة ✓</span></div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: T.text, paddingTop: 12, marginTop: 8, borderTop: `1px solid ${T.gray200}` }}>
          <span>الإجمالي</span><span className="num" style={{ color: T.gold, direction: "ltr" }}>{fmt(total, currency, rates)}</span>
        </div>
        <div style={{ marginTop: 14, padding: "10px 12px", background: T.greenBg, borderRadius: 10, fontSize: 11, color: T.green, lineHeight: 1.7 }}>
          🔒 السعر النهائي — لا رسوم إضافية عند الدفع · تصلك التذكرة فور تأكيد بنكك
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// AUTH — split login/register + post-signup DATA CONFIRMATION
// ═══════════════════════════════════════════════════════════
const AuthModal = ({ initialMode, onClose, onAuth }) => {
  const [mode, setMode] = useState(initialMode || "login");
  const [step, setStep] = useState("form"); // form | otp | confirm-data | verify-identity
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState("customer");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Post-signup data confirmation (BOTH profile + identity)
  const [profile, setProfile] = useState({ fullName: "", phone: "", city: "", photo: false });
  const [identity, setIdentity] = useState({ docType: "passport", docNumber: "", uploaded: false });
  const otpRefs = useRef([]);

  const submitForm = async () => {
    if (!email.includes("@")) { setError("أدخل بريداً صحيحاً"); return; }
    if (mode === "login") {
      if (password.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
      setError(""); setLoading(true);
      const res = await signInUser(email, password);
      setLoading(false);
      if (!res.ok) { setError("بيانات الدخول غير صحيحة"); return; }
      onAuth({ email, userType: "customer", verified: true });
      return;
    }
    if (password.length < 6) { setError("كلمة المرور 6 أحرف على الأقل"); return; }
    setError(""); setLoading(true);
    const res = await signUpUser(email, password, profile);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setStep("verify-email");
  };
  const handleOtp = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp]; next[i] = v; setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.focus();
    if (!v && i > 0) otpRefs.current[i - 1]?.focus();
  };
  const verifyOtp = () => {
    if (otp.join("").length < 6) { setError("أدخل الرمز كاملاً"); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // LOGIN → done. REGISTER → must confirm data (both profile + identity)
      if (mode === "login") onAuth({ email, userType, verified: true });
      else setStep("confirm-data");
    }, 900);
  };
  const submitProfile = () => {
    if (!profile.fullName || !profile.phone) { setError("أكمل الاسم ورقم الهاتف"); return; }
    setError(""); setStep("verify-identity");
  };
  const submitIdentity = () => {
    // Both steps done → account fully set up
    onAuth({ email, userType, verified: true, profile, identity, pendingVerification: !identity.uploaded });
  };

  const Header = () => (
    <div style={{ background: T.navy, padding: "26px 28px 22px", borderRadius: "24px 24px 0 0", textAlign: "center", position: "relative" }}>
      <button onClick={onClose} style={{ position: "absolute", left: 18, top: 18, width: 32, height: 32, borderRadius: "50%", background: `${T.white}1A`, color: T.pure, fontSize: 16 }}>✕</button>
      <Logo height={46} light />
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="scale-in" onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 24, maxWidth: 460, width: "100%", maxHeight: "94vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
        <Header />
        <div style={{ padding: 28 }}>
          {/* STEP: form */}
          {step === "form" && <>
            <div style={{ display: "flex", gap: 6, marginBottom: 24, background: T.gray100, borderRadius: 12, padding: 4 }}>
              {[["login", "تسجيل الدخول"], ["register", "إنشاء حساب"]].map(([m, l]) => (
                <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, background: mode === m ? T.card : "transparent", color: mode === m ? T.text : T.gray400, boxShadow: mode === m ? "0 2px 8px rgba(0,0,0,.08)" : "none", transition: "all .2s" }}>{l}</button>
              ))}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 6 }}>{mode === "login" ? "مرحباً بعودتك" : "أنشئ حسابك في حاجز"}</h2>
            <p style={{ fontSize: 13, color: T.gray400, marginBottom: 22 }}>{mode === "login" ? "أدخل بريدك وكلمة المرور للدخول" : "خطوات بسيطة وتبدأ رحلتك معنا"}</p>
            {mode === "register" && (
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {[["customer", "👤 عميل"], ["agent", "🏢 وكيل"], ["marketer", "📢 مسوّق"]].map(([t, l]) => (
                  <button key={t} onClick={() => setUserType(t)} style={{ flex: 1, padding: "10px 4px", borderRadius: 11, fontSize: 12, fontWeight: 600, border: `1.5px solid ${userType === t ? T.gold : T.gray200}`, background: userType === t ? `${T.gold}12` : T.card, color: userType === t ? T.goldDark : T.gray600 }}>{l}</button>
                ))}
              </div>
            )}
            <Field label="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" type="email" icon="📧" error={mode === "register" ? error : ""} dir="ltr" />
            {mode === "login" && (
              <Field label="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" icon="🔒" error={error} dir="ltr" />
            )}
            {mode === "register" && (
              <Field label="أنشئ كلمة مرور" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" type="password" icon="🔒" dir="ltr" note="ستستخدمها لتسجيل الدخول لاحقاً" />
            )}
            {mode === "login" && <div style={{ textAlign: "left", marginTop: -6, marginBottom: 12 }}><button style={{ background: "none", color: T.goldDark, fontSize: 12, fontWeight: 600 }}>نسيت كلمة المرور؟</button></div>}
            <Btn full onClick={submitForm} disabled={loading} style={{ marginTop: 6 }}>{loading ? <Spinner /> : mode === "login" ? "تسجيل الدخول" : "إرسال رمز التحقق"}</Btn>
            {mode === "register" && userType !== "customer" && <p style={{ textAlign: "center", fontSize: 12, color: T.amber, marginTop: 14 }}>⚠️ حسابات {userType === "agent" ? "الوكلاء" : "المسوقين"} تُدار من لوحة منفصلة بعد التسجيل</p>}
          </>}

          {/* STEP: OTP */}
          {step === "verify-email" && <div className="fade-in" style={{ textAlign: "center", padding: "20px 8px" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#E9F9F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 18px" }}>📧</div>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 10 }}>تفقّد بريدك الإلكتروني</h3>
            <p style={{ fontSize: 14, color: T.gray600, lineHeight: 1.8, marginBottom: 8 }}>أرسلنا رابط تأكيد إلى</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.goldDark, marginBottom: 18, direction: "ltr" }}>{email}</p>
            <p style={{ fontSize: 13, color: T.gray600, lineHeight: 1.8, marginBottom: 24 }}>اضغط الرابط في الرسالة لتفعيل حسابك، ثم عُد وسجّل الدخول. إن لم تجد الرسالة، تفقّد مجلد الرسائل غير المرغوبة (Spam).</p>
            <Btn full onClick={onClose}>فهمت</Btn>
          </div>}

          {/* STEP: confirm-data (profile completion) */}
          {step === "confirm-data" && <div className="fade-in">
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <Badge color="gold">الخطوة 1 من 2</Badge>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginTop: 12, marginBottom: 4 }}>أكمل ملفك الشخصي</h2>
            <p style={{ fontSize: 13, color: T.gray400, marginBottom: 20 }}>نحتاج هذه البيانات لإتمام حجوزاتك بسرعة لاحقاً</p>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <button onClick={() => setProfile({ ...profile, photo: !profile.photo })} style={{ width: 80, height: 80, borderRadius: "50%", background: profile.photo ? T.gold : T.gray100, border: `2px dashed ${profile.photo ? T.gold : T.gray300}`, fontSize: 28, color: profile.photo ? T.ink : T.gray400 }}>{profile.photo ? "✓" : "📷"}</button>
              <p style={{ fontSize: 12, color: T.gray400, marginTop: 6 }}>{profile.photo ? "تم إضافة الصورة" : "صورة شخصية (اختياري)"}</p>
            </div>
            <Field label="الاسم الكامل" value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })} placeholder="الاسم الثلاثي" icon="👤" required />
            <Field label="رقم الهاتف" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="+249 ..." icon="📱" dir="ltr" required />
            <Field label="المدينة" value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} placeholder="الخرطوم، دبي..." icon="📍" />
            {error && <p style={{ color: T.red, fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <Btn full size="lg" onClick={submitProfile}>التالي — توثيق الهوية</Btn>
          </div>}

          {/* STEP: verify-identity (document upload) */}
          {step === "verify-identity" && <div className="fade-in">
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <Badge color="gold">الخطوة 2 من 2</Badge>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginTop: 12, marginBottom: 4 }}>توثيق الهوية</h2>
            <p style={{ fontSize: 13, color: T.gray400, marginBottom: 20 }}>لحماية حسابك وتسريع التأشيرات والحجوزات</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[["passport", "📘 جواز سفر"], ["id", "🪪 بطاقة وطنية"]].map(([t, l]) => (
                <button key={t} onClick={() => setIdentity({ ...identity, docType: t })} style={{ flex: 1, padding: "11px", borderRadius: 11, fontSize: 13, fontWeight: 600, border: `1.5px solid ${identity.docType === t ? T.gold : T.gray200}`, background: identity.docType === t ? `${T.gold}12` : T.card, color: identity.docType === t ? T.goldDark : T.gray600 }}>{l}</button>
              ))}
            </div>
            <Field label="رقم الوثيقة" value={identity.docNumber} onChange={e => setIdentity({ ...identity, docNumber: e.target.value })} placeholder={identity.docType === "passport" ? "A12345678" : "رقم البطاقة"} icon="🔢" dir="ltr" />
            <Card style={{ padding: 20, marginBottom: 16, border: `2px dashed ${identity.uploaded ? T.green : T.gold}`, background: identity.uploaded ? T.greenBg : T.card, textAlign: "center" }}>
              {!identity.uploaded ? <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 12 }}>صوّر أو ارفع وثيقتك</p>
                <Btn size="sm" onClick={() => setIdentity({ ...identity, uploaded: true })}>⬆️ رفع الوثيقة</Btn>
              </> : <>
                <div style={{ fontSize: 36, marginBottom: 6 }}>✅</div>
                <p style={{ fontSize: 14, fontWeight: 700, color: T.green }}>تم رفع الوثيقة</p>
              </>}
            </Card>
            <Btn full size="lg" onClick={submitIdentity}>{identity.uploaded ? "إنهاء وبدء الاستخدام" : "تخطّي التوثيق الآن"}</Btn>
            <p style={{ textAlign: "center", fontSize: 11, color: T.gray400, marginTop: 12 }}>
              {identity.uploaded ? "🔒 بياناتك مشفّرة ولا تُستخدم إلا للتحقق" : "يمكنك التوثيق لاحقاً من ملفك، لكن بعض الخدمات تتطلبه"}
            </p>
          </div>}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HEADER — prominent, visible auth buttons (NOT in menu)
// ═══════════════════════════════════════════════════════════
const Header = ({ onNav, currentPage, currency, setCurrency, user, onAuth, onLogout }) => {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const links = NAV_ORDER.map(id => SERVICES_CONFIG[id]);
  return (
    <header style={{ background: "rgba(255,255,255,.88)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: "1px solid rgba(12,27,46,.08)", boxShadow: "0 1px 12px rgba(12,27,46,.05)", position: "sticky", top: 0, zIndex: 1000 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", height: 74, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div onClick={() => onNav("home")} style={{ cursor: "pointer" }}><Logo height={44} /></div>
          <nav className="desktop-only" style={{ display: "flex", gap: 2 }}>
            {links.map(l => (
              <button key={l.id} onClick={() => onNav(l.id)}
                style={{ padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: currentPage === l.id ? `${T.gold}15` : "transparent", color: currentPage === l.id ? T.goldDark : T.gray800, transition: "all .2s" }}
                onMouseEnter={e => currentPage !== l.id && (e.currentTarget.style.background = T.gray50)}
                onMouseLeave={e => currentPage !== l.id && (e.currentTarget.style.background = "transparent")}>
                {l.label}{!l.live && <span style={{ marginRight: 6, fontSize: 9, fontWeight: 700, color: T.goldDark, background: "rgba(184,134,47,.12)", padding: "2px 7px", borderRadius: 10, verticalAlign: "middle" }}>قريباً</span>}
              </button>
            ))}
          </nav>
        </div>

        {/* RIGHT: currency + PROMINENT auth */}
        <div className="desktop-only" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <CurrencyToggle currency={currency} setCurrency={setCurrency} />
          {user ? (
            <div style={{ position: "relative" }}>
              <button onClick={() => setUserMenu(!userMenu)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 6px 14px", borderRadius: 30, background: T.gray50, border: `1px solid ${T.gray200}` }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{user.profile?.fullName?.split(" ")[0] || "حسابي"}</span>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.navy, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(user.profile?.fullName || user.email)?.[0]?.toUpperCase() || "ح"}</div>
              </button>
              {userMenu && (
                <Card style={{ position: "absolute", top: 52, left: 0, width: 220, padding: 8, zIndex: 100 }} className="scale-in">
                  {!user.pendingVerification ? null : (
                    <div style={{ padding: "8px 12px", background: T.amberBg, borderRadius: 8, fontSize: 11, color: T.amber, marginBottom: 6 }}>⚠️ وثّق هويتك لتفعيل كل الخدمات</div>
                  )}
                  {[["dashboard", "🏠 لوحتي"], ["trips", "🎫 رحلاتي"], ["wallet", "💳 المحفظة والنقاط"], ["passports", "📘 الجوازات المحفوظة"], ["profile", "⚙️ الملف الشخصي"]].map(([id, l]) => (
                    <button key={id} onClick={() => { onNav(id); setUserMenu(false); }} style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", borderRadius: 8, fontSize: 14, color: T.text, background: "transparent" }} onMouseEnter={e => e.currentTarget.style.background = T.gray50} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{l}</button>
                  ))}
                  <div style={{ borderTop: `1px solid ${T.gray100}`, marginTop: 6, paddingTop: 6 }}>
                    <button onClick={() => { onLogout(); setUserMenu(false); }} style={{ display: "block", width: "100%", textAlign: "right", padding: "10px 12px", borderRadius: 8, fontSize: 14, color: T.red, background: "transparent" }}>🚪 تسجيل الخروج</button>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* PROMINENT — clearly visible, eye-catching */
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => onAuth("login")} style={{ padding: "10px 20px", borderRadius: 11, fontSize: 14, fontWeight: 700, color: T.text, background: "transparent", border: `1.5px solid ${T.navy}`, transition: "all .2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.navy; e.currentTarget.style.color = T.gold; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.navy; }}>
                تسجيل الدخول
              </button>
              <button onClick={() => onAuth("register")} style={{ padding: "10px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, color: T.ink, background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, boxShadow: `0 4px 14px ${T.gold}55`, transition: "all .2s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
                حساب جديد
              </button>
            </div>
          )}
        </div>

        {/* Mobile: auth still visible + menu */}
        <div className="mobile-only" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!user && <button onClick={() => onAuth("register")} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 700, color: T.ink, background: `linear-gradient(135deg,${T.gold},${T.goldDark})` }}>حساب</button>}
          {user && <div onClick={() => onNav("dashboard")} style={{ width: 36, height: 36, borderRadius: "50%", background: T.navy, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{(user.profile?.fullName || user.email)?.[0]?.toUpperCase() || "ح"}</div>}
          <button onClick={() => setMobileMenu(!mobileMenu)} style={{ fontSize: 24, background: "none", color: T.text }}>☰</button>
        </div>
      </div>

      {mobileMenu && (
        <div className="mobile-only scale-in" style={{ background: T.card, borderTop: `1px solid ${T.gray100}`, padding: 16 }}>
          {links.map(l => (
            <button key={l.id} onClick={() => { onNav(l.id); setMobileMenu(false); }} style={{ display: "flex", gap: 10, width: "100%", textAlign: "right", padding: "12px 16px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: T.text, background: currentPage === l.id ? T.gray50 : "transparent" }}><span>{l.icon}</span>{l.label}{!l.live && <span style={{ marginRight: "auto", fontSize: 10, fontWeight: 700, color: T.gold }}>قريباً</span>}</button>
          ))}
          <div style={{ borderTop: `1px solid ${T.gray100}`, marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <CurrencyToggle currency={currency} setCurrency={setCurrency} />
            {!user ? <>
              <Btn variant="outline" full onClick={() => { onAuth("login"); setMobileMenu(false); }}>تسجيل الدخول</Btn>
              <Btn full onClick={() => { onAuth("register"); setMobileMenu(false); }}>حساب جديد</Btn>
            </> : <>
              {[["dashboard", "🏠 لوحتي"], ["trips", "🎫 رحلاتي"], ["wallet", "💳 المحفظة"], ["profile", "⚙️ الملف"]].map(([id, l]) => (
                <button key={id} onClick={() => { onNav(id); setMobileMenu(false); }} style={{ textAlign: "right", padding: "10px 16px", borderRadius: 8, fontSize: 14, color: T.text, background: T.gray50 }}>{l}</button>
              ))}
              <Btn variant="ghost" full onClick={() => { onLogout(); setMobileMenu(false); }}>تسجيل الخروج</Btn>
            </>}
          </div>
        </div>
      )}
    </header>
  );
};

// ═══════════════════════════════════════════════════════════
// CUSTOMER DASHBOARD — inside the site (per user's choice)
// ═══════════════════════════════════════════════════════════
const CustomerDashboard = ({ user, onNav, currency, rates }) => {
  const [tab, setTab] = useState("bookings");
  const [bookingFilter, setBookingFilter] = useState("all");
  const firstName = user.profile?.fullName?.split(" ")[0] || "بك";

  // Booking data — shape mirrors BookingService.getBookings() API
  const BOOKINGS = [
    { id: "HJZ-K7M2QA", type: "flight", icon: "✈️", title: "الخرطوم → جدة", sub: "السعودية · ذهاب وعودة", date: "15 يوليو 2026", amount: 325, status: "confirmed", pax: "1 مسافر", ref: "SV-437" },
    { id: "HJZ-X3B9LC", type: "hotel", icon: "🏨", title: "فندق هيلتون مكة", sub: "4 ليالٍ · غرفة ديلوكس", date: "16 يوليو 2026", amount: 720, status: "review", pax: "2 ضيوف", ref: "HTL-8891" },
    { id: "HJZ-P2N5TR", type: "flight", icon: "✈️", title: "الخرطوم → دبي", sub: "الإمارات · ذهاب فقط", date: "2 أغسطس 2026", amount: 410, status: "confirmed", pax: "1 مسافر", ref: "FZ-221" },
    { id: "HJZ-A1C2D3", type: "hotel", icon: "🏨", title: "موفنبيك جدة", sub: "3 ليالٍ · جناح", date: "10 يونيو 2026", amount: 540, status: "completed", pax: "2 ضيوف", ref: "HTL-4410" },
    { id: "HJZ-H7J8K9", type: "flight", icon: "✈️", title: "الخرطوم → القاهرة", sub: "مصر · ذهاب وعودة", date: "28 مايو 2026", amount: 280, status: "cancelled", pax: "1 مسافر", ref: "MS-902" },
  ];

  const STATUS = {
    confirmed: { label: "مؤكد", c: "green", step: 3 },
    review: { label: "قيد مراجعة بنكك", c: "amber", step: 2 },
    completed: { label: "مكتمل", c: "blue", step: 3 },
    cancelled: { label: "ملغي", c: "red", step: 0 },
  };
  const FILTERS = [["all", "الكل"], ["upcoming", "قادمة"], ["review", "قيد المراجعة"], ["completed", "مكتملة"], ["cancelled", "ملغاة"]];
  const matchFilter = (b) => bookingFilter === "all" ? true
    : bookingFilter === "upcoming" ? (b.status === "confirmed")
    : bookingFilter === "review" ? (b.status === "review")
    : bookingFilter === "completed" ? (b.status === "completed")
    : (b.status === "cancelled");
  const shown = BOOKINGS.filter(matchFilter);

  const NAV = [
    { id: "bookings", label: "رحلاتي", icon: "🎫" },
    { id: "wallet", label: "المحفظة والنقاط", icon: "💳" },
    { id: "travelers", label: "المسافرون", icon: "👥" },
    { id: "favorites", label: "المفضلة", icon: "❤️" },
    { id: "profile", label: "الملف الشخصي", icon: "⚙️" },
  ];

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "28px 20px 60px" }}>
      {/* Header band */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, color: T.ink, fontWeight: 800 }}>
          {firstName.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text }}>أهلاً {firstName} 👋</h1>
          <p style={{ fontSize: 13, color: T.gray400 }}>{user.email}</p>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>1,250</div><div style={{ fontSize: 11, color: T.gray400 }}>نقطة</div></div>
          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 22, fontWeight: 800, color: T.green }}>{fmt(45, currency, rates)}</div><div style={{ fontSize: 11, color: T.gray400 }}>رصيد</div></div>
        </div>
      </div>

      {user.pendingVerification && (
        <Card style={{ padding: 16, marginBottom: 20, background: T.amberBg, border: `1px solid ${T.amber}33`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: T.amber }}>وثّق هويتك</div><div style={{ fontSize: 12, color: T.amber }}>لتفعيل كل الخدمات</div></div>
          </div>
          <Btn size="sm" variant="gold_outline" onClick={() => setTab("profile")}>توثيق الآن</Btn>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
        {/* Sidebar nav */}
        <Card style={{ padding: 10, position: "sticky", top: 90 }} className="summary-sticky">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "right", padding: "12px 14px", borderRadius: 11, fontSize: 14, fontWeight: 700, marginBottom: 3, background: tab === n.id ? "rgba(184,134,47,.10)" : "transparent", color: tab === n.id ? T.goldDark : T.gray600, border: tab === n.id ? "1px solid rgba(184,134,47,.28)" : "1px solid transparent", transition: "all .2s" }}>
              <span style={{ fontSize: 17 }}>{n.icon}</span>{n.label}
            </button>
          ))}
        </Card>

        {/* Content */}
        <div>
          {tab === "bookings" && (
            <div className="fade-in">
              <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
                {FILTERS.map(([k, l]) => (
                  <button key={k} onClick={() => setBookingFilter(k)}
                    style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", background: bookingFilter === k ? T.navy : T.card, color: bookingFilter === k ? T.pure : T.gray500, border: `1.5px solid ${bookingFilter === k ? T.navy : T.gray200}`, transition: "all .2s" }}>{l}</button>
                ))}
              </div>
              {shown.length === 0 ? (
                <EmptyState icon="🎫" title="لا حجوزات في هذا التصنيف" sub="ابدأ رحلتك الأولى مع حاجز" action={() => onNav("flights")} actionLabel="ابحث عن رحلة" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {shown.map(b => {
                    const st = STATUS[b.status];
                    return (
                      <Card key={b.id} style={{ overflow: "hidden" }}>
                        <div style={{ padding: "18px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                          <div style={{ width: 52, height: 52, borderRadius: 13, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{b.icon}</div>
                          <div style={{ flex: 1, minWidth: 180 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                              <h3 style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{b.title}</h3>
                              <Badge color={st.c}>{st.label}</Badge>
                            </div>
                            <div style={{ fontSize: 12, color: T.gray400 }}>{b.sub} · {b.pax}</div>
                            <div className="num" style={{ fontSize: 12, color: T.gray500, marginTop: 3 }}>📅 {b.date} · {b.id}</div>
                          </div>
                          <div style={{ textAlign: "left" }}>
                            <div className="num" style={{ fontSize: 18, fontWeight: 800, color: T.gold, direction: "ltr" }}>{fmt(b.amount, currency, rates)}</div>
                          </div>
                        </div>
                        {/* LIVE TRACKING TIMELINE — proposal #3 */}
                        {b.status !== "cancelled" && (
                          <div style={{ padding: "0 20px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                              {["دفعت", "قيد المراجعة", "مؤكد · التذكرة"].map((s, si) => {
                                const done = si < st.step, active = si === st.step - 1;
                                return (
                                  <div key={si} style={{ display: "flex", alignItems: "center", flex: si < 2 ? 1 : "none" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: done ? T.green : active ? T.amber : T.gray100, color: done || active ? T.pure : T.gray400, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, boxShadow: active ? `0 0 0 4px ${T.amber}22` : "none" }}>
                                        {done ? "✓" : si + 1}
                                      </div>
                                      <span style={{ fontSize: 10, color: done ? T.green : active ? T.amber : T.gray400, fontWeight: 700, whiteSpace: "nowrap" }}>{s}</span>
                                    </div>
                                    {si < 2 && <div style={{ flex: 1, height: 2, background: done ? T.green : T.gray200, margin: "0 6px", marginBottom: 18 }} />}
                                  </div>
                                );
                              })}
                            </div>
                            {b.status === "review" && (
                              <div style={{ marginTop: 12, padding: "8px 12px", background: T.amberBg, borderRadius: 9, fontSize: 11, color: T.amber, textAlign: "center" }}>
                                ⏳ نراجع إيصال بنكك — تصلك التذكرة خلال 30 دقيقة كحد أقصى
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
                              {b.status === "confirmed" && <Btn size="sm" variant="gold_outline">⬇️ التذكرة</Btn>}
                              <Btn size="sm" variant="ghost" onClick={() => onNav("support")}>💬 مساعدة</Btn>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "wallet" && (
            <div className="fade-in">
              <Card style={{ padding: 26, marginBottom: 16, background: `linear-gradient(135deg, ${T.navy}, ${T.navyMid})`, color: T.pure }}>
                <div style={{ fontSize: 13, opacity: .8 }}>رصيد المحفظة</div>
                <div className="num" style={{ fontSize: 36, fontWeight: 800, color: T.gold, margin: "6px 0" }}>{fmt(45, currency, rates)}</div>
                <div style={{ fontSize: 12, opacity: .7 }}>يُستخدم تلقائياً في حجزك القادم</div>
              </Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }} className="checkout-grid">
                <Card style={{ padding: 20, textAlign: "center" }}>
                  <div className="num" style={{ fontSize: 30, fontWeight: 800, color: T.gold }}>1,250</div>
                  <div style={{ fontSize: 13, color: T.gray500, marginTop: 4 }}>نقاط حاجز</div>
                  <div style={{ fontSize: 11, color: T.gray400, marginTop: 6 }}>= {fmt(12.5, currency, rates)} عند الحجز</div>
                </Card>
                <Card style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>🥈</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>عضو فضي</div>
                  <div style={{ fontSize: 11, color: T.gray400, marginTop: 6 }}>750 نقطة للمستوى الذهبي</div>
                </Card>
              </div>
              <Card style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 14 }}>سجل النقاط</h3>
                {[["حجز فندق هيلتون مكة", "+72", "16 يوليو"], ["حجز طيران الخرطوم→جدة", "+33", "15 يوليو"], ["مكافأة التسجيل", "+500", "1 يوليو"]].map(([t, p, d], x) => (
                  <div key={x} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: x < 2 ? `1px solid ${T.gray100}` : "none" }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t}</div><div style={{ fontSize: 11, color: T.gray400 }}>{d}</div></div>
                    <span className="num" style={{ fontSize: 15, fontWeight: 800, color: T.green }}>{p}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {tab === "travelers" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text }}>المسافرون المحفوظون</h3>
                <Btn size="sm">+ إضافة مسافر</Btn>
              </div>
              <p style={{ fontSize: 13, color: T.gray400, marginBottom: 16 }}>احفظ بيانات المسافرين لتعبئة أسرع عند الحجز</p>
              {[["أحمد الطيب", "جواز P0482913 · السودان", "👤"], ["سارة أحمد الطيب", "جواز P0482914 · السودان", "👤"]].map(([n, d, ic], x) => (
                <Card key={x} style={{ padding: 16, marginBottom: 10, display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{ic}</div>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{n}</div><div className="num" style={{ fontSize: 12, color: T.gray400 }}>{d}</div></div>
                  <button style={{ color: T.gray400, fontSize: 13, background: "none" }}>تعديل</button>
                </Card>
              ))}
            </div>
          )}

          {tab === "favorites" && (
            <div className="fade-in">
              <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 16 }}>المفضلة</h3>
              <EmptyState icon="❤️" title="لا مفضلات بعد" sub="أضف الفنادق والرحلات المفضلة بالضغط على القلب" action={() => onNav("hotels")} actionLabel="تصفح الفنادق" />
            </div>
          )}

          {tab === "profile" && (
            <div className="fade-in">
              <h3 style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 16 }}>الملف الشخصي</h3>
              <Card style={{ padding: 24 }}>
                <Field label="الاسم الكامل" value={user.profile?.fullName || ""} onChange={() => {}} />
                <Field label="البريد الإلكتروني" value={user.email || ""} onChange={() => {}} dir="ltr" />
                <Field label="رقم الهاتف" value={user.profile?.phone || ""} onChange={() => {}} dir="ltr" />
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <Btn>حفظ التعديلات</Btn>
                  <Btn variant="ghost" onClick={() => onNav("home")}>تسجيل الخروج</Btn>
                </div>
              </Card>
              <Card style={{ padding: 20, marginTop: 14 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 12 }}>التفضيلات</h4>
                {[["العملة", "دولار / درهم / جنيه"], ["اللغة", "العربية"], ["الإشعارات", "واتساب + بريد"]].map(([l, v], x) => (
                  <div key={x} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: x < 2 ? `1px solid ${T.gray100}` : "none", fontSize: 13 }}>
                    <span style={{ color: T.gray500 }}>{l}</span><span style={{ color: T.text, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TripsPage = ({ onNav }) => {
  const trips = [
    { id: "HJZ-A4B2C8", emoji: "🚢", title: "باخرة بورتسودان → جدة", date: "5 يوليو 2026", status: "مؤكد", color: "green" },
    { id: "VIS-X9Y2Z1", emoji: "🛂", title: "تأشيرة تركيا", date: "طلب مقدّم — 2 يوليو", status: "قيد المعالجة", color: "amber" },
    { id: "FLT-C3D7E2", emoji: "✈️", title: "طيران الخرطوم → جدة", date: "20 أغسطس 2026", status: "مؤكد", color: "green" },
  ];
  return (
    <PageWrap title="رحلاتي" sub="جميع حجوزاتك في مكان واحد">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {trips.map(t => (
          <Card key={t.id} hover style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{t.emoji}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{t.title}</div>
              <div style={{ fontSize: 13, color: T.gray400, margin: "2px 0 6px" }}>{t.date}</div>
              <Badge color={t.color}>{t.status}</Badge>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.gray400 }}>{t.id}</div>
              <Btn size="sm" variant="gold_outline" style={{ marginTop: 8 }}>التفاصيل</Btn>
            </div>
          </Card>
        ))}
      </div>
    </PageWrap>
  );
};

const WalletPage = ({ currency, rates }) => (
  <PageWrap title="المحفظة والنقاط" sub="رصيدك ونقاط الولاء">
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }} className="checkout-grid">
      <Card style={{ padding: 26, background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, color: T.pure }}>
        <div style={{ fontSize: 13, opacity: 0.8 }}>رصيد المحفظة</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: T.gold, margin: "8px 0" }}>{fmt(45, currency, rates)}</div>
        <Btn size="sm" variant="primary" style={{ marginTop: 8 }}>إضافة رصيد</Btn>
      </Card>
      <Card style={{ padding: 26 }}>
        <div style={{ fontSize: 13, color: T.gray400 }}>نقاط حاجز ⭐</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: T.gold, margin: "8px 0" }}>1,250</div>
        <p style={{ fontSize: 12, color: T.gray400 }}>تعادل {fmt(12.5, currency, rates)} — استبدلها في حجزك القادم</p>
      </Card>
    </div>
    <Card style={{ padding: 22 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>سجل المعاملات</h3>
      {[["استرداد إلغاء طيران", "+$45", T.green, "2 يوليو"], ["نقاط حجز باخرة", "+250 نقطة", T.gold, "28 يونيو"], ["خصم نقاط على تأشيرة", "-100 نقطة", T.gray600, "20 يونيو"]].map(([t, amt, c, d], i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < 2 ? `1px solid ${T.gray100}` : "none" }}>
        <div><div style={{ fontSize: 14, color: T.text }}>{t}</div><div style={{ fontSize: 11, color: T.gray400 }}>{d}</div></div>
        <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{amt}</span>
      </div>
      ))}
    </Card>
  </PageWrap>
);

const PassportsPage = () => {
  const [docs] = useState([
    { name: "محمد أحمد الفاضل", type: "جواز سفر", number: "A12••••••", expiry: "2029", flag: "🇸🇩" },
  ]);
  return (
    <PageWrap title="الجوازات المحفوظة" sub="بيانات السفر لإتمام الحجوزات بسرعة">
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {docs.map((d, i) => (
          <Card key={i} style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 36 }}>{d.flag}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{d.name}</div>
              <div style={{ fontSize: 13, color: T.gray400 }}>{d.type} · {d.number} · ينتهي {d.expiry}</div>
            </div>
            <Btn size="sm" variant="ghost">تعديل</Btn>
          </Card>
        ))}
      </div>
      <Btn variant="gold_outline"> + إضافة مسافر / جواز</Btn>
    </PageWrap>
  );
};

const ProfilePage = ({ user, onUpdateUser }) => {
  const [tab, setTab] = useState("info");
  return (
    <PageWrap title="الملف الشخصي" sub="بياناتك وإعداداتك">
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[["info", "المعلومات الشخصية"], ["identity", "توثيق الهوية"], ["security", "الأمان"], ["prefs", "التفضيلات"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "9px 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, background: tab === t ? T.navyLight : T.card, color: tab === t ? T.gold : T.gray600, border: `1.5px solid ${tab === t ? T.navy : T.gray200}` }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding: 28, maxWidth: 680 }}>
        {tab === "info" && <div className="fade-in">
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 24 }}>
            <div style={{ width: 70, height: 70, borderRadius: "50%", background: T.navy, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>{(user.profile?.fullName || user.email)?.[0]?.toUpperCase() || "ح"}</div>
            <div><div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{user.profile?.fullName || "مستخدم حاجز"}</div><div style={{ fontSize: 14, color: T.gray400, direction: "ltr" }}>{user.email}</div></div>
          </div>
          <Field label="الاسم الكامل" value={user.profile?.fullName || ""} onChange={() => {}} icon="👤" />
          <Field label="رقم الهاتف" value={user.profile?.phone || ""} onChange={() => {}} icon="📱" dir="ltr" />
          <Field label="المدينة" value={user.profile?.city || ""} onChange={() => {}} icon="📍" />
          <Btn style={{ marginTop: 8 }}>حفظ التغييرات</Btn>
        </div>}
        {tab === "identity" && <div className="fade-in">
          {user.pendingVerification ? <>
            <div style={{ padding: "14px 16px", background: T.amberBg, borderRadius: 12, marginBottom: 20, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.amber }}>هويتك غير موثّقة</div><div style={{ fontSize: 12, color: T.amber }}>بعض الخدمات (التأشيرات) تتطلب التوثيق</div></div>
            </div>
            <Card style={{ padding: 24, border: `2px dashed ${T.gold}`, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📘</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 14 }}>ارفع جواز السفر أو البطاقة الوطنية</p>
              <Btn onClick={() => onUpdateUser({ ...user, pendingVerification: false })}>⬆️ رفع الوثيقة</Btn>
            </Card>
          </> : <>
            <div style={{ padding: "14px 16px", background: T.greenBg, borderRadius: 12, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>✅</span>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.green }}>هويتك موثّقة</div><div style={{ fontSize: 12, color: T.green }}>كل خدمات حاجز مفعّلة لحسابك</div></div>
            </div>
          </>}
        </div>}
        {tab === "security" && <div className="fade-in">
          <p style={{ fontSize: 14, color: T.gray600, lineHeight: 1.8, marginBottom: 16 }}>حسابك محمي بنظام رمز التحقق (OTP) عبر البريد — لا كلمات مرور تُخزّن.</p>
          {["تفعيل التحقق بخطوتين", "أجهزة تسجيل الدخول", "سجل النشاط"].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < 2 ? `1px solid ${T.gray100}` : "none" }}><span style={{ fontSize: 14, color: T.text }}>{s}</span><span style={{ color: T.gray300 }}>‹</span></div>
          ))}
        </div>}
        {tab === "prefs" && <div className="fade-in">
          {["اللغة: العربية", "العملة الافتراضية: دولار", "إشعارات البريد", "إشعارات واتساب"].map((s, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < 3 ? `1px solid ${T.gray100}` : "none" }}><span style={{ fontSize: 14, color: T.text }}>{s}</span><span style={{ color: T.gray300 }}>‹</span></div>
          ))}
        </div>}
      </Card>
    </PageWrap>
  );
};

// ═══════════════════════════════════════════════════════════
// FERRIES — Port Sudan ⇄ Jeddah (manual inventory)
// ═══════════════════════════════════════════════════════════
const FerriesPage = ({ currency, rates, onBook, user, requireAuth }) => {
  const [phase, setPhase] = useState("search");
  const [dir, setDir] = useState("PS_JED");
  const [date, setDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [vehicle, setVehicle] = useState(false);
  const [trip, setTrip] = useState(null);
  const [cabin, setCabin] = useState(null);

  const companies = [
    { name: "عُمان للملاحة", emoji: "🚢" }, { name: "الجودي", emoji: "⛴️" },
    { name: "عزيز", emoji: "🛳️" }, { name: "تاركو البحرية", emoji: "⚓" },
  ];
  const trips = [
    { id: 1, co: "عُمان للملاحة", emoji: "🚢", date: "السبت 5 يوليو", dep: "08:00", arr: "18:00", dur: "10 ساعات", cabins: [{ t: "درجة عامة", p: 180, a: 45 }, { t: "درجة سياحية", p: 280, a: 12 }, { t: "كبينة خاصة", p: 420, a: 4 }] },
    { id: 2, co: "الجودي", emoji: "⛴️", date: "السبت 5 يوليو", dep: "14:00", arr: "00:00", dur: "10 ساعات", cabins: [{ t: "درجة عامة", p: 160, a: 80 }, { t: "درجة سياحية", p: 260, a: 20 }] },
    { id: 3, co: "عزيز", emoji: "🛳️", date: "الأحد 6 يوليو", dep: "10:00", arr: "20:00", dur: "10 ساعات", cabins: [{ t: "درجة عامة", p: 175, a: 30 }, { t: "كبينة خاصة", p: 400, a: 6 }] },
  ];
  const total = trip && cabin ? (cabin.p * adults + cabin.p * 0.5 * children + (vehicle ? 150 : 0)) : 0;

  if (phase === "search") return (
    <PageWrap title="حجز البواخر" sub="خط بورتسودان ⇄ جدة — حصرياً على حاجز">
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
        <Card style={{ padding: 28 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {[["PS_JED", "بورتسودان → جدة"], ["JED_PS", "جدة → بورتسودان"]].map(([d, l]) => (
              <button key={d} onClick={() => setDir(d)} style={{ flex: 1, padding: "12px", borderRadius: 12, fontSize: 14, fontWeight: 600, background: dir === d ? T.navyLight : T.gray100, color: dir === d ? T.gold : T.gray600 }}>{l}</button>
            ))}
          </div>
          <Field label="📅 تاريخ السفر" type="date" value={date} onChange={e => setDate(e.target.value)} required />
          <Card style={{ padding: 18, marginBottom: 16, background: T.gray50, border: "none", boxShadow: "none" }}>
            <Counter label="بالغين" sub="12 سنة فأكثر" value={adults} setValue={setAdults} min={1} />
            <Counter label="أطفال" sub="2-11 سنة (نصف السعر)" value={children} setValue={setChildren} />
            <Counter label="رضّع" sub="< سنتين (مجاناً)" value={infants} setValue={setInfants} />
          </Card>
          <div onClick={() => setVehicle(!vehicle)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${vehicle ? T.gold : T.gray200}`, cursor: "pointer", background: vehicle ? `${T.gold}0A` : T.card }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${vehicle ? T.gold : T.gray300}`, background: vehicle ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>{vehicle && <span style={{ color: T.ink, fontSize: 13 }}>✓</span>}</div>
            <div><div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>🚗 شحن سيارة</div><div style={{ fontSize: 12, color: T.gray400 }}>+$150 · يُؤكد مع شركة الملاحة</div></div>
          </div>
          <Btn full size="lg" onClick={() => setPhase("results")} disabled={!date} style={{ marginTop: 20 }}>🔍 ابحث عن رحلات</Btn>
        </Card>
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>شركات الملاحة</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {companies.map((c, i) => (
              <div key={i} style={{ padding: "16px 12px", borderRadius: 12, border: `1px solid ${T.gray200}`, textAlign: "center" }}>
                <div style={{ fontSize: 30 }}>{c.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: "6px 0" }}>{c.name}</div>
                <Badge color="green">متاح</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageWrap>
  );

  if (phase === "results") return (
    <PageWrap title="الرحلات المتاحة" sub={`${dir === "PS_JED" ? "بورتسودان → جدة" : "جدة → بورتسودان"} · ${adults + children} مسافر`}>
      <button onClick={() => setPhase("search")} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 20, background: "none" }}>← تعديل البحث</button>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {trips.map(t => (
          <Card key={t.id} style={{ overflow: "hidden" }}>
            <div style={{ background: T.navy, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{t.emoji}</span>
              <div><div style={{ color: T.pure, fontSize: 15, fontWeight: 700 }}>{t.co}</div><div style={{ color: `${T.white}99`, fontSize: 12 }}>{t.date}</div></div>
              <div style={{ marginRight: "auto", textAlign: "center", color: T.pure }}><div style={{ fontSize: 13 }}>{t.dep} ← {t.arr}</div><div style={{ fontSize: 11, color: `${T.white}99` }}>{t.dur}</div></div>
            </div>
            <div style={{ padding: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: T.gray400, marginBottom: 10 }}>اختر نوع الكبينة</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                {t.cabins.map((c, ci) => (
                  <div key={ci} onClick={() => { if (!user) { requireAuth(); return; } setTrip(t); setCabin(c); setPhase("checkout"); }}
                    style={{ padding: 14, borderRadius: 12, border: `1.5px solid ${T.gray200}`, cursor: "pointer", transition: "all .2s" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = T.gold} onMouseLeave={e => e.currentTarget.style.borderColor = T.gray200}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{c.t}</div>
                    <div style={{ fontSize: 11, color: T.gray400, marginBottom: 8 }}>{c.a} مقعد متاح</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{fmt(c.p, currency, rates)}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageWrap>
  );

  if (phase === "checkout" && trip && cabin) return (
    <PageWrap title="إتمام حجز الباخرة" maxW={1000}>
      <Stepper steps={["البحث", "الاختيار", "البيانات والدفع"]} current={2} />
      <FerryBooking trip={trip} cabin={cabin} dir={dir} adults={adults} children={children} infants={infants} vehicle={vehicle} total={total} currency={currency} rates={rates} onBook={onBook} />
    </PageWrap>
  );
  return null;
};

const FerryBooking = ({ trip, cabin, dir, adults, children, infants, vehicle, total, currency, rates, onBook }) => {
  const [g, setG] = useState({ name: "", passport: "", phone: "" });
  const [showPayment, setShowPayment] = useState(false);
  const valid = g.name && g.passport && g.phone;
  if (showPayment) return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <PaymentGateway total={total} currency={currency} rates={rates} summary={`${trip.co} · ${cabin.t}`}
        onConfirmed={() => onBook({ type: "ferry", title: `${trip.co} ${dir === "PS_JED" ? "بورتسودان→جدة" : "جدة→بورتسودان"}`, total })} onBack={() => setShowPayment(false)} />
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
      <Card style={{ padding: 28 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 18 }}>بيانات المسافر الرئيسي</h3>
        <Field label="الاسم الكامل" value={g.name} onChange={e => setG({ ...g, name: e.target.value })} placeholder="كما في الجواز" icon="👤" required />
        <Field label="رقم جواز السفر" value={g.passport} onChange={e => setG({ ...g, passport: e.target.value })} placeholder="A12345678" icon="📄" dir="ltr" required />
        <Field label="رقم الهاتف" value={g.phone} onChange={e => setG({ ...g, phone: e.target.value })} placeholder="+249..." icon="📱" dir="ltr" required />
        {adults > 1 && <div style={{ padding: "12px 14px", background: T.amberBg, borderRadius: 10, fontSize: 12, color: T.amber, marginBottom: 16 }}>⚠️ بيانات باقي المسافرين ({adults - 1} بالغ، {children} طفل) تُطلب بعد الدفع</div>}
        <Btn full size="lg" disabled={!valid} onClick={() => setShowPayment(true)}>متابعة للدفع →</Btn>
      </Card>
      <Card style={{ padding: 22, position: "sticky", top: 90 }} className="summary-sticky">
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>ملخص التكلفة</h3>
        <div style={{ fontSize: 13, color: T.gray600, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>بالغين ({adults})</span><span>{fmt(cabin.p * adults, currency, rates)}</span></div>
          {children > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>أطفال ({children})</span><span>{fmt(cabin.p * 0.5 * children, currency, rates)}</span></div>}
          {infants > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>رضّع ({infants})</span><span style={{ color: T.green }}>مجاناً</span></div>}
          {vehicle && <div style={{ display: "flex", justifyContent: "space-between" }}><span>شحن سيارة</span><span>{fmt(150, currency, rates)}</span></div>}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: T.text, paddingTop: 14, marginTop: 14, borderTop: `1px solid ${T.gray200}` }}>
          <span>الإجمالي</span><span style={{ color: T.gold }}>{fmt(total, currency, rates)}</span>
        </div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// VISAS — 3 tracks (e-Visa, Embassy, VoA)
// ═══════════════════════════════════════════════════════════
const VisasPage = ({ currency, rates, onBook, user, requireAuth }) => {
  const [tab, setTab] = useState("evisa");
  const [sel, setSel] = useState(null);
  const [step, setStep] = useState(0); // 0=overview 1=docs 2=payment

  const evisas = [
    { country: "🇹🇷 تركيا", type: "e-Visa", price: 43, process: "دقائق – 3 أيام", badge: "الأكثر طلباً", docs: ["جواز سفر ساري 6 أشهر", "بطاقة دفع"] },
    { country: "🇶🇦 قطر (Hayya)", type: "e-Visa", price: 27, process: "24-72 ساعة", docs: ["جواز سفر", "حجز فندق مؤكد"] },
    { country: "🇧🇭 البحرين", type: "e-Visa", price: 27, process: "24-48 ساعة", docs: ["جواز سفر", "صورة شخصية"] },
    { country: "🇴🇲 عُمان", type: "e-Visa", price: 20, process: "24-48 ساعة", docs: ["جواز سفر", "حجز فندق"] },
    { country: "🇪🇹 إثيوبيا", type: "e-Visa", price: 52, process: "3 أيام", docs: ["جواز سفر", "صورة شخصية"] },
    { country: "🇮🇩 إندونيسيا", type: "e-Visa", price: 35, process: "3-5 أيام", docs: ["جواز سفر", "تذكرة عودة"] },
  ];
  const embassy = [
    { country: "🇸🇦 السعودية — عمرة", note: "متاحة للجميع", price: 533, process: "14 يوم عمل", docs: ["جواز ساري 6 أشهر", "صور شخصية 4×6", "كشف حساب بنكي 3 أشهر", "حجز طيران + فندق"] },
    { country: "🇸🇦 السعودية — سياحة", note: "لمقيمي الخليج فقط", price: 120, process: "3-7 أيام عمل", docs: ["جواز ساري", "إقامة سارية"] },
    { country: "🇦🇪 الإمارات", note: "تأشيرة سياحية", price: 150, process: "5-10 أيام", docs: ["جواز ساري 6 أشهر", "كشف حساب", "صورة"] },
    { country: "🇪🇬 مصر", note: "تصريح أمني مطلوب", price: 60, process: "7-14 يوم", docs: ["جواز ساري", "صورة", "حجز فندق"] },
  ];
  const voa = [
    { country: "🇲🇻 المالديف", price: 0, dur: "30 يوم" },
    { country: "🇰🇭 كمبوديا", price: 30, dur: "30 يوم" },
    { country: "🇳🇵 نيبال", price: 25, dur: "15-90 يوم" },
    { country: "🇱🇧 لبنان", price: 0, dur: "شهر" },
  ];

  const [docUploads, setDocUploads] = useState({});
  const [showPayment, setShowPayment] = useState(false);

  if (sel) {
    const total = sel.price + 15;
    if (showPayment) return (
      <PageWrap title="دفع رسوم التأشيرة" maxW={680}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <PaymentGateway total={total} currency={currency} rates={rates} summary={`تأشيرة ${sel.country}`}
            onConfirmed={() => { onBook({ type: "visa", title: `تأشيرة ${sel.country}`, total }); }}
            onBack={() => setShowPayment(false)} />
        </div>
      </PageWrap>
    );
    return (
      <PageWrap title={`تأشيرة ${sel.country}`} maxW={720}>
        <button onClick={() => { setSel(null); setStep(0); setDocUploads({}); setShowPayment(false); }} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 16, background: "none" }}>← رجوع</button>
        <Stepper steps={["التفاصيل", "الوثائق", "الدفع", "المتابعة"]} current={step} />
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          {step === 0 && <div className="fade-in">
            <Card style={{ padding: 24, background: T.navy, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: `${T.white}10`, borderRadius: 12, padding: 14 }}><div style={{ color: `${T.white}80`, fontSize: 11 }}>الرسوم</div><div style={{ color: T.gold, fontSize: 20, fontWeight: 700 }}>{fmt(sel.price, currency, rates)}</div></div>
                <div style={{ background: `${T.white}10`, borderRadius: 12, padding: 14 }}><div style={{ color: `${T.white}80`, fontSize: 11 }}>وقت المعالجة</div><div style={{ color: T.pure, fontSize: 14, fontWeight: 600 }}>{sel.process}</div></div>
              </div>
              <div style={{ marginTop: 14, padding: "10px 12px", background: `${T.white}10`, borderRadius: 10 }}>
                <div style={{ color: `${T.white}80`, fontSize: 11, marginBottom: 4 }}>تشمل رسوم خدمة حاجز</div>
                <div style={{ color: T.pure, fontSize: 13 }}>+{fmt(15, currency, rates)} (معالجة الطلب)</div>
              </div>
            </Card>
            <Card style={{ padding: 22, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>الوثائق المطلوبة</h3>
              {sel.docs.map((d, i) => <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: i < sel.docs.length - 1 ? `1px solid ${T.gray100}` : "none" }}><span style={{ color: T.green }}>✓</span><span style={{ fontSize: 14, color: T.gray800 }}>{d}</span></div>)}
            </Card>
            <div style={{ padding: "12px 16px", background: T.amberBg, borderRadius: 12, fontSize: 13, color: T.amber, marginBottom: 18 }}>⚠️ المعالجة يدوية من فريق حاجز المتخصص · {sel.process}</div>
            <Btn full size="lg" onClick={() => { if (!user) { requireAuth(); return; } setStep(1); }}>التالي — رفع الوثائق</Btn>
          </div>}

          {step === 1 && <div className="fade-in">
            <Card style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 16 }}>رفع الوثائق المطلوبة</h3>
              {sel.docs.map((d, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i < sel.docs.length - 1 ? `1px solid ${T.gray100}` : "none" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 20 }}>{docUploads[i] ? "✅" : "📄"}</span><span style={{ fontSize: 14, color: T.text }}>{d}</span></div>
                  <Btn size="sm" variant={docUploads[i] ? "success" : "gold_outline"} onClick={() => setDocUploads({ ...docUploads, [i]: true })}>
                    {docUploads[i] ? "✓ تم" : "⬆ رفع"}
                  </Btn>
                </div>
              ))}
            </Card>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setStep(0)}>رجوع</Btn>
              <Btn full onClick={() => setStep(2)} disabled={Object.keys(docUploads).length < sel.docs.length}>التالي — الدفع</Btn>
            </div>
          </div>}

          {step === 2 && <div className="fade-in">
            <Card style={{ padding: 22, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.gray600, marginBottom: 8 }}><span>رسوم التأشيرة</span><span>{fmt(sel.price, currency, rates)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.gray600, marginBottom: 12 }}><span>رسوم خدمة حاجز</span><span>{fmt(15, currency, rates)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: T.text, paddingTop: 12, borderTop: `1px solid ${T.gray200}` }}>
                <span>الإجمالي</span><span style={{ color: T.gold }}>{fmt(total, currency, rates)}</span>
              </div>
            </Card>
            <PaymentGateway total={total} currency={currency} rates={rates} summary={`تأشيرة ${sel.country}`}
              onConfirmed={() => onBook({ type: "visa", title: `تأشيرة ${sel.country}`, total })}
              onBack={() => setStep(1)} />
          </div>}
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap title="التأشيرات" sub="نتقدّم بطلبك ونعالجه نيابةً عنك بدون زيارة السفارة">
      <div style={{ display: "flex", gap: 8, marginBottom: 24, maxWidth: 500 }}>
        {[["evisa", "🌐 e-Visa"], ["embassy", "🏛️ سفارة"], ["voa", "🛬 عند الوصول"]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "11px", borderRadius: 11, fontSize: 13, fontWeight: 600, background: tab === t ? T.navyLight : T.card, color: tab === t ? T.gold : T.gray600, border: `1px solid ${tab === t ? T.navy : T.gray200}`, transition: "all .2s" }}>{l}</button>
        ))}
      </div>
      {tab === "evisa" && <>
        <div style={{ padding: "12px 16px", background: T.greenBg, borderRadius: 12, fontSize: 13, color: T.green, marginBottom: 20 }}>✅ بدون زيارة سفارة — نتقدّم بالطلب إلكترونياً نيابةً عنك بالكامل</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
          {evisas.map((v, i) => (
            <Card key={i} hover onClick={() => setSel(v)} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{v.country}</div>
                {v.badge && <Badge color="gold">⭐ {v.badge}</Badge>}
              </div>
              <div style={{ fontSize: 13, color: T.gray400, marginBottom: 12 }}>{v.type}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Badge color="gray">⏱ {v.process}</Badge>
                <span style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>{fmt(v.price, currency, rates)}</span>
              </div>
            </Card>
          ))}
        </div>
      </>}
      {tab === "embassy" && <>
        <div style={{ padding: "12px 16px", background: T.amberBg, borderRadius: 12, fontSize: 13, color: T.amber, marginBottom: 20 }}>⚠️ تتطلب تقديماً عبر السفارة أو مركز التأشيرات — حاجز يرافقك في كل خطوة</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 16 }}>
          {embassy.map((v, i) => (
            <Card key={i} style={{ padding: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 4 }}>{v.country}</div>
              <div style={{ fontSize: 13, color: T.gray400, marginBottom: 10 }}>{v.note}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <Badge color="gray">⏱ {v.process}</Badge>
                <span style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{fmt(v.price, currency, rates)}</span>
              </div>
              <Btn full size="sm" variant="gold_outline" onClick={() => setSel(v)}>تقديم الطلب</Btn>
            </Card>
          ))}
        </div>
      </>}
      {tab === "voa" && <>
        <div style={{ padding: "12px 16px", background: T.greenBg, borderRadius: 12, fontSize: 13, color: T.green, marginBottom: 20 }}>✅ تُمنح عند الوصول — لا تقديم مسبق. حاجز يوفر معلومات ومستندات السفر المطلوبة.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {voa.map((v, i) => (
            <Card key={i} style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{v.country}</div><div style={{ fontSize: 12, color: T.gray400 }}>{v.dur}</div></div>
              {v.price === 0 ? <Badge color="green">مجاناً</Badge> : <span style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{fmt(v.price, currency, rates)}</span>}
            </Card>
          ))}
        </div>
      </>}
    </PageWrap>
  );
};

// ═══════════════════════════════════════════════════════════
// INSURANCE — 3 plans with full payment
// ═══════════════════════════════════════════════════════════
const InsurancePage = ({ currency, rates, onBook, user, requireAuth }) => {
  const [sel, setSel] = useState(null);
  const [traveler, setTraveler] = useState({ name: "", passport: "", start: "", end: "" });
  const [showPayment, setShowPayment] = useState(false);

  const plans = [
    { id: "comp", name: "تغطية شاملة", icon: "🛡️", price: 59, color: T.text, badge: "الأفضل قيمة",
      features: ["تغطية طبية غير محدودة", "إلغاء الرحلة حتى $10,000", "إخلاء طبي طارئ عالمي", "مساعدة 24/7 متعددة اللغات", "تغطية أمتعة حتى $2,000", "تأخير الرحلة"] },
    { id: "basic", name: "تغطية أساسية", icon: "🔰", price: 39, color: T.gray600, badge: "",
      features: ["تغطية طبية حتى $50,000", "تأخير الرحلة +4 ساعات", "تغطية أمتعة حتى $500", "مساعدة 24/7"] },
    { id: "hajj", name: "حج وعمرة", icon: "🕌", price: 45, color: T.goldDark, badge: "حصري",
      features: ["تغطية خاصة بالمناسك", "طوارئ طبية بالأماكن المقدسة", "تأخير أو إلغاء المناسك", "تغطية صحية شاملة", "خدمة مرافق طبي"] },
  ];

  if (sel) {
    const valid = traveler.name && traveler.passport && traveler.start && traveler.end;
    if (showPayment) return (
      <PageWrap title="دفع التأمين" maxW={640}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <PaymentGateway total={sel.price} currency={currency} rates={rates} summary={sel.name}
            onConfirmed={() => onBook({ type: "insurance", title: sel.name, total: sel.price })}
            onBack={() => setShowPayment(false)} />
        </div>
      </PageWrap>
    );
    return (
      <PageWrap title="تفاصيل التأمين" maxW={1000}>
        <Stepper steps={["اختيار الخطة", "البيانات والدفع"]} current={1} />
        <button onClick={() => setSel(null)} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 16, background: "none" }}>← تغيير الخطة</button>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
          <Card style={{ padding: 28 }}>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 18 }}>بيانات المؤمَّن عليه</h3>
            <Field label="الاسم الكامل" value={traveler.name} onChange={e => setTraveler({ ...traveler, name: e.target.value })} placeholder="كما في الجواز" icon="👤" required />
            <Field label="رقم جواز السفر" value={traveler.passport} onChange={e => setTraveler({ ...traveler, passport: e.target.value })} placeholder="A12345678" icon="📄" dir="ltr" required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="بداية التغطية" type="date" value={traveler.start} onChange={e => setTraveler({ ...traveler, start: e.target.value })} required />
              <Field label="نهاية التغطية" type="date" value={traveler.end} onChange={e => setTraveler({ ...traveler, end: e.target.value })} required />
            </div>
            <Btn full size="lg" disabled={!valid} onClick={() => { if (!user) { requireAuth(); return; } setShowPayment(true); }} style={{ marginTop: 8 }}>متابعة للدفع →</Btn>
          </Card>
          <Card style={{ padding: 22, position: "sticky", top: 90 }} className="summary-sticky">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 26 }}>{sel.icon}</span>
              <div><div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{sel.name}</div>{sel.badge && <Badge color="gold">{sel.badge}</Badge>}</div>
            </div>
            {sel.features.map((f, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}><span style={{ color: T.green, fontSize: 13 }}>✓</span><span style={{ fontSize: 13, color: T.gray800 }}>{f}</span></div>)}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 800, color: T.text, paddingTop: 14, marginTop: 8, borderTop: `1px solid ${T.gray200}` }}>
              <span>الإجمالي</span><span style={{ color: T.gold }}>{fmt(sel.price, currency, rates)}</span>
            </div>
          </Card>
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap title="تأمين السفر" sub="حماية شاملة لرحلتك — راحة بال حقيقية">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 20 }}>
        {plans.map(p => (
          <Card key={p.id} style={{ overflow: "hidden", border: `2px solid ${T.gray100}` }}>
            <div style={{ background: p.color, padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 26 }}>{p.icon}</span>
                  <div>
                    <div style={{ color: T.pure, fontSize: 16, fontWeight: 700 }}>{p.name}</div>
                    {p.badge && <Badge color="gold">{p.badge}</Badge>}
                  </div>
                </div>
                <div><div style={{ color: T.gold, fontSize: 24, fontWeight: 800 }}>{fmt(p.price, currency, rates)}</div><div style={{ color: `${T.white}80`, fontSize: 11 }}>للرحلة</div></div>
              </div>
            </div>
            <div style={{ padding: 22 }}>
              {p.features.map((f, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}><span style={{ color: T.green }}>✓</span><span style={{ fontSize: 14, color: T.gray800 }}>{f}</span></div>)}
              <Btn full style={{ marginTop: 12 }} onClick={() => setSel(p)}>اختر هذه الخطة</Btn>
            </div>
          </Card>
        ))}
      </div>
      <p style={{ marginTop: 20, fontSize: 12, color: T.gray400, padding: "12px 16px", background: T.gray50, borderRadius: 10 }}>⚠️ الحالات المزمنة السابقة قد لا تُغطى. اقرأ وثيقة التأمين كاملة قبل الشراء. الأسعار لمسافر واحد رحلة واحدة.</p>
    </PageWrap>
  );
};

// ═══════════════════════════════════════════════════════════
// PACKAGES — data-driven, designed for admin customization
// Admin pulls from API, edits (price/images/itinerary/inclusions)
// controls visibility — this page renders whatever admin publishes
// ═══════════════════════════════════════════════════════════

// This is the structure admin CMS would save and this page renders
// In production: fetch from BackendService.getPackages()
const PACKAGES_DATA = [
  {
    id: "umra-7n", cat: "religious", title: "باقة العمرة الشاملة", sub: "7 ليالي",
    emoji: "🕌", badge: "الأكثر طلباً", price: 850, originalPrice: 950,
    visible: true, featured: true,
    includes: ["تذكرة طيران ذهاباً وعودة", "7 ليالي فندق 5★ قرب الحرم", "خدمات العمرة الكاملة", "تنقلات داخلية مكة - المدينة", "مرشد ديني متخصص", "وجبات (إفطار + عشاء)"],
    itinerary: [
      { day: 1, title: "الوصول والاستقبال", desc: "المطار → الفندق → راحة وتوجيه" },
      { day: 2, title: "أداء العمرة", desc: "الطواف والسعي وزيارة المواقع" },
      { day: 3, title: "المدينة المنورة", desc: "زيارة المسجد النبوي والمواقع" },
      { day: 7, title: "المغادرة", desc: "المطار والعودة" },
    ],
    terms: "الأسعار قابلة للتعديل حسب الموسم. التحويل من مطار جدة. يشترط جواز ساري 6 أشهر.",
    images: ["🕌", "🏨", "🛫"],
  },
  {
    id: "istanbul-5n", cat: "cultural", title: "إسطنبول الساحرة", sub: "5 ليالي",
    emoji: "🌉", badge: "✨ جديد", price: 680, originalPrice: null,
    visible: true, featured: false,
    includes: ["تأشيرة e-Visa مُستخرجة بالكامل", "تذكرة طيران ذهاباً وعودة", "5 ليالي فندق 4★ وسط المدينة", "جولات سياحية يومية مرشودة", "إفطار يومي"],
    itinerary: [{ day: 1, title: "الوصول", desc: "مطار إسطنبول → الفندق" }, { day: 2, title: "آيا صوفيا والمسجد الأزرق", desc: "جولة المنطقة التاريخية" }],
    terms: "السعر لشخصين في غرفة مزدوجة. التأشيرة مشمولة.",
    images: ["🌉"],
  },
  {
    id: "dubai-fam", cat: "family", title: "دبي للعائلة", sub: "4 ليالي",
    emoji: "🌇", badge: "👨‍👩‍👧 عائلي", price: 550, originalPrice: 620,
    visible: true, featured: false,
    includes: ["تذكرة طيران لكل أفراد العائلة", "4 ليالي فندق 4★", "تذاكر مدينة الملاهي", "جولة برج خليفة", "أنشطة للأطفال"],
    itinerary: [],
    terms: "للعائلة (2 بالغ + 2 طفل). أسعار إضافية للأطفال أكبر.",
    images: ["🌇"],
  },
  {
    id: "maldives-honey", cat: "honeymoon", title: "المالديف — شهر العسل", sub: "7 ليالي شامل كلياً",
    emoji: "🏝️", badge: "💍 رومانسي", price: 2200, originalPrice: null,
    visible: true, featured: true,
    includes: ["رحلة بحرية خاصة للجزيرة", "بنغلو فوق الماء 7 ليالٍ", "إقامة كاملة (وجبات + مشروبات)", "جلستان سبا رومانسيتان", "جولة غوص + ركوب زوارق", "تصوير احترافي للذكريات"],
    itinerary: [],
    terms: "السعر للشخصين. يُحجز قبل 30 يوم على الأقل.",
    images: ["🏝️"],
  },
];

const PackagesPage = ({ currency, rates, onBook, user, requireAuth }) => {
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState(null);
  const [showItinerary, setShowItinerary] = useState(false);
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const cats = [{ id: "all", l: "الكل" }, { id: "religious", l: "🕌 ديني" }, { id: "cultural", l: "🏛️ ثقافي" }, { id: "family", l: "👨‍👩‍👧 عائلي" }, { id: "honeymoon", l: "💍 شهر العسل" }];
  const filtered = PACKAGES_DATA.filter(p => p.visible && (cat === "all" || p.cat === cat));

  if (sel) {
    const total = sel.price * pax;
    if (showPayment) return (
      <PageWrap title="حجز الباقة" maxW={640}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <PaymentGateway total={total} currency={currency} rates={rates} summary={sel.title}
            onConfirmed={() => onBook({ type: "package", title: sel.title, total })}
            onBack={() => setShowPayment(false)} />
        </div>
      </PageWrap>
    );
    return (
      <PageWrap title={sel.title} sub={sel.sub}>
        <button onClick={() => { setSel(null); setShowPayment(false); setShowItinerary(false); }} style={{ color: T.gold, fontSize: 14, fontWeight: 600, marginBottom: 20, background: "none" }}>← رجوع للباقات</button>
        <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 24, alignItems: "start" }} className="checkout-grid">
          <div>
            <Card style={{ overflow: "hidden", marginBottom: 20 }}>
              <div style={{ height: 220, background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, position: "relative" }}>
                {sel.emoji}
                {sel.originalPrice && <div style={{ position: "absolute", top: 16, left: 16 }}><Badge color="red">وفّر {fmt(sel.originalPrice - sel.price, currency, rates)}</Badge></div>}
                {sel.badge && <div style={{ position: "absolute", top: 16, right: 16 }}><Badge color="gold">{sel.badge}</Badge></div>}
              </div>
              <div style={{ padding: 24 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 14 }}>ما تشمله الباقة</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {sel.includes.map((inc, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: T.green, marginTop: 2, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 13, color: T.gray800, lineHeight: 1.5 }}>{inc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Itinerary — from admin customization */}
            {sel.itinerary.length > 0 && (
              <Card style={{ padding: 22, marginBottom: 20 }}>
                <button onClick={() => setShowItinerary(!showItinerary)} style={{ display: "flex", justifyContent: "space-between", width: "100%", background: "none", fontSize: 16, fontWeight: 700, color: T.text }}>
                  <span>برنامج الرحلة اليومي</span><span style={{ color: T.gold }}>{showItinerary ? "▲" : "▼"}</span>
                </button>
                {showItinerary && <div style={{ marginTop: 14 }}>
                  {sel.itinerary.map((d, i) => (
                    <div key={i} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: T.navy, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>يوم {d.day}</div>
                      <div><div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{d.title}</div><div style={{ fontSize: 13, color: T.gray500 }}>{d.desc}</div></div>
                    </div>
                  ))}
                </div>}
              </Card>
            )}

            {sel.terms && (
              <Card style={{ padding: 16, background: T.gray50, border: "none", boxShadow: "none" }}>
                <p style={{ fontSize: 12, color: T.gray500, lineHeight: 1.7 }}>📋 الشروط: {sel.terms}</p>
              </Card>
            )}
          </div>

          <Card style={{ padding: 24, position: "sticky", top: 90 }} className="summary-sticky">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: T.gray400 }}>السعر للشخص</span>
              {sel.originalPrice && <div style={{ fontSize: 14, color: T.gray400, textDecoration: "line-through" }}>{fmt(sel.originalPrice, currency, rates)}</div>}
              <div style={{ fontSize: 28, fontWeight: 800, color: T.gold }}>{fmt(sel.price, currency, rates)}</div>
            </div>
            <Field label="تاريخ السفر" type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: T.gray800, display: "block", marginBottom: 7 }}>عدد المسافرين</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 16px", border: `1.5px solid ${T.gray200}`, borderRadius: 12 }}>
                <button onClick={() => setPax(Math.max(1, pax - 1))} style={{ width: 28, height: 28, borderRadius: "50%", background: T.gray100, fontSize: 16 }}>−</button>
                <span style={{ flex: 1, textAlign: "center", fontWeight: 700 }}>{pax} مسافر</span>
                <button onClick={() => setPax(pax + 1)} style={{ width: 28, height: 28, borderRadius: "50%", background: T.navy, color: T.gold, fontSize: 16 }}>+</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.gray600, marginBottom: 12 }}>
              <span>{fmt(sel.price, currency, rates)} × {pax}</span><span style={{ fontWeight: 700, color: T.text }}>{fmt(total, currency, rates)}</span>
            </div>
            <Btn full size="lg" onClick={() => { if (!user) { requireAuth(); return; } setShowPayment(true); }}>احجز الباقة</Btn>
            <Btn full variant="whatsapp" style={{ marginTop: 10 }} onClick={() => window.open("https://wa.me/249900000000?text=" + encodeURIComponent("مرحباً حاجز، عندي استفسار"), "_blank")}>💬 استفسر عبر واتساب</Btn>
          </Card>
        </div>
      </PageWrap>
    );
  }

  return (
    <PageWrap title="الباقات السياحية" sub="رحلات متكاملة يخصّصها فريق حاجز بعناية">
      <div style={{ display: "flex", gap: 8, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setCat(c.id)} style={{ flexShrink: 0, padding: "9px 18px", borderRadius: 20, fontSize: 14, fontWeight: 600, background: cat === c.id ? T.navyLight : T.card, color: cat === c.id ? T.gold : T.gray600, border: `1.5px solid ${cat === c.id ? T.navy : T.gray200}`, transition: "all .2s" }}>{c.l}</button>
        ))}
      </div>
      {/* Featured packages row */}
      {filtered.some(p => p.featured) && <div style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: T.gray400, marginBottom: 14 }}>⭐ مختارة من حاجز</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.filter(p => p.featured).map(p => <PackageCard key={p.id} p={p} currency={currency} rates={rates} onSelect={setSel} />)}
        </div>
      </div>}
      {filtered.some(p => !p.featured) && <div>
        {filtered.some(p => p.featured) && <h3 style={{ fontSize: 16, fontWeight: 700, color: T.gray400, marginBottom: 14 }}>كل الباقات</h3>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {filtered.filter(p => !p.featured).map(p => <PackageCard key={p.id} p={p} currency={currency} rates={rates} onSelect={setSel} />)}
        </div>
      </div>}
    </PageWrap>
  );
};

const PackageCard = ({ p, currency, rates, onSelect }) => (
  <Card hover style={{ overflow: "hidden", position: "relative" }}>
    <div style={{ position: "absolute", top: 14, left: 14, zIndex: 2 }}>
      <FavoriteBtn type="package" id={p.id} />
    </div>
    <div style={{ height: 170, background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60, position: "relative" }}>
      {p.emoji}
      {p.badge && <div style={{ position: "absolute", top: 14, right: 14 }}><Badge color="gold">{p.badge}</Badge></div>}
      {p.originalPrice && <div style={{ position: "absolute", bottom: 14, left: 14 }}><Badge color="red">خصم</Badge></div>}
    </div>
    <div style={{ padding: 20 }}>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4 }}>{p.title}</h3>
      <p style={{ fontSize: 13, color: T.gray400, marginBottom: 14 }}>{p.sub}</p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {p.originalPrice && <div style={{ fontSize: 12, color: T.gray400, textDecoration: "line-through" }}>{fmt(p.originalPrice, currency, rates)}</div>}
          <div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{fmt(p.price, currency, rates)}</div>
          <div style={{ fontSize: 11, color: T.gray400 }}>/ الشخص</div>
        </div>
        <Btn size="sm" onClick={() => onSelect(p)}>التفاصيل</Btn>
      </div>
    </div>
  </Card>
);

// ═══════════════════════════════════════════════════════════
// SUPPORT — Live Chat + FAQ Accordion
// ═══════════════════════════════════════════════════════════
const SupportPage = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    { q: "كيف أدفع عبر بنكك؟", a: "اختر بنكك كطريقة دفع، ستحصل على رقم مرجع وحساب حاجز، حوّل المبلغ وأضف رقم المرجع في الملاحظات، ثم ارفع صورة الإيصال. يراجعه فريقنا المالي ويؤكد حجزك خلال 30 دقيقة. لا تأكيد آلي — كل دفعة تُراجع يدوياً لحمايتك." },
    { q: "هل يمكنني الإلغاء والاسترداد؟", a: "يختلف حسب الخدمة والباقة. الطيران: حسب سياسة شركة الطيران. الفنادق: تظهر سياسة الإلغاء واضحة قبل الدفع (مجاني، جزئي، أو غير قابل). التأشيرات: رسوم المعالجة غير مستردة إذا تقدمنا بالطلب. تجد السياسة في صفحة كل حجز." },
    { q: "متى تصلني تأكيدات البواخر؟", a: "بعد رفع إيصال بنكك ومراجعته (30 دقيقة)، تصلك تذكرة الباخرة على بريدك وواتساب مباشرة. في حالات الطوارئ تواصل بنا عبر واتساب وسنحل المسألة فوراً." },
    { q: "كيف أتابع طلب تأشيرتي؟", a: "من صفحة «رحلاتي» تجد حالة كل طلب محدّثة. كما تصلك إشعارات بريد في كل مرحلة: استلام الطلب، قيد المعالجة، صدور التأشيرة أو رفضها مع الأسباب." },
    { q: "ما الفرق بين الوكيل والمسوّق؟", a: "الوكيل (Travel Agent): يحجز بشكل رسمي بالنيابة عن عملائه، يحتاج رخصة مزاولة، عمولة 6-12% تُخصم من الهامش. المسوّق (Affiliate): يُحيل عملاء عبر رابطه الخاص، عمولة 3-7% على كل حجز ناجح. كلاهما لهما لوحة تحكم منفصلة." },
    { q: "بأي عملة تعرض حاجز الأسعار؟", a: "تعرض الأسعار بالدولار الأمريكي (العملة الأساسية) أو الجنيه السوداني أو الدرهم الإماراتي — تختار من أعلى الصفحة. سعر الصرف يُحدَّث يدوياً من لوحة التحكم ويُطبّق فوراً." },
  ];
  return (
    <PageWrap title="مركز المساعدة" sub="فريق دعم عربي حقيقي — متاح 7 أيام">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 40 }}>
        {[
          { icon: "💬", title: "محادثة مباشرة", sub: "متاح الآن", color: T.green, action: () => setChatOpen(true) },
          { icon: "📱", title: "واتساب", sub: "رد خلال دقائق", color: "#25D366" },
          { icon: "📧", title: "البريد الإلكتروني", sub: "support@hajiz.com", color: T.text },
          { icon: "📞", title: "هاتف", sub: "9ص - 9م", color: T.gold },
        ].map((s, i) => (
          <Card key={i} hover onClick={s.action} style={{ padding: 22, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 12px" }}>{s.icon}</div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.title}</h3>
            <p style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>{s.sub}</p>
          </Card>
        ))}
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 18 }}>الأسئلة الشائعة</h2>
      <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 10 }}>
        {faqs.map((f, i) => (
          <Card key={i} style={{ overflow: "hidden" }}>
            <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", textAlign: "right" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{f.q}</span>
              <span style={{ fontSize: 20, color: T.gold, transition: "transform .3s", transform: openFaq === i ? "rotate(45deg)" : "none", flexShrink: 0, marginRight: 12 }}>+</span>
            </button>
            {openFaq === i && <div className="fade-in" style={{ padding: "0 22px 20px", paddingTop: 0, fontSize: 14, color: T.gray600, lineHeight: 1.8, borderTop: `1px solid ${T.gray100}`, paddingTop: 16 }}>{f.a}</div>}
          </Card>
        ))}
      </div>
      {chatOpen && <LiveChat onClose={() => setChatOpen(false)} />}
    </PageWrap>
  );
};

const LiveChat = ({ onClose }) => {
  const [messages, setMessages] = useState([{ role: "bot", text: "أهلاً! أنا مساعد حاجز الذكي 👋 كيف أقدر أساعدك؟" }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  // ===== GEMINI API INTEGRATION POINT =====
  // Replace getBotReply with: fetch('/api/chat', { method:'POST', body: JSON.stringify({messages}) })
  // Backend uses Gemini + system prompt trained on Hajiz policies/FAQ
  const getBotReply = (txt) => {
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      const t = txt.toLowerCase();
      let r = "شكراً! سيتواصل معك أحد من فريق الدعم خلال دقائق. رقم واتساب: +249-xxx-xxxx";
      if (t.includes("بنكك") || t.includes("دفع")) r = "للدفع عبر بنكك: اختر بنكك → حوّل للرقم المعروض → اكتب رقم المرجع في الملاحظات → ارفع الإيصال. نؤكد خلال 30 دقيقة. 🏦";
      else if (t.includes("باخرة") || t.includes("بواخر")) r = "خط بورتسودان ⇄ جدة متاح مع 4 شركات ملاحية. ابحث في قسم البواخر واختر التاريخ والكبينة. 🚢";
      else if (t.includes("تأشيرة") || t.includes("فيزا")) r = "نقدّم e-Visa لتركيا وقطر والبحرين وعُمان والمزيد. نتقدّم بالطلب بدلاً عنك ونتابع حتى الوصول. 🛂";
      else if (t.includes("باقة") || t.includes("عمرة")) r = "باقة العمرة 7 ليالٍ تبدأ من $850 تشمل الطيران والفندق 5★ والمرشد. احجز من قسم الباقات أو أرسل لي تواريخك. 🕌";
      else if (t.includes("مرحبا") || t.includes("السلام") || t.includes("هلا")) r = "أهلاً وسهلاً! 🌟 اسألني عن الطيران، الفنادق، البواخر، التأشيرات، الباقات، أو طرق الدفع.";
      setMessages(m => [...m, { role: "bot", text: r }]);
    }, 1100);
  };

  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { role: "user", text: input }]);
    getBotReply(input);
    setInput("");
  };

  return (
    <div style={{ position: "fixed", bottom: 24, left: 24, width: 380, maxWidth: "calc(100vw - 48px)", height: 540, maxHeight: "80vh", background: T.card, borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,.3)", display: "flex", flexDirection: "column", zIndex: 2000 }} className="scale-in">
      <div style={{ background: T.navy, padding: "16px 20px", borderRadius: "20px 20px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🤖</div>
          <div><div style={{ color: T.pure, fontSize: 15, fontWeight: 700 }}>مساعد حاجز</div><div style={{ color: T.green, fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green, display: "inline-block" }} />متصل</div></div>
        </div>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: `${T.white}1A`, color: T.pure, fontSize: 16 }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: T.gray50 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-start" : "flex-end", maxWidth: "82%" }}>
            <div style={{ padding: "10px 14px", borderRadius: m.role === "user" ? "14px 14px 14px 4px" : "14px 14px 4px 14px", background: m.role === "user" ? T.gold : T.card, color: m.role === "user" ? T.ink : T.gray800, fontSize: 14, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>{m.text}</div>
          </div>
        ))}
        {typing && <div style={{ alignSelf: "flex-end" }}><div style={{ padding: "12px 16px", borderRadius: "14px 14px 4px 14px", background: T.card, display: "flex", gap: 4 }}>{[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: T.gray400, animation: `pulse 1s infinite`, animationDelay: `${i * 0.2}s` }} />)}</div></div>}
        <div ref={endRef} />
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${T.gray100}`, display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="اكتب رسالتك..." style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 12, fontSize: 14, background: T.card, color: T.text }} onFocus={e => e.target.style.borderColor = T.gold} onBlur={e => e.target.style.borderColor = T.gray200} />
        <button onClick={send} style={{ width: 44, height: 44, borderRadius: 12, background: T.navy, color: T.gold, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>↑</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// HOMEPAGE / LANDING
// ═══════════════════════════════════════════════════════════
const HomePage = ({ onNav, currency, rates, onAuth, onSearch }) => {
  const [searchTab, setSearchTab] = useState("flights");
  const services = NAV_ORDER.map(id => SERVICES_CONFIG[id]);
  const destinations = [
    { city: "مكة المكرمة", country: "السعودية", price: 280, emoji: "🕌" },
    { city: "جدة", country: "السعودية", price: 250, emoji: "🌊" },
    { city: "دبي", country: "الإمارات", price: 320, emoji: "🌇" },
    { city: "إسطنبول", country: "تركيا", price: 380, emoji: "🌉" },
    { city: "القاهرة", country: "مصر", price: 220, emoji: "🏛️" },
    { city: "الدوحة", country: "قطر", price: 290, emoji: "🏙️" },
  ];
  const offers = [
    { title: "باقة العمرة الكاملة", sub: "7 ليالٍ · 5★ قرب الحرم", price: 850, badge: "🔥 الأكثر طلباً", emoji: "🕌", page: "packages" },
    { title: "إسطنبول الساحرة", sub: "5 ليالٍ · فيزا + طيران", price: 680, badge: "✨ جديد", emoji: "🌉", page: "packages" },
    { title: "دبي للعائلة", sub: "4 ليالٍ · فندق + أنشطة", price: 550, badge: "👨‍👩‍👧 عائلي", emoji: "🌇", page: "packages" },
  ];
  const whyUs = [
    { icon: "🏦", title: "ادفع ببنكك", desc: "الوحيدون الذين يقبلون الدفع المحلي السوداني عبر بنكك وفوري — بدون تعقيدات" },
    { icon: "🚢", title: "بواخر حصرية", desc: "خط بورتسودان ⇄ جدة مع 4 شركات ملاحية في منصة واحدة" },
    { icon: "🌍", title: "ثلاث عملات", desc: "جنيه · دولار · درهم — تختار ما يناسبك، للمقيمين والمغتربين" },
    { icon: "💬", title: "دعم عربي حقيقي", desc: "فريق يفهمك ويتحدث لغتك — لا ردود آلية، لا انتظار ساعات" },
  ];

  return (
    <div>
      {/* HERO — Cinematic Dark Luxury */}
      <section style={{ position: "relative", minHeight: "92vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "104px 24px 90px", background: "radial-gradient(1100px 560px at 85% -12%, #EAF0F8 0%, rgba(234,240,248,0) 62%), radial-gradient(900px 520px at -12% 112%, #F3EEE2 0%, rgba(243,238,226,0) 60%), #F7F8FA" }}>
        <div style={{ position: "absolute", top: "-14%", right: "8%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(184,134,47,.14), transparent 65%)", filter: "blur(70px)", animation: "floatA 14s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-18%", left: "4%", width: 620, height: 620, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,.10), transparent 60%)", filter: "blur(90px)", animation: "floatB 18s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, opacity: .4, backgroundImage: "repeating-linear-gradient(0deg, rgba(12,27,46,.02) 0 1px, transparent 1px 3px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1080, width: "100%", position: "relative", textAlign: "center" }}>
          <div className="reveal-1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 30, background: "rgba(184,134,47,.08)", border: "1px solid rgba(184,134,47,.28)", fontSize: 13, color: T.goldDark, marginBottom: 26 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.gold, display: "inline-block" }} />
            منصة السفر الأولى للسودانيين — ادفع ببنكك
          </div>
          <h1 className="reveal-2" style={{ fontSize: "clamp(38px, 6.4vw, 76px)", fontWeight: 800, color: T.text, lineHeight: 1.16, margin: "0 0 6px" }}>وين رحلتك</h1>
          <h1 className="reveal-3" style={{ fontSize: "clamp(38px, 6.4vw, 76px)", fontWeight: 800, lineHeight: 1.16, margin: "0 0 22px", background: `linear-gradient(120deg, ${T.goldLight}, ${T.gold} 55%, #9d7a2e)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>الجاية؟</h1>
          <p className="reveal-3" style={{ fontSize: "clamp(15px, 1.9vw, 19px)", color: "rgba(12,27,46,.62)", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.85 }}>
            طيران وفنادق بأسعار شفافة — احجز خلال دقائق وادفع ببنكك بكل ثقة.
          </p>

          <div className="reveal-4 glass" style={{ borderRadius: 24, padding: 10, maxWidth: 940, margin: "0 auto", boxShadow: "0 30px 80px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", gap: 4, padding: "6px 8px 10px", borderBottom: "1px solid rgba(184,134,47,.16)", flexWrap: "wrap" }}>
              {NAV_ORDER.filter(id => SERVICES_CONFIG[id].live).map(id => {
                const s = SERVICES_CONFIG[id];
                return (
                  <button key={id} onClick={() => setSearchTab(id)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: searchTab === id ? `linear-gradient(135deg,${T.gold},${T.goldDark})` : "transparent", color: searchTab === id ? T.ink : "rgba(12,27,46,.75)", transition: "var(--tr)" }}>
                    <span>{s.icon}</span>{s.label}
                  </button>
                );
              })}
              {NAV_ORDER.filter(id => !SERVICES_CONFIG[id].live).slice(0, 2).map(id => (
                <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 14px", fontSize: 12, color: "rgba(12,27,46,.32)" }}>
                  {SERVICES_CONFIG[id].icon} {SERVICES_CONFIG[id].label}
                  <span style={{ fontSize: 9, fontWeight: 700, color: T.goldDark, background: "rgba(184,134,47,.12)", padding: "2px 7px", borderRadius: 10 }}>قريباً</span>
                </span>
              ))}
            </div>
            <div style={{ padding: 14 }}>
              <HeroSearch tab={searchTab} go={(params) => onSearch(searchTab, params)} />
            </div>
          </div>

          <div className="reveal-4" style={{ display: "flex", gap: 26, justifyContent: "center", flexWrap: "wrap", marginTop: 34 }}>
            {[["🏦", "الدفع ببنكك"], ["🛡️", "أسعار شفافة بلا مفاجآت"], ["💬", "دعم عربي حقيقي"]].map(([ic, tx], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(12,27,46,.55)" }}>
                <span style={{ color: T.gold }}>{ic}</span>{tx}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", color: T.gold, fontSize: 20, animation: "chevron 1.8s ease infinite" }}>⌄</div>
      </section>

      {/* SERVICES */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "60px 24px 20px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, textAlign: "center", marginBottom: 8 }}>خدماتنا</h2>
        <p style={{ fontSize: 15, color: T.gray400, textAlign: "center", marginBottom: 36 }}>كل ما تحتاجه لرحلة ناجحة</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))", gap: 14 }}>
          {services.map(s => (
            <Card key={s.id} hover onClick={() => onNav(s.id)} style={{ padding: "26px 18px", textAlign: "center", position: "relative", opacity: s.live ? 1 : .72 }}>
              {!s.live && <span style={{ position: "absolute", top: 12, left: 12, fontSize: 9, fontWeight: 700, color: T.goldDark, background: "rgba(184,134,47,.12)", padding: "3px 9px", borderRadius: 10 }}>قريباً</span>}
              <div style={{ fontSize: 38, marginBottom: 12 }}>{s.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 5 }}>{s.label}</h3>
              <p style={{ fontSize: 12, color: T.gray400, lineHeight: 1.5 }}>{s.sub}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* OFFERS */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div><h2 style={{ fontSize: 26, fontWeight: 800, color: T.text }}>عروض مميزة</h2><p style={{ fontSize: 15, color: T.gray400, marginTop: 4 }}>باقات مختارة بأفضل الأسعار</p></div>
          <Btn variant="gold_outline" onClick={() => onNav("packages")}>عرض الكل ←</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {offers.map((o, i) => (
            <Card key={i} hover onClick={() => onNav(o.page)} style={{ overflow: "hidden" }}>
              <div style={{ height: 160, background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontSize: 64 }}>{o.emoji}</span>
                <div style={{ position: "absolute", top: 14, right: 14 }}><Badge color="gold">{o.badge}</Badge></div>
              </div>
              <div style={{ padding: 20 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 5 }}>{o.title}</h3>
                <p style={{ fontSize: 13, color: T.gray400, marginBottom: 16 }}>{o.sub}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><span style={{ fontSize: 11, color: T.gray400 }}>يبدأ من</span><div style={{ fontSize: 22, fontWeight: 800, color: T.gold }}>{fmt(o.price, currency, rates)}</div></div>
                  <Btn size="sm">احجز الآن</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* DESTINATIONS */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px 20px" }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 8 }}>وجهات شائعة</h2>
        <p style={{ fontSize: 15, color: T.gray400, marginBottom: 24 }}>الأكثر حجزاً من المسافرين السودانيين</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {destinations.map((d, i) => (
            <Card key={i} hover onClick={() => onNav("flights")} style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: T.gray50, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{d.emoji}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{d.city}</div>
                <div style={{ fontSize: 12, color: T.gray400 }}>{d.country}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginTop: 2 }}>{fmt(d.price, currency, rates)}</div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* WHY HAJIZ */}
      <section style={{ background: T.card, marginTop: 50, padding: "60px 24px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: T.text, textAlign: "center", marginBottom: 40 }}>لماذا حاجز؟</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {whyUs.map((f, i) => (
              <div key={i} style={{ textAlign: "center", padding: 20 }}>
                <div style={{ width: 68, height: 68, borderRadius: 18, background: `${T.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px" }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: T.gray600, lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: `linear-gradient(145deg, #16345A 0%, #0C1E36 100%)`, padding: "60px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: T.pure, marginBottom: 14 }}>ابدأ رحلتك مع حاجز اليوم</h2>
          <p style={{ fontSize: 16, color: `${T.white}CC`, marginBottom: 30 }}>أنشئ حسابك مجاناً وابدأ الحجز خلال دقيقتين</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Btn size="lg" onClick={() => onAuth("register")}>إنشاء حساب مجاني</Btn>
            <Btn size="lg" variant="outline" style={{ color: T.pure, borderColor: `${T.white}50` }} onClick={() => onAuth("login")}>تسجيل الدخول</Btn>
          </div>
        </div>
      </section>
    </div>
  );
};

const HeroSearch = ({ tab, go }) => (
  tab === "hotels"
    ? <HotelSearchBlock onSubmit={go} />
    : <FlightSearchBlock onSubmit={go} />
);

// ═══════════════════════════════════════════════════════════
// BOOKING SUCCESS
// ═══════════════════════════════════════════════════════════
const BookingSuccess = ({ booking, onNav }) => {
  const app = useApp();
  const currency = app?.currency || "USD"; const rates = app?.rates || { sdg: 2400, aed: 3.67 };
  const toastCtx = useToast();
  const ref = useRef(`HJZ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`).current;
  return (
    <div style={{ maxWidth: 560, margin: "44px auto 60px", padding: "0 20px" }} className="fade-in">
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 8 }}>تم استلام حجزك</h1>
        <p style={{ fontSize: 14, color: T.gray400, lineHeight: 1.8 }}>إيصال بنكك قيد المراجعة — تذكرتك تصلك تلقائياً عبر <strong style={{ color: T.goldDark }}>واتساب</strong> والبريد خلال <strong style={{ color: T.goldDark }}>30 دقيقة</strong> كحد أقصى.</p>
      </div>

      {/* HAJIZ PASS — signature moment */}
      <div style={{ animation: "flipIn .8s cubic-bezier(.2,.7,.2,1) forwards", borderRadius: 22, overflow: "hidden", border: "1px solid rgba(184,134,47,.35)", background: "linear-gradient(160deg, #13284A 0%, #0C1B33 100%)", boxShadow: "0 30px 70px rgba(0,0,0,.55)", position: "relative" }}>
        <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(184,134,47,.18)" }}>
          <Logo height={34} light />
          <span style={{ fontSize: 10, letterSpacing: ".28em", color: T.goldLight, fontWeight: 700 }} className="num">HAJIZ · PASS</span>
        </div>
        <div style={{ padding: "22px 22px 18px" }}>
          <div style={{ fontSize: 12, color: T.gray400, marginBottom: 4 }}>الحجز</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.text, marginBottom: 16 }}>{booking?.title || "حجز حاجز"}</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 11, color: T.gray400 }}>رقم الحجز</div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: T.gold, letterSpacing: ".08em" }}>{ref}</div></div>
            <div style={{ textAlign: "left" }}><div style={{ fontSize: 11, color: T.gray400 }}>الإجمالي</div><div className="num" style={{ fontSize: 22, fontWeight: 700, color: T.text, direction: "ltr" }}>{fmt(booking?.total || 0, currency, rates)}</div></div>
          </div>
          <div style={{ marginTop: 14 }}><Badge color="amber">⏳ بانتظار تأكيد بنكك</Badge></div>
        </div>
        {/* Perforation */}
        <div style={{ position: "relative", height: 0, borderTop: "2px dashed rgba(184,134,47,.3)" }}>
          <span style={{ position: "absolute", right: -13, top: -13, width: 26, height: 26, borderRadius: "50%", background: T.bg }} />
          <span style={{ position: "absolute", left: -13, top: -13, width: 26, height: 26, borderRadius: "50%", background: T.bg }} />
        </div>
        {/* Stub / barcode */}
        <div style={{ padding: "16px 22px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div style={{ flex: 1, height: 46, borderRadius: 6, opacity: .92, background: "repeating-linear-gradient(90deg, #EEF4FC 0 2px, transparent 2px 5px, #EEF4FC 5px 6px, transparent 6px 10px)" }} />
          <span className="num" style={{ fontSize: 11, color: T.gray400, letterSpacing: ".14em" }}>{ref}</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 26 }}>
        <Btn onClick={() => onNav("trips")}>🎫 رحلاتي</Btn>
        <Btn variant="gold_outline" onClick={() => toastCtx && toastCtx.addToast("حُفظت التذكرة كصورة ✨", "success")}>⬇️ حفظ التذكرة</Btn>
        <Btn variant="whatsapp" onClick={() => window.open(`https://wa.me/249900000000?text=${encodeURIComponent(`مرحباً حاجز، بخصوص حجزي رقم ${ref} — ${booking?.title || ""}`)}`, "_blank")}>📱 واتساب</Btn>
      </div>
      <p style={{ textAlign: "center", fontSize: 12, color: T.gray400, marginTop: 16 }}>تابع حالة المراجعة لحظياً من صفحة «رحلاتي»</p>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════
const Footer = ({ onNav }) => (
  <footer style={{ background: "#071120", borderTop: "1px solid rgba(184,134,47,.12)", color: T.pure, marginTop: 60 }}>
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "50px 24px 24px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 40 }} className="footer-grid">
        <div>
          <Logo height={50} light />
          <p style={{ color: `${T.white}88`, fontSize: 14, lineHeight: 1.8, marginTop: 16, maxWidth: 280 }}>
            منصة السفر الأولى للسودانيين — احجز رحلاتك وفنادقك وتأشيراتك بثقة، وادفع بالطريقة التي تناسبك.
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            {["📧", "📱", "🐦", "📷"].map((s, i) => <div key={i} style={{ width: 38, height: 38, borderRadius: 10, background: `${T.white}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}>{s}</div>)}
          </div>
        </div>
        {[
          { title: "الخدمات", links: [["flights", "طيران"], ["hotels", "فنادق"], ["ferries", "بواخر"], ["visas", "تأشيرات"], ["insurance", "تأمين"], ["packages", "باقات"]] },
          { title: "حاجز", links: [["", "من نحن"], ["", "الوكلاء"], ["", "المسوقون"], ["support", "الدعم"]] },
          { title: "الدعم", links: [["support", "مركز المساعدة"], ["", "الشروط والأحكام"], ["", "سياسة الخصوصية"]] },
        ].map((col, i) => (
          <div key={i}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginBottom: 16 }}>{col.title}</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {col.links.map(([id, l], j) => <button key={j} onClick={() => id && onNav(id)} style={{ color: `${T.white}88`, fontSize: 14, background: "none", textAlign: "right", cursor: id ? "pointer" : "default" }}>{l}</button>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${T.white}1A`, paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <p style={{ color: `${T.white}66`, fontSize: 13 }}>© 2026 حاجز — جميع الحقوق محفوظة · مرخّصة في السودان</p>
        <div style={{ display: "flex", gap: 14 }}>
          <span style={{ fontSize: 12, color: `${T.white}66` }}>🔒 مدفوعات آمنة</span>
          <span style={{ fontSize: 12, color: `${T.white}66` }}>🏦 بنكك مُدعوم</span>
        </div>
      </div>
    </div>
  </footer>
);

// ═══════════════════════════════════════════════════════════
// MAIN APP SHELL
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
// PROVIDERS — wraps entire app with contexts
// ═══════════════════════════════════════════════════════════════════════
function AppProviders({ children }) {
  const [currency, setCurrency] = useState("USD");
  const rates = useMemo(() => ({ sdg: 2400, aed: 3.67 }), []);

  const [user, setUser] = useState(null);
  const [authModal, setAuthModal] = useState(null);

  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration);
  }, []);
  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const [favorites, setFavorites] = useState(new Set());
  const toggleFavorite = useCallback((type, id) => {
    const key = `${type}:${id}`;
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); addToast("تم الإزالة من المفضلة", "info", 2000); }
      else { next.add(key); addToast("تم الإضافة للمفضلة ❤️", "success", 2000); }
      return next;
    });
  }, [addToast]);

  const requireAuth = useCallback((cb) => { setAuthModal("login"); }, []);
  const handleAuth = useCallback((u) => { setUser(u); setAuthModal(null); addToast("مرحباً بك في حاجز! 🌟", "booking", 3000); }, [addToast]);
  const handleLogout = useCallback(() => { setUser(null); addToast("تم تسجيل الخروج", "info", 2000); }, [addToast]);

  return (
    <AppContext.Provider value={{ currency, setCurrency, rates }}>
      <AuthContext.Provider value={{ user, setUser: handleAuth, requireAuth, logout: handleLogout, isAuthenticated: !!user }}>
        <ToastContext.Provider value={{ addToast }}>
          <FavoritesContext.Provider value={{ favorites, toggle: toggleFavorite }}>
            {children}
            <ToastContainer toasts={toasts} dismiss={dismissToast} />
          </FavoritesContext.Provider>
        </ToastContext.Provider>
      </AuthContext.Provider>
    </AppContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APP — context-powered, no prop drilling
// ═══════════════════════════════════════════════════════════════════════
function HajizApp() {
  const [page, setPage] = useState("home");
  const [authModal, setAuthModal] = useState(null);
  const [booking, setBooking] = useState(null);
  const [prefill, setPrefill] = useState(null);

  const { currency, setCurrency, rates } = useApp();
  const { user, requireAuth: ctxRequireAuth, logout, setUser: authLogin } = useAuth();
  const { addToast } = useToast();

  const nav = useCallback((p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }, []);

  const handleBook = useCallback(async (b) => {
    console.log("🔵 handleBook called. user =", user);
    console.log("🔵 booking data =", b);
    const res = await createBooking(b, user);
    console.log("🔵 createBooking result =", res);
    if (res.ok) {
      setBooking({ ...b, ref: res.ref, id: res.booking.id });
      addToast(`تم حفظ الحجز — ${b.title}`, "booking", 5000);
    } else {
      setBooking(b);
      addToast(`تم الحجز (لم يُحفظ بالكامل)`, "booking", 5000);
    }
    nav("success");
  }, [nav, addToast, user]);

  const requireAuth = useCallback(() => setAuthModal("login"), []);
  const startSearch = useCallback((svc, params) => { setPrefill({ svc, params, ts: Date.now() }); nav(svc); }, [nav]);
  const handleAuth = useCallback((u) => { authLogin(u); setAuthModal(null); }, [authLogin]);

  // Shared props still supported for compatibility with existing page components
  const sharedProps = useMemo(() => ({
    currency, rates, onBook: handleBook, user, requireAuth, prefill
  }), [currency, rates, handleBook, user, requireAuth, prefill]);

  const renderPage = () => {
    const svc = SERVICES_CONFIG[page];
    if (svc && !svc.live) return <ComingSoonPage svc={svc} />;
    const pages = {
      home:      <HomePage onNav={nav} currency={currency} rates={rates} onAuth={setAuthModal} onSearch={startSearch} />,
      flights:   <FlightsPage {...sharedProps} />,
      hotels:    <HotelsPage {...sharedProps} />,
      ferries:   <FerriesPage {...sharedProps} />,
      visas:     <VisasPage {...sharedProps} />,
      insurance: <InsurancePage {...sharedProps} />,
      packages:  <PackagesPage {...sharedProps} />,
      success:   <BookingSuccess booking={booking} onNav={nav} />,
      dashboard: user ? <CustomerDashboard user={user} onNav={nav} currency={currency} rates={rates} /> : null,
      trips:     <TripsPage onNav={nav} />,
      wallet:    <WalletPage currency={currency} rates={rates} />,
      passports: <PassportsPage />,
      profile:   user ? <ProfilePage user={user} onUpdateUser={handleAuth} /> : null,
      support:   <SupportPage />,
    };
    if (!user && ["dashboard", "profile"].includes(page)) {
      return <EmptyState icon="🔐" title="سجّل دخولك أولاً" sub="هذه الصفحة تتطلب حساباً في حاجز" action={() => setAuthModal("login")} actionLabel="تسجيل الدخول" />;
    }
    return pages[page] || pages.home;
  };

  return (
    <>
      <GlobalStyle />
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <AnnouncementBar />
        <Header onNav={nav} currentPage={page} currency={currency} setCurrency={setCurrency} user={user} onAuth={setAuthModal} onLogout={logout} />
        <main style={{ flex: 1 }}>
          <ErrorBoundary>
            <PageTransition pageKey={page}>
              {renderPage()}
            </PageTransition>
          </ErrorBoundary>
        </main>
        {page === "home" && <Footer onNav={nav} />}
        {!["support","success"].includes(page) && (
          <button onClick={() => nav("support")} title="الدعم والمساعدة"
            style={{ position:"fixed", bottom:24, left:24, width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${T.gold},${T.goldDark})`, color: T.ink, fontSize:22, boxShadow:`0 8px 24px ${T.gold}55`, zIndex:900, display:"flex", alignItems:"center", justifyContent:"center", transition:"var(--transition)" }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.1)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
            💬
          </button>
        )}
      </div>
      {authModal && <AuthModal initialMode={authModal} onClose={() => setAuthModal(null)} onAuth={handleAuth} />}
    </>
  );
}

export default function HajizWeb() {
  return (
    <AppProviders>
      <HajizApp />
    </AppProviders>
  );
}