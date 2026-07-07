import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// HAJIZ ADMIN v2 — Launch Operations Console
// Roles (Super/Finance/Support) · Bankak Queue · FX Exposure ·
// Full CMS · Audit Log · Dark Luxury identity
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#0A1628", bg2: "#0D1C31", card: "#102340", surface2: "#152C4E",
  text: "#EEF4FC", ink: "#081C3A", pure: "#FFFFFF",
  navy: "#0B1F3A", navyLight: "#1B3A63",
  gold: "#C9A34E", goldLight: "#E8C97A", goldDark: "#A07C30",
  gray100: "#1C3153", gray200: "#27446F", gray400: "#8598BC", gray600: "#B3C2DE",
  green: "#3ED598", greenBg: "#0E2A21", red: "#FF7A7A", redBg: "#371722",
  amber: "#F3B653", amberBg: "#2F2410", blue: "#79ADFF", blueBg: "#122644",
};

const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Noto Kufi Arabic',sans-serif;background:${T.bg};color:${T.text};direction:rtl;-webkit-font-smoothing:antialiased}
    .num{font-family:'Space Grotesk',sans-serif!important;letter-spacing:.01em}
    button{cursor:pointer;border:none;outline:none;font-family:inherit}
    input,select,textarea{outline:none;font-family:inherit}
    ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:#0D1C31}
    ::-webkit-scrollbar-thumb{background:#27446F;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:${T.gold}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes toastIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    .fu{animation:fadeUp .4s cubic-bezier(.4,0,.2,1) forwards}
    .si{animation:scaleIn .25s ease forwards}
  `}</style>
);

// ── PRIMITIVES ──────────────────────────────────────────────────────
const Btn = ({ children, onClick, v = "primary", size = "md", disabled, full, style = {} }) => {
  const pad = { sm: "8px 16px", md: "11px 22px", lg: "14px 30px" }[size];
  const fs = { sm: 12, md: 14, lg: 15 }[size];
  const variants = {
    primary: { background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, color: T.ink },
    dark: { background: T.navyLight, color: T.text },
    outline: { background: "transparent", color: T.text, border: `1.5px solid ${T.gray200}` },
    gold_o: { background: "transparent", color: T.goldLight, border: `1.5px solid ${T.gold}` },
    success: { background: T.green, color: T.ink },
    danger: { background: T.red, color: T.ink },
    ghost: { background: T.gray100, color: T.gray600 },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 11, fontWeight: 700, fontSize: fs, padding: pad, width: full ? "100%" : "auto", opacity: disabled ? .45 : 1, transition: "all .2s", ...variants[v], ...style }}>
      {children}
    </button>
  );
};
const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: T.card, borderRadius: 16, border: "1px solid rgba(201,163,78,.10)", boxShadow: "0 2px 14px rgba(0,0,0,.25)", cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>
);
const Badge = ({ children, c = "gold" }) => {
  const m = { gold: [T.amberBg, T.goldLight], green: [T.greenBg, T.green], red: [T.redBg, T.red], amber: [T.amberBg, T.amber], blue: [T.blueBg, T.blue], gray: [T.gray100, T.gray400] };
  return <span style={{ display: "inline-block", padding: "3px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: m[c][0], color: m[c][1] }}>{children}</span>;
};
const Field = ({ label, value, onChange, type = "text", dir, disabled, note, area }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 6 }}>{label}</label>}
    {area ? (
      <textarea value={value} onChange={onChange} disabled={disabled} rows={3}
        style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 11, fontSize: 14, background: disabled ? T.bg2 : T.surface2, color: T.text, resize: "vertical" }} />
    ) : (
      <input type={type} value={value} onChange={onChange} dir={dir} disabled={disabled}
        style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 11, fontSize: 14, background: disabled ? T.bg2 : T.surface2, color: T.text }}
        onFocus={e => e.target.style.borderColor = T.gold} onBlur={e => e.target.style.borderColor = T.gray200} />
    )}
    {note && <p style={{ fontSize: 11, color: T.gray400, marginTop: 5 }}>{note}</p>}
  </div>
);
const Toggle = ({ on, set, disabled }) => (
  <button onClick={() => !disabled && set(!on)} style={{ width: 46, height: 26, borderRadius: 20, background: on ? T.gold : T.gray200, position: "relative", transition: "all .2s", opacity: disabled ? .4 : 1 }}>
    <span style={{ position: "absolute", top: 3, right: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: T.pure, transition: "all .2s" }} />
  </button>
);
const Stat = ({ icon, label, value, sub, tone = "gold" }) => (
  <Card style={{ padding: 20, display: "flex", gap: 14, alignItems: "center" }}>
    <div style={{ width: 48, height: 48, borderRadius: 13, background: `${{ gold: T.gold, green: T.green, red: T.red, blue: T.blue, amber: T.amber }[tone]}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{icon}</div>
    <div><div className="num" style={{ fontSize: 24, fontWeight: 700, color: T.text }}>{value}</div>
      <div style={{ fontSize: 12, color: T.gray400 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: T.gray400, marginTop: 2 }}>{sub}</div>}</div>
  </Card>
);
const Modal = ({ title, children, onClose, w = 520 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(4,10,20,.72)", backdropFilter: "blur(6px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
    <div className="si" onClick={e => e.stopPropagation()} style={{ background: T.card, border: "1px solid rgba(201,163,78,.22)", borderRadius: 20, width: "100%", maxWidth: w, maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ padding: "18px 22px", borderBottom: `1px solid ${T.gray100}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: T.gray100, color: T.text }}>✕</button>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  </div>
);
const Mono = ({ size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, display: "flex", alignItems: "center", justifyContent: "center", color: T.ink, fontWeight: 800, fontSize: size * .42, flexShrink: 0 }}>ح</div>
);

// ── ROLES & PERMISSIONS ─────────────────────────────────────────────
const TEAM = [
  { id: 1, name: "مصطفى", email: "admin@hajiz.com", role: "superadmin", title: "المؤسس — Super Admin", icon: "👑", desc: "كل الصلاحيات: FX، الأسعار، الفريق، السجل" },
  { id: 2, name: "عضو ٢", email: "finance@hajiz.com", role: "finance", title: "المالية والعمليات", icon: "💰", desc: "طابور بنكك، الحجوزات، إصدار التذاكر" },
  { id: 3, name: "عضو ٣", email: "support@hajiz.com", role: "support", title: "الدعم والمحتوى", icon: "🎧", desc: "واتساب، توثيق الهوية، إدارة المحتوى" },
];
const PERMS = {
  superadmin: { dashboard: 1, bankak: 1, bookings: 1, fx: "write", pricing: 1, cms: 1, kyc: 1, partners: 1, team: 1, audit: 1 },
  finance:    { dashboard: 1, bankak: 1, bookings: 1, fx: "read",  pricing: 0, cms: 0, kyc: 0, partners: "read", team: 0, audit: 0 },
  support:    { dashboard: 1, bankak: 0, bookings: "read", fx: 0,  pricing: 0, cms: 1, kyc: 1, partners: 0, team: 0, audit: 0 },
};
const NAV = [
  { id: "dashboard", label: "لوحة القيادة", icon: "📊", perm: "dashboard" },
  { id: "bankak", label: "طابور بنكك", icon: "🏦", perm: "bankak" },
  { id: "bookings", label: "الحجوزات", icon: "🎫", perm: "bookings" },
  { id: "fx", label: "الصرف والمكشوف", icon: "💱", perm: "fx" },
  { id: "pricing", label: "الهوامش", icon: "📈", perm: "pricing" },
  { id: "cms", label: "إدارة المحتوى", icon: "🎨", perm: "cms" },
  { id: "kyc", label: "توثيق الهوية", icon: "🪪", perm: "kyc" },
  { id: "partners", label: "الوكلاء والمسوّقون", icon: "🤝", perm: "partners" },
  { id: "team", label: "الفريق والصلاحيات", icon: "👥", perm: "team" },
  { id: "audit", label: "سجل التدقيق", icon: "📜", perm: "audit" },
];

// ── SEED DATA ───────────────────────────────────────────────────────
const SEED_PAY = [
  { id: "P1", ref: "HJZ-K7M2QA", customer: "أحمد الطيب", service: "طيران الخرطوم→جدة", amountUSD: 325, sdg: 780000, receivedMin: 6, receipt: true },
  { id: "P2", ref: "HJZ-X3B9LC", customer: "سارة عثمان", service: "فندق هيلتون مكة · 4 ليالٍ", amountUSD: 720, sdg: 1728000, receivedMin: 14, receipt: true },
  { id: "P3", ref: "HJZ-R5T1WD", customer: "محمد الفاتح", service: "طيران بورتسودان→دبي", amountUSD: 410, sdg: 984000, receivedMin: 22, receipt: true },
  { id: "P4", ref: "HJZ-N8H4ZE", customer: "إيمان صديق", service: "فندق موفنبيك جدة · ٣ ليالٍ", amountUSD: 495, sdg: 1188000, receivedMin: 3, receipt: false },
];
const SEED_BOOK = [
  { id: "B1", ref: "HJZ-A1C2D3", customer: "خالد النور", service: "طيران", title: "الخرطوم→القاهرة", usd: 265, status: "confirmed", date: "اليوم 10:20" },
  { id: "B2", ref: "HJZ-E4F5G6", customer: "آلاء بشير", service: "فندق", title: "سويس أوتيل مكة · 5 ليالٍ", usd: 1175, status: "pending", date: "اليوم 11:05" },
  { id: "B3", ref: "HJZ-H7J8K9", customer: "عمر إدريس", service: "طيران", title: "الخرطوم→جدة", usd: 280, status: "rejected", date: "أمس 21:40" },
];
const SEED_KYC = [
  { id: "K1", name: "أحمد الطيب", doc: "جواز سفر", number: "P0482913", when: "قبل 20 دقيقة" },
  { id: "K2", name: "سارة عثمان", doc: "بطاقة وطنية", number: "199-4471", when: "قبل ساعة" },
];
const SEED_PARTNERS = [
  { id: "AG1", type: "agent", name: "مكتب النيل للسفر", contact: "الخرطوم · +249 91 234 5678", commission: 25, status: "active", bookings: 34, revenue: 8600, joined: "مايو 2026" },
  { id: "AG2", type: "agent", name: "وكالة الشرق", contact: "بورتسودان · +249 92 345 6789", commission: 25, status: "pending", bookings: 0, revenue: 0, joined: "طلب جديد" },
  { id: "MK1", type: "marketer", name: "خالد الإعلامي", contact: "instagram @khaled · 45k متابع", commission: 10, status: "active", bookings: 62, revenue: 15200, joined: "أبريل 2026" },
  { id: "MK2", type: "marketer", name: "نور الرحمن", contact: "tiktok @nour · 120k متابع", commission: 10, status: "pending", bookings: 0, revenue: 0, joined: "طلب جديد" },
];

// ═══ APP ═══
export default function HajizAdmin() {
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [screen, setScreen] = useState("dashboard");
  const [toasts, setToasts] = useState([]);
  const [audit, setAudit] = useState([{ t: "11:02", u: "النظام", a: "تهيئة لوحة الإطلاق v2" }]);

  const [payQ, setPayQ] = useState(SEED_PAY);
  const [bookings, setBookings] = useState(SEED_BOOK);
  const [kycQ, setKycQ] = useState(SEED_KYC);
  const [partners, setPartners] = useState(SEED_PARTNERS);
  const [fx, setFx] = useState({ rate: 2400, margin: 4, floatUSD: 8000 });
  const [pricing, setPricing] = useState({ flights: 4, hotels: 12 });
  const [cms, setCms] = useState({
    heroTitle: "وين رحلتك الجاية؟",
    heroSub: "طيران وفنادق بأسعار شفافة — احجز خلال دقائق وادفع ببنكك.",
    annOn: true, annText: "🚀 الإطلاق التجريبي: طيران وفنادق متاحة الآن — الدفع عبر بنكك",
    bankAccount: "1234 5678 9012", timerMin: 15,
    services: { flights: true, hotels: true, ferries: false, packages: false, visas: false, insurance: false },
    destinations: [{ n: "مكة المكرمة", p: 280 }, { n: "جدة", p: 250 }, { n: "دبي", p: 320 }, { n: "إسطنبول", p: 380 }],
    offers: [{ title: "خصم جدة", desc: "خصم 10% على رحلات جدة هذا الأسبوع", code: "JEDDAH10", off: 10, active: true }],
    faq: [
      { q: "كيف أدفع عبر بنكك؟", a: "حوّل للحساب المعروض، أضف رقم المرجع، ارفع الإيصال — نؤكد خلال 30 دقيقة." },
      { q: "متى تصلني التذكرة؟", a: "فور تأكيد الدفع، بريدياً وواتساب." },
    ],
    contact: { whatsapp: "+249 900 000 000", email: "support@hajiz.com", phone: "+249 900 000 000", instagram: "@hajiz", facebook: "hajiz", tiktok: "@hajiz" },
    pages: { terms: "شروط استخدام حاجز...", privacy: "سياسة الخصوصية...", about: "حاجز — منصة السفر الأولى للسودانيين. نوفّر حجوزات طيران وفنادق بأسعار شفافة ودفع محلي عبر بنكك." },
    siteAlert: { on: false, text: "", tone: "amber" },
  });

  const toast = (msg, tone = "gold") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };
  const log = (a) => setAudit(prev => [{ t: new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }), u: user?.name || "—", a }, ...prev]);
  const can = (perm) => user ? PERMS[user.role][perm] : 0;

  const exposure = useMemo(() => {
    const pendUSD = payQ.reduce((s, p) => s + p.amountUSD, 0);
    const owedUSD = pendUSD + bookings.filter(b => b.status === "pending").reduce((s, b) => s + b.usd, 0);
    return { pendUSD, owedUSD, net: fx.floatUSD - owedUSD, effRate: Math.round(fx.rate * (1 + fx.margin / 100)) };
  }, [payQ, bookings, fx]);

  // ── LOGIN (email + password, role auto-detected) ──
  if (!user) return (
    <>
      <GS />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: `radial-gradient(900px 500px at 80% -10%, #17365F, transparent 60%), ${T.bg}` }}>
        <div className="fu" style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Mono size={60} /></div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 6px" }}>لوحة تحكم <span style={{ color: T.gold }}>حاجز</span></h1>
            <p style={{ color: T.gray400, fontSize: 13 }}>وحدة عمليات الإطلاق</p>
          </div>
          <Card style={{ padding: 28 }}>
            <Field label="البريد الإلكتروني" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} dir="ltr" />
            <Field label="كلمة المرور" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} dir="ltr" />
            {loginErr && <p style={{ fontSize: 12, color: T.red, marginBottom: 12 }}>{loginErr}</p>}
            <Btn full size="lg" onClick={() => {
              const m = TEAM.find(t => t.email === loginEmail.trim().toLowerCase());
              if (!m || loginPass.length < 4) { setLoginErr("بيانات الدخول غير صحيحة"); return; }
              setLoginErr(""); setUser(m);
              setAudit(p => [{ t: new Date().toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" }), u: m.name, a: "تسجيل دخول للوحة" }, ...p]);
            }}>تسجيل الدخول</Btn>
            <div style={{ marginTop: 16, padding: 12, background: T.bg2, borderRadius: 10, fontSize: 11, color: T.gray400, lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700, color: T.gray600, marginBottom: 4 }}>حسابات تجريبية:</div>
              {TEAM.map(m => <div key={m.id} className="num" style={{ direction: "ltr", textAlign: "left" }}>{m.icon} {m.email} · demo</div>)}
            </div>
          </Card>
          <p style={{ fontSize: 11, color: T.gray400, marginTop: 18, textAlign: "center" }}>🔒 في الإنتاج: تحقق بخطوتين (2FA) إلزامي · جلسة تنتهي بعد 30 دقيقة</p>
        </div>
      </div>
    </>
  );

  const visibleNav = NAV.filter(n => can(n.perm));

  return (
    <>
      <GS />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* SIDEBAR */}
        <aside style={{ width: 232, background: "#081426", borderLeft: "1px solid rgba(201,163,78,.12)", padding: "22px 14px", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 20px", borderBottom: `1px solid ${T.gray100}`, marginBottom: 16 }}>
            <Mono size={38} />
            <div><div style={{ fontWeight: 800, fontSize: 15 }}>حاجز</div><div style={{ fontSize: 10, color: T.gray400 }}>وحدة العمليات</div></div>
          </div>
          {visibleNav.map(n => (
            <button key={n.id} onClick={() => setScreen(n.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "right", padding: "11px 12px", borderRadius: 11, fontSize: 13, fontWeight: 700, marginBottom: 4, background: screen === n.id ? "rgba(201,163,78,.14)" : "transparent", color: screen === n.id ? T.goldLight : T.gray600, border: screen === n.id ? "1px solid rgba(201,163,78,.3)" : "1px solid transparent", transition: "all .2s" }}>
              <span>{n.icon}</span>{n.label}
              {n.id === "bankak" && payQ.length > 0 && <span className="num" style={{ marginRight: "auto", background: T.red, color: T.ink, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{payQ.length}</span>}
            </button>
          ))}
          <div style={{ marginTop: "auto", padding: 10, borderTop: `1px solid ${T.gray100}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{user.icon}</span>
              <div><div style={{ fontSize: 12, fontWeight: 800 }}>{user.name}</div><Badge c={user.role === "superadmin" ? "gold" : user.role === "finance" ? "green" : "blue"}>{user.title.split("—")[0]}</Badge></div>
            </div>
            <Btn v="ghost" size="sm" full onClick={() => { log("تسجيل خروج"); setUser(null); setScreen("dashboard"); }}>تبديل المستخدم</Btn>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, padding: "28px 30px", maxWidth: 1200 }}>
          {screen === "dashboard" && <Dashboard payQ={payQ} bookings={bookings} exposure={exposure} audit={audit} fx={fx} setScreen={setScreen} can={can} />}
          {screen === "bankak" && can("bankak") ? <BankakQueue q={payQ} setQ={setPayQ} setBookings={setBookings} fx={fx} log={log} toast={toast} cms={cms} /> : null}
          {screen === "bookings" && <Bookings list={bookings} readOnly={can("bookings") === "read"} />}
          {screen === "fx" && can("fx") ? <FxScreen fx={fx} setFx={setFx} exposure={exposure} canWrite={can("fx") === "write"} log={log} toast={toast} /> : null}
          {screen === "pricing" && can("pricing") ? <Pricing pricing={pricing} setPricing={setPricing} log={log} toast={toast} /> : null}
          {screen === "cms" && can("cms") ? <CMS cms={cms} setCms={setCms} log={log} toast={toast} /> : null}
          {screen === "kyc" && can("kyc") ? <KYC q={kycQ} setQ={setKycQ} log={log} toast={toast} /> : null}
          {screen === "partners" && can("partners") ? <Partners list={partners} setList={setPartners} readOnly={can("partners") === "read"} log={log} toast={toast} /> : null}
          {screen === "team" && can("team") ? <Team /> : null}
          {screen === "audit" && can("audit") ? <Audit list={audit} /> : null}
        </main>
      </div>

      {/* TOASTS */}
      <div style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)", zIndex: 3000, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ animation: "toastIn .3s ease", background: t.tone === "red" ? T.redBg : t.tone === "green" ? T.greenBg : T.amberBg, border: `1px solid ${t.tone === "red" ? T.red : t.tone === "green" ? T.green : T.gold}`, color: t.tone === "red" ? T.red : t.tone === "green" ? T.green : T.goldLight, padding: "11px 20px", borderRadius: 13, fontSize: 13, fontWeight: 700 }}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}

// ═══ SCREENS ═══
const H = ({ title, sub, extra }) => (
  <div className="fu" style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
    <div><h1 style={{ fontSize: 24, fontWeight: 800 }}>{title}</h1>{sub && <p style={{ fontSize: 13, color: T.gray400, marginTop: 4 }}>{sub}</p>}</div>{extra}
  </div>
);

const Dashboard = ({ payQ, bookings, exposure, audit, fx, setScreen, can }) => (
  <div className="fu">
    <H title="لوحة القيادة" sub={`اليوم · سعر الصرف الفعّال للعميل ${exposure.effRate.toLocaleString()} ج.س/$`} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
      <Stat icon="🏦" label="دفعات بنكك بانتظار المراجعة" value={payQ.length} tone="amber" sub="الهدف: صفر خلال 30 دقيقة" />
      <Stat icon="🎫" label="حجوزات اليوم" value={bookings.length} tone="blue" />
      <Stat icon="💵" label="مطلوب للموردين (USD)" value={`$${exposure.owedUSD.toLocaleString()}`} tone="red" />
      <Stat icon="🛡️" label="صافي التغطية" value={`$${exposure.net.toLocaleString()}`} tone={exposure.net > 0 ? "green" : "red"} sub={`Float: $${fx.floatUSD.toLocaleString()}`} />
    </div>
    {exposure.net < fx.floatUSD * 0.2 && (
      <Card style={{ padding: 16, marginBottom: 20, background: T.redBg, border: `1px solid ${T.red}55`, display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 22 }}>⚠️</span>
        <div style={{ fontSize: 13, color: T.red, fontWeight: 700 }}>تحذير سيولة: التغطية الدولارية أقل من 20% من الـ Float — اشترِ دولاراً أو أوقف الحجوزات الكبيرة مؤقتاً.</div>
      </Card>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>إجراءات سريعة</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {can("bankak") ? <Btn full onClick={() => setScreen("bankak")}>🏦 مراجعة طابور بنكك ({payQ.length})</Btn> : null}
          {can("fx") ? <Btn full v="dark" onClick={() => setScreen("fx")}>💱 الصرف والمكشوف</Btn> : null}
          {can("cms") ? <Btn full v="outline" onClick={() => setScreen("cms")}>🎨 تعديل محتوى الموقع</Btn> : null}
        </div>
      </Card>
      <Card style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>آخر النشاط</h3>
        {audit.slice(0, 5).map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, padding: "7px 0", borderBottom: i < 4 ? `1px solid ${T.gray100}` : "none" }}>
            <span className="num" style={{ color: T.gray400, minWidth: 44 }}>{a.t}</span>
            <span style={{ color: T.goldLight, fontWeight: 700 }}>{a.u}</span>
            <span style={{ color: T.gray600 }}>{a.a}</span>
          </div>
        ))}
      </Card>
    </div>
  </div>
);

const BankakQueue = ({ q, setQ, setBookings, fx, log, toast, cms }) => {
  const [view, setView] = useState(null);
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const approve = (p) => {
    setQ(prev => prev.filter(x => x.id !== p.id));
    setBookings(prev => [{ id: "B" + Date.now(), ref: p.ref, customer: p.customer, service: p.service.split(" ")[0], title: p.service, usd: p.amountUSD, status: "confirmed", date: "الآن" }, ...prev]);
    log(`تأكيد دفعة بنكك ${p.ref} — $${p.amountUSD} (${p.customer})`);
    toast(`✅ تم تأكيد ${p.ref} — أصدر التذكرة الآن`, "green");
    setView(null);
  };
  const doReject = () => {
    if (!reason.trim()) { toast("سبب الرفض إلزامي", "red"); return; }
    setQ(prev => prev.filter(x => x.id !== reject.id));
    log(`رفض دفعة ${reject.ref} — السبب: ${reason}`);
    toast(`تم رفض ${reject.ref} وإخطار العميل`, "red");
    setReject(null); setReason("");
  };
  return (
    <div className="fu">
      <H title="طابور بنكك" sub={`${q.length} دفعة بانتظار المراجعة · حساب الاستلام: ${cms.bankAccount} · مهلة العميل ${cms.timerMin} دقيقة`} />
      {q.length === 0 && <Card style={{ padding: 44, textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 10 }}>✨</div><div style={{ fontWeight: 800 }}>الطابور فاضي — كل الدفعات تمت مراجعتها</div></Card>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {q.map(p => (
          <Card key={p.id} style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span className="num" style={{ fontWeight: 700, color: T.goldLight }}>{p.ref}</span>
                {p.receivedMin > cms.timerMin ? <Badge c="red">متأخر {p.receivedMin - cms.timerMin} د</Badge> : <Badge c="amber">منذ {p.receivedMin} د</Badge>}
                {!p.receipt && <Badge c="red">بلا إيصال</Badge>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.customer}</div>
              <div style={{ fontSize: 12, color: T.gray400 }}>{p.service}</div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div className="num" style={{ fontSize: 19, fontWeight: 700, color: T.gold, direction: "ltr" }}>${p.amountUSD.toLocaleString()}</div>
              <div className="num" style={{ fontSize: 11, color: T.gray400, direction: "ltr" }}>{p.sdg.toLocaleString()} SDG</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" v="outline" onClick={() => setView(p)}>📄 الإيصال</Btn>
              <Btn size="sm" v="success" onClick={() => approve(p)} disabled={!p.receipt}>✓ تأكيد</Btn>
              <Btn size="sm" v="danger" onClick={() => setReject(p)}>✕ رفض</Btn>
            </div>
          </Card>
        ))}
      </div>

      {view && (
        <Modal title={`إيصال ${view.ref} — ${view.customer}`} onClose={() => setView(null)}>
          <div style={{ height: 300, borderRadius: 14, background: T.surface2, border: `1px dashed ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 44 }}>🧾</span>
            <span style={{ fontSize: 12, color: T.gray400 }}>معاينة صورة الإيصال (Storage موقّع في الإنتاج)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16, fontSize: 13 }}>
            <div>المبلغ المطلوب: <strong className="num" style={{ color: T.gold }}>${view.amountUSD}</strong></div>
            <div>بالجنيه (سعر {fx.rate}): <strong className="num">{view.sdg.toLocaleString()}</strong></div>
            <div>المرجع المتوقع: <strong className="num" style={{ color: T.goldLight }}>{view.ref}</strong></div>
            <div>الخدمة: {view.service}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full v="success" onClick={() => approve(view)} disabled={!view.receipt}>✓ الإيصال مطابق — تأكيد</Btn>
            <Btn full v="danger" onClick={() => { setReject(view); setView(null); }}>رفض</Btn>
          </div>
        </Modal>
      )}
      {reject && (
        <Modal title={`رفض ${reject.ref}`} onClose={() => setReject(null)} w={440}>
          <Field label="سبب الرفض (يظهر للعميل — إلزامي)" value={reason} onChange={e => setReason(e.target.value)} area />
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full v="danger" onClick={doReject}>تأكيد الرفض وإخطار العميل</Btn>
            <Btn v="ghost" onClick={() => setReject(null)}>إلغاء</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Bookings = ({ list, readOnly }) => {
  const [f, setF] = useState("all");
  const S = { confirmed: ["مؤكد", "green"], pending: ["قيد الدفع", "amber"], rejected: ["مرفوض", "red"] };
  const rows = f === "all" ? list : list.filter(b => b.status === f);
  return (
    <div className="fu">
      <H title="الحجوزات" sub={readOnly ? "وضع القراءة فقط — دورك: دعم" : "إدارة كاملة"} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "الكل"], ["pending", "قيد الدفع"], ["confirmed", "مؤكد"], ["rejected", "مرفوض"]].map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: f === k ? T.navyLight : T.gray100, color: f === k ? T.goldLight : T.gray400 }}>{l}</button>
        ))}
      </div>
      <Card style={{ overflow: "hidden" }}>
        {rows.map((b, i) => (
          <div key={b.id} style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, borderBottom: i < rows.length - 1 ? `1px solid ${T.gray100}` : "none", flexWrap: "wrap" }}>
            <span className="num" style={{ color: T.goldLight, fontWeight: 700, minWidth: 110 }}>{b.ref}</span>
            <div style={{ flex: 1, minWidth: 180 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{b.customer}</div><div style={{ fontSize: 11, color: T.gray400 }}>{b.title}</div></div>
            <span className="num" style={{ fontWeight: 700, direction: "ltr" }}>${b.usd}</span>
            <Badge c={S[b.status][1]}>{S[b.status][0]}</Badge>
            <span style={{ fontSize: 11, color: T.gray400 }}>{b.date}</span>
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 30, textAlign: "center", color: T.gray400, fontSize: 13 }}>لا حجوزات بهذا الفلتر</div>}
      </Card>
    </div>
  );
};

const FxScreen = ({ fx, setFx, exposure, canWrite, log, toast }) => {
  const [r, setR] = useState(fx.rate); const [m, setM] = useState(fx.margin); const [fl, setFl] = useState(fx.floatUSD);
  const save = () => { setFx({ rate: +r, margin: +m, floatUSD: +fl }); log(`تحديث FX: سعر ${r} · هامش ${m}% · Float $${fl}`); toast("تم تحديث الصرف — انعكس فوراً على الموقع", "green"); };
  return (
    <div className="fu">
      <H title="الصرف والمكشوف" sub={canWrite ? "صلاحية كاملة — Super Admin" : "قراءة فقط — التعديل محصور بالمؤسس"} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
        <Stat icon="💱" label="السعر الفعّال للعميل" value={exposure.effRate.toLocaleString()} sub="ج.س / دولار (شامل الهامش)" />
        <Stat icon="💵" label="مطلوب للموردين" value={`$${exposure.owedUSD.toLocaleString()}`} tone="red" />
        <Stat icon="🏦" label="الـ Float الدولاري" value={`$${fx.floatUSD.toLocaleString()}`} tone="blue" />
        <Stat icon="🛡️" label="صافي التغطية" value={`$${exposure.net.toLocaleString()}`} tone={exposure.net > 0 ? "green" : "red"} />
      </div>
      <Card style={{ padding: 24, maxWidth: 560 }}>
        <Field label="سعر الصرف الأساسي (ج.س / $)" type="number" value={r} onChange={e => setR(e.target.value)} disabled={!canWrite} dir="ltr" />
        <Field label="هامش الأمان % (يُضاف فوق السعر)" type="number" value={m} onChange={e => setM(e.target.value)} disabled={!canWrite} dir="ltr" note="يحميك من تقلب الجنيه بين لحظة الحجز ولحظة الدفع للمورد" />
        <Field label="الـ Float الدولاري المتاح ($)" type="number" value={fl} onChange={e => setFl(e.target.value)} disabled={!canWrite} dir="ltr" />
        {canWrite && <Btn onClick={save}>حفظ وتطبيق فوري</Btn>}
      </Card>
    </div>
  );
};

const Pricing = ({ pricing, setPricing, log, toast }) => {
  const [f, setF] = useState(pricing.flights); const [h, setH] = useState(pricing.hotels);
  return (
    <div className="fu">
      <H title="هوامش الربح" sub="العمولات تُقتطع من الهامش — لا تُضاف فوق السعر أبداً" />
      <Card style={{ padding: 24, maxWidth: 560 }}>
        <Field label="هامش الطيران % (واقعي: 1-4%)" type="number" value={f} onChange={e => setF(e.target.value)} dir="ltr" note="الطيران loss-leader — الربح من الفنادق والخدمات القادمة" />
        <Field label="هامش الفنادق % (واقعي: 10-15%)" type="number" value={h} onChange={e => setH(e.target.value)} dir="ltr" />
        <Btn onClick={() => { setPricing({ flights: +f, hotels: +h }); log(`تحديث الهوامش: طيران ${f}% · فنادق ${h}%`); toast("تم تحديث الهوامش", "green"); }}>حفظ</Btn>
      </Card>
    </div>
  );
};

const CMS = ({ cms, setCms, log, toast }) => {
  const [tab, setTab] = useState("hero");
  const [c, setC] = useState(cms);
  const [nd, setNd] = useState({ n: "", p: "" });
  const [nf, setNf] = useState({ q: "", a: "" });
  const save = (what) => { setCms(c); log(`تعديل محتوى: ${what}`); toast(`✅ حُفظ (${what}) — انعكس على الموقع`, "green"); };
  const tabs = [["hero", "الهيرو"], ["ann", "شريط الإعلان"], ["services", "الخدمات"], ["dest", "الوجهات"], ["offers", "العروض"], ["faq", "الأسئلة"], ["bankak", "إعدادات بنكك"], ["contact", "التواصل"], ["pages", "الصفحات"], ["alert", "تنبيه الموقع"]];
  const [no, setNo] = useState({ title: "", desc: "", code: "", off: "" });
  const SVC_L = { flights: "طيران", hotels: "فنادق", ferries: "بواخر", packages: "باقات", visas: "تأشيرات", insurance: "تأمين" };
  return (
    <div className="fu">
      <H title="إدارة المحتوى" sub="كل ما يظهر على الموقع يُدار من هنا — بدون كود" />
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ padding: "9px 18px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: tab === k ? T.navyLight : T.gray100, color: tab === k ? T.goldLight : T.gray400 }}>{l}</button>)}
      </div>
      <Card style={{ padding: 24, maxWidth: 640 }}>
        {tab === "hero" && <>
          <Field label="عنوان الهيرو" value={c.heroTitle} onChange={e => setC({ ...c, heroTitle: e.target.value })} />
          <Field label="الوصف" value={c.heroSub} onChange={e => setC({ ...c, heroSub: e.target.value })} area />
          <Btn onClick={() => save("الهيرو")}>حفظ</Btn>
        </>}
        {tab === "ann" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>شريط الإعلان مفعّل</span>
            <Toggle on={c.annOn} set={v => setC({ ...c, annOn: v })} />
          </div>
          <Field label="نص الإعلان" value={c.annText} onChange={e => setC({ ...c, annText: e.target.value })} />
          <Btn onClick={() => save("شريط الإعلان")}>حفظ</Btn>
        </>}
        {tab === "services" && <>
          {Object.keys(c.services).map(k => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${T.gray100}` }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{SVC_L[k]} {(k === "flights" || k === "hotels") && <Badge c="green">أساسي</Badge>}</span>
              <Toggle on={c.services[k]} set={v => setC({ ...c, services: { ...c.services, [k]: v } })} disabled={k === "flights" || k === "hotels"} />
            </div>
          ))}
          <p style={{ fontSize: 11, color: T.gray400, margin: "12px 0" }}>غير المفعّل يظهر «قريباً» مع جمع بريد المهتمين تلقائياً</p>
          <Btn onClick={() => save("تفعيل الخدمات")}>حفظ</Btn>
        </>}
        {tab === "dest" && <>
          {c.destinations.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${T.gray100}` }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{d.n}</span>
              <span className="num" style={{ color: T.gold, direction: "ltr" }}>${d.p}</span>
              <button onClick={() => setC({ ...c, destinations: c.destinations.filter((_, x) => x !== i) })} style={{ width: 26, height: 26, borderRadius: 8, background: T.redBg, color: T.red }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
            <input placeholder="المدينة" value={nd.n} onChange={e => setNd({ ...nd, n: e.target.value })} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.gray200}`, background: T.surface2, color: T.text, fontSize: 13 }} />
            <input placeholder="$" type="number" value={nd.p} onChange={e => setNd({ ...nd, p: e.target.value })} dir="ltr" style={{ width: 90, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${T.gray200}`, background: T.surface2, color: T.text, fontSize: 13 }} />
            <Btn size="sm" v="gold_o" onClick={() => { if (nd.n && nd.p) { setC({ ...c, destinations: [...c.destinations, { n: nd.n, p: +nd.p }] }); setNd({ n: "", p: "" }); } }}>+ إضافة</Btn>
          </div>
          <Btn onClick={() => save("الوجهات")}>حفظ</Btn>
        </>}
        {tab === "faq" && <>
          {c.faq.map((f, i) => (
            <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${T.gray100}`, display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{f.q}</div><div style={{ fontSize: 11, color: T.gray400, marginTop: 3 }}>{f.a}</div></div>
              <button onClick={() => setC({ ...c, faq: c.faq.filter((_, x) => x !== i) })} style={{ width: 26, height: 26, borderRadius: 8, background: T.redBg, color: T.red, flexShrink: 0 }}>×</button>
            </div>
          ))}
          <div style={{ margin: "14px 0" }}>
            <Field label="سؤال جديد" value={nf.q} onChange={e => setNf({ ...nf, q: e.target.value })} />
            <Field label="الإجابة" value={nf.a} onChange={e => setNf({ ...nf, a: e.target.value })} area />
            <Btn size="sm" v="gold_o" onClick={() => { if (nf.q && nf.a) { setC({ ...c, faq: [...c.faq, nf] }); setNf({ q: "", a: "" }); } }}>+ إضافة سؤال</Btn>
          </div>
          <Btn onClick={() => save("الأسئلة الشائعة")}>حفظ</Btn>
        </>}
        {tab === "bankak" && <>
          <Field label="رقم حساب حاجز — بنكك (يظهر للعميل)" value={c.bankAccount} onChange={e => setC({ ...c, bankAccount: e.target.value })} dir="ltr" />
          <Field label="مهلة الدفع بالدقائق" type="number" value={c.timerMin} onChange={e => setC({ ...c, timerMin: +e.target.value })} dir="ltr" note="المؤقت الذي يظهر للعميل بعد اختيار بنكك" />
          <Btn onClick={() => save("إعدادات بنكك")}>حفظ</Btn>
        </>}
        {tab === "offers" && <>
          {c.offers.map((o, i) => (
            <div key={i} style={{ padding: "12px 14px", marginBottom: 8, background: T.bg2, borderRadius: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{o.title} {o.active ? <Badge c="green">فعّال</Badge> : <Badge c="gray">متوقف</Badge>}</div>
                <div style={{ fontSize: 12, color: T.gray400 }}>{o.desc}</div>
                <div className="num" style={{ fontSize: 11, color: T.goldLight, direction: "ltr" }}>{o.code} · -{o.off}%</div>
              </div>
              <Toggle on={o.active} set={v => setC({ ...c, offers: c.offers.map((x, y) => y === i ? { ...x, active: v } : x) })} />
              <button onClick={() => setC({ ...c, offers: c.offers.filter((_, y) => y !== i) })} style={{ width: 26, height: 26, borderRadius: 8, background: T.redBg, color: T.red }}>×</button>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${T.gray100}`, paddingTop: 14, marginTop: 6 }}>
            <Field label="عنوان العرض" value={no.title} onChange={e => setNo({ ...no, title: e.target.value })} />
            <Field label="الوصف" value={no.desc} onChange={e => setNo({ ...no, desc: e.target.value })} />
            <div style={{ display: "flex", gap: 10 }}>
              <Field label="كود الخصم" value={no.code} onChange={e => setNo({ ...no, code: e.target.value.toUpperCase() })} dir="ltr" />
              <Field label="نسبة %" type="number" value={no.off} onChange={e => setNo({ ...no, off: e.target.value })} dir="ltr" />
            </div>
            <Btn size="sm" v="gold_o" onClick={() => { if (no.title && no.code) { setC({ ...c, offers: [...c.offers, { ...no, off: +no.off, active: true }] }); setNo({ title: "", desc: "", code: "", off: "" }); } }}>+ إضافة عرض</Btn>
          </div>
          <Btn onClick={() => save("العروض")} style={{ marginTop: 12 }}>حفظ</Btn>
        </>}
        {tab === "contact" && <>
          <Field label="واتساب (يظهر في الموقع)" value={c.contact.whatsapp} onChange={e => setC({ ...c, contact: { ...c.contact, whatsapp: e.target.value } })} dir="ltr" note="الرقم الذي يفتحه زر واتساب" />
          <Field label="بريد الدعم" value={c.contact.email} onChange={e => setC({ ...c, contact: { ...c.contact, email: e.target.value } })} dir="ltr" />
          <Field label="هاتف" value={c.contact.phone} onChange={e => setC({ ...c, contact: { ...c.contact, phone: e.target.value } })} dir="ltr" />
          <div style={{ display: "flex", gap: 10 }}>
            <Field label="إنستغرام" value={c.contact.instagram} onChange={e => setC({ ...c, contact: { ...c.contact, instagram: e.target.value } })} dir="ltr" />
            <Field label="فيسبوك" value={c.contact.facebook} onChange={e => setC({ ...c, contact: { ...c.contact, facebook: e.target.value } })} dir="ltr" />
            <Field label="تيك توك" value={c.contact.tiktok} onChange={e => setC({ ...c, contact: { ...c.contact, tiktok: e.target.value } })} dir="ltr" />
          </div>
          <Btn onClick={() => save("بيانات التواصل")}>حفظ</Btn>
        </>}
        {tab === "pages" && <>
          <Field label="من نحن (About)" value={c.pages.about} onChange={e => setC({ ...c, pages: { ...c.pages, about: e.target.value } })} area />
          <Field label="الشروط والأحكام (Terms)" value={c.pages.terms} onChange={e => setC({ ...c, pages: { ...c.pages, terms: e.target.value } })} area />
          <Field label="سياسة الخصوصية (Privacy)" value={c.pages.privacy} onChange={e => setC({ ...c, pages: { ...c.pages, privacy: e.target.value } })} area />
          <Btn onClick={() => save("الصفحات الثابتة")}>حفظ</Btn>
        </>}
        {tab === "alert" && <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>تنبيه طوارئ على الموقع</span>
            <Toggle on={c.siteAlert.on} set={v => setC({ ...c, siteAlert: { ...c.siteAlert, on: v } })} />
          </div>
          <Field label="نص التنبيه" value={c.siteAlert.text} onChange={e => setC({ ...c, siteAlert: { ...c.siteAlert, text: e.target.value } })} area note="مثال: تأخير في مراجعة بنكك اليوم بسبب ضغط الحجوزات" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: T.gray600, display: "block", marginBottom: 6 }}>لون التنبيه</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["amber", "تحذير"], ["red", "عاجل"], ["blue", "معلومة"]].map(([v, l]) => (
                <button key={v} onClick={() => setC({ ...c, siteAlert: { ...c.siteAlert, tone: v } })} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1.5px solid ${c.siteAlert.tone === v ? T.gold : T.gray200}`, background: c.siteAlert.tone === v ? "rgba(201,163,78,.1)" : "transparent", color: c.siteAlert.tone === v ? T.goldLight : T.gray400 }}>{l}</button>
              ))}
            </div>
          </div>
          <Btn onClick={() => save("تنبيه الموقع")}>حفظ</Btn>
        </>}
      </Card>
    </div>
  );
};

const KYC = ({ q, setQ, log, toast }) => {
  const [view, setView] = useState(null);
  const act = (k, ok) => {
    setQ(prev => prev.filter(x => x.id !== k.id));
    log(`${ok ? "قبول" : "رفض"} توثيق ${k.name} (${k.doc} ${k.number})`);
    toast(ok ? `✅ تم توثيق ${k.name}` : `تم رفض وثيقة ${k.name}`, ok ? "green" : "red");
    setView(null);
  };
  return (
    <div className="fu">
      <H title="توثيق الهوية" sub={`${q.length} وثيقة بانتظار المراجعة`} />
      {q.length === 0 && <Card style={{ padding: 40, textAlign: "center" }}><div style={{ fontSize: 36 }}>✨</div><div style={{ fontWeight: 800, marginTop: 8 }}>لا وثائق معلّقة</div></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
        {q.map(k => (
          <Card key={k.id} style={{ padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{k.name}</div>
            <div style={{ fontSize: 12, color: T.gray400, marginBottom: 12 }}>{k.doc} · <span className="num">{k.number}</span> · {k.when}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" v="outline" onClick={() => setView(k)}>📄 معاينة</Btn>
              <Btn size="sm" v="success" onClick={() => act(k, true)}>✓ قبول</Btn>
              <Btn size="sm" v="danger" onClick={() => act(k, false)}>رفض</Btn>
            </div>
          </Card>
        ))}
      </div>
      {view && (
        <Modal title={`${view.doc} — ${view.name}`} onClose={() => setView(null)}>
          <div style={{ height: 260, borderRadius: 14, background: T.surface2, border: `1px dashed ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 44 }}>🪪</span>
            <span style={{ fontSize: 12, color: T.gray400 }}>معاينة الوثيقة (رابط موقّع مؤقت في الإنتاج)</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn full v="success" onClick={() => act(view, true)}>✓ الوثيقة سليمة — توثيق</Btn>
            <Btn full v="danger" onClick={() => act(view, false)}>رفض</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Partners = ({ list, setList, readOnly, log, toast }) => {
  const [filter, setFilter] = useState("all");
  const [edit, setEdit] = useState(null);
  const shown = list.filter(p => filter === "all" ? true : filter === "agents" ? p.type === "agent" : filter === "marketers" ? p.type === "marketer" : p.status === "pending");
  const approve = (p) => { setList(list.map(x => x.id === p.id ? { ...x, status: "active", joined: "الآن" } : x)); log(`اعتماد ${p.type === "agent" ? "وكيل" : "مسوّق"}: ${p.name}`); toast(`✅ تم اعتماد ${p.name}`, "green"); };
  const suspend = (p) => { setList(list.map(x => x.id === p.id ? { ...x, status: x.status === "suspended" ? "active" : "suspended" } : x)); log(`${p.status === "suspended" ? "تفعيل" : "إيقاف"} ${p.name}`); toast(p.status === "suspended" ? "تم التفعيل" : "تم الإيقاف", p.status === "suspended" ? "green" : "red"); };
  const saveComm = () => { setList(list.map(x => x.id === edit.id ? { ...x, commission: +edit.commission } : x)); log(`تعديل عمولة ${edit.name} → ${edit.commission}%`); toast("تم تحديث العمولة", "green"); setEdit(null); };
  const totalRev = list.filter(p => p.status === "active").reduce((s, p) => s + p.revenue, 0);
  const pending = list.filter(p => p.status === "pending").length;
  return (
    <div className="fu">
      <H title="الوكلاء والمسوّقون" sub={readOnly ? "قراءة فقط" : "اعتماد الشركاء · ضبط العمولات · متابعة الأداء"} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginBottom: 20 }}>
        <Stat icon="🤝" label="شركاء نشطون" value={list.filter(p => p.status === "active").length} tone="green" />
        <Stat icon="⏳" label="طلبات انتظار" value={pending} tone="amber" />
        <Stat icon="💰" label="إيراد عبر الشركاء" value={`$${totalRev.toLocaleString()}`} tone="gold" />
        <Stat icon="📊" label="حجوزات الشركاء" value={list.reduce((s, p) => s + p.bookings, 0)} tone="blue" />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["all", "الكل"], ["agents", "الوكلاء"], ["marketers", "المسوّقون"], ["pending", `طلبات (${pending})`]].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: filter === k ? T.navyLight : T.gray100, color: filter === k ? T.goldLight : T.gray400 }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {shown.map(p => (
          <Card key={p.id} style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: p.type === "agent" ? T.blueBg : T.amberBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{p.type === "agent" ? "🏢" : "📢"}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{p.name}</span>
                <Badge c={p.type === "agent" ? "blue" : "amber"}>{p.type === "agent" ? "وكيل" : "مسوّق"}</Badge>
                {p.status === "active" ? <Badge c="green">نشط</Badge> : p.status === "pending" ? <Badge c="amber">بانتظار الاعتماد</Badge> : <Badge c="red">موقوف</Badge>}
              </div>
              <div style={{ fontSize: 12, color: T.gray400, marginTop: 3 }}>{p.contact}</div>
              <div style={{ fontSize: 11, color: T.gray400, marginTop: 4 }}>انضم: {p.joined} · <span className="num">{p.bookings}</span> حجز · <span className="num">${p.revenue.toLocaleString()}</span> إيراد</div>
            </div>
            <div style={{ textAlign: "center", minWidth: 80 }}>
              <div className="num" style={{ fontSize: 20, fontWeight: 800, color: T.gold }}>{p.commission}%</div>
              <div style={{ fontSize: 10, color: T.gray400 }}>عمولة</div>
            </div>
            {!readOnly && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {p.status === "pending" ? (
                  <Btn size="sm" v="success" onClick={() => approve(p)}>✓ اعتماد</Btn>
                ) : (
                  <>
                    <Btn size="sm" v="outline" onClick={() => setEdit({ ...p })}>عمولة</Btn>
                    <Btn size="sm" v={p.status === "suspended" ? "success" : "ghost"} onClick={() => suspend(p)}>{p.status === "suspended" ? "تفعيل" : "إيقاف"}</Btn>
                  </>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
      {edit && (
        <Modal title={`عمولة ${edit.name}`} onClose={() => setEdit(null)} w={400}>
          <Field label="نسبة العمولة %" type="number" value={edit.commission} onChange={e => setEdit({ ...edit, commission: e.target.value })} dir="ltr" note={edit.type === "agent" ? "الوكلاء عادةً 25% من صافي الهامش" : "المسوّقون عادةً 10% من صافي الهامش"} />
          <Btn full onClick={saveComm}>حفظ العمولة</Btn>
        </Modal>
      )}
      <Card style={{ padding: 16, marginTop: 14, background: T.blueBg, border: `1px solid ${T.blue}33` }}>
        <div style={{ fontSize: 12, color: T.blue, lineHeight: 1.9 }}>
          <strong>ملاحظة:</strong> العمولة تُقتطع من صافي هامش حاجز — لا تُضاف على سعر العميل. الوكلاء يحجزون نيابةً عن عملائهم؛ المسوّقون يجلبون عملاء عبر أكواد إحالة. لكل شريك لوحته المنفصلة للأداء والأرباح.
        </div>
      </Card>
    </div>
  );
};

const Team = () => (
  <div className="fu">
    <H title="الفريق والصلاحيات" sub="مصفوفة إطلاق ثلاثية — لا مشاركة حسابات، 2FA إلزامي" />
    <Card style={{ overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(7, 1fr)", background: T.bg2, padding: "12px 16px", fontSize: 11, fontWeight: 800, color: T.gray400 }}>
        <span>العضو</span><span>بنكك</span><span>الحجوزات</span><span>FX</span><span>الهوامش</span><span>المحتوى</span><span>الشركاء</span><span>السجل</span>
      </div>
      {TEAM.map(m => {
        const p = PERMS[m.role];
        const C = (v) => v === "read" ? <Badge c="blue">قراءة</Badge> : v ? <Badge c="green">✓</Badge> : <Badge c="gray">—</Badge>;
        return (
          <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(7, 1fr)", padding: "14px 16px", alignItems: "center", borderTop: `1px solid ${T.gray100}`, fontSize: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span>{m.icon}</span><div><div style={{ fontWeight: 800 }}>{m.name}</div><div style={{ fontSize: 10, color: T.gray400 }}>{m.title}</div></div></div>
            {C(p.bankak)}{C(p.bookings)}{C(p.fx)}{C(p.pricing)}{C(p.cms)}{C(p.partners)}{C(p.audit)}
          </div>
        );
      })}
    </Card>
    <Card style={{ padding: 18, marginTop: 14, background: T.amberBg, border: `1px solid ${T.amber}44` }}>
      <div style={{ fontSize: 12, color: T.amber, lineHeight: 1.9 }}>
        <strong>قواعد حاكمة:</strong> أي دفعة فوق $500 = تأكيد المالية + إشعار فوري للمؤسس · الجلسة تنتهي بعد 30 دقيقة خمول · تعديل FX والهوامش محصور بالمؤسس · كل قرار يُسجّل في سجل غير قابل للحذف.
      </div>
    </Card>
  </div>
);

const Audit = ({ list }) => (
  <div className="fu">
    <H title="سجل التدقيق" sub="كل قرار مالي وتشغيلي — غير قابل للحذف" />
    <Card style={{ overflow: "hidden" }}>
      {list.map((a, i) => (
        <div key={i} style={{ display: "flex", gap: 14, padding: "12px 18px", borderBottom: i < list.length - 1 ? `1px solid ${T.gray100}` : "none", fontSize: 13 }}>
          <span className="num" style={{ color: T.gray400, minWidth: 52 }}>{a.t}</span>
          <span style={{ color: T.goldLight, fontWeight: 700, minWidth: 70 }}>{a.u}</span>
          <span style={{ color: T.gray600 }}>{a.a}</span>
        </div>
      ))}
    </Card>
  </div>
);
