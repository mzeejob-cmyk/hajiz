import { useState, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════
// HAJIZ PARTNER PORTAL — Agents (full booking engine + wallet) &
// Marketers (tiered commission + smart links + creative kit)
// Net/Selling/Commission model · Light Luxury identity
// ═══════════════════════════════════════════════════════════════════

const T = {
  bg: "#F7F8FA", bg2: "#FFFFFF", card: "#FFFFFF", surface2: "#F1F4F8",
  text: "#0C1B2E", ink: "#FFFFFF", pure: "#FFFFFF",
  navy: "#0C1B2E", navyMid: "#12263D", navyLight: "#1B3A5C",
  gold: "#B8862F", goldLight: "#C9A34E", goldDark: "#9A6E22",
  gray100: "#EEF1F5", gray200: "#DDE3EA", gray300: "#C4CDD8",
  gray400: "#8A97A8", gray500: "#657486", gray600: "#4A5A6E", gray800: "#243447",
  green: "#0E9F6E", greenBg: "#E9F9F1", red: "#E02424", redBg: "#FDECEC",
  amber: "#C77A00", amberBg: "#FFF6E6", blue: "#2563EB", blueBg: "#EBF1FE",
};

const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Noto Kufi Arabic',sans-serif;background:${T.bg};color:${T.text};direction:rtl;-webkit-font-smoothing:antialiased}
    .num{font-family:'Space Grotesk',sans-serif!important;letter-spacing:.01em}
    button{cursor:pointer;border:none;outline:none;font-family:inherit}
    input,select{outline:none;font-family:inherit}
    ::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:${T.gray100}}
    ::-webkit-scrollbar-thumb{background:${T.gray300};border-radius:3px}
    @keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes si{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes grow{from{height:0}to{height:var(--h)}}
    .fu{animation:fu .4s cubic-bezier(.4,0,.2,1) forwards}
    .si{animation:si .25s ease forwards}
  `}</style>
);

const Btn = ({ children, onClick, v = "primary", size = "md", disabled, full, style = {} }) => {
  const pad = { sm: "8px 16px", md: "11px 22px", lg: "14px 30px" }[size];
  const fs = { sm: 12, md: 14, lg: 15 }[size];
  const variants = {
    primary: { background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, color: T.pure },
    dark: { background: T.navy, color: T.pure },
    outline: { background: "transparent", color: T.text, border: `1.5px solid ${T.gray200}` },
    ghost: { background: T.gray100, color: T.gray600 },
    success: { background: T.green, color: T.pure },
  };
  return <button onClick={onClick} disabled={disabled} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 11, fontWeight: 700, fontSize: fs, padding: pad, width: full ? "100%" : "auto", opacity: disabled ? .5 : 1, transition: "all .2s", ...variants[v], ...style }}>{children}</button>;
};
const Card = ({ children, style = {}, onClick, hover }) => (
  <div onClick={onClick} style={{ background: T.card, borderRadius: 16, border: `1px solid ${T.gray100}`, boxShadow: "0 2px 12px rgba(12,27,46,.05)", transition: hover ? "all .2s" : "none", ...style }}
    onMouseEnter={hover ? e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 30px rgba(12,27,46,.1)"; } : undefined}
    onMouseLeave={hover ? e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(12,27,46,.05)"; } : undefined}>{children}</div>
);
const Badge = ({ children, c = "gold" }) => {
  const m = { gold: [T.amberBg, T.goldDark], green: [T.greenBg, T.green], red: [T.redBg, T.red], amber: [T.amberBg, T.amber], blue: [T.blueBg, T.blue], gray: [T.gray100, T.gray500] };
  return <span style={{ display: "inline-block", padding: "3px 11px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: m[c][0], color: m[c][1] }}>{children}</span>;
};
const Field = ({ label, value, onChange, type = "text", dir, note, placeholder }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 6 }}>{label}</label>}
    <input type={type} value={value} onChange={onChange} dir={dir} placeholder={placeholder}
      style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 11, fontSize: 14, background: T.bg2, color: T.text }}
      onFocus={e => e.target.style.borderColor = T.gold} onBlur={e => e.target.style.borderColor = T.gray200} />
    {note && <p style={{ fontSize: 11, color: T.gray400, marginTop: 5 }}>{note}</p>}
  </div>
);
const Stat = ({ icon, label, value, sub, tone = "gold" }) => (
  <Card style={{ padding: 20 }}>
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: `${{ gold: T.gold, green: T.green, blue: T.blue, amber: T.amber }[tone]}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21 }}>{icon}</div>
      <div><div className="num" style={{ fontSize: 23, fontWeight: 800, color: T.text }}>{value}</div><div style={{ fontSize: 12, color: T.gray400 }}>{label}</div></div>
    </div>
    {sub && <div style={{ fontSize: 11, color: T.gray400, marginTop: 8 }}>{sub}</div>}
  </Card>
);
const Modal = ({ title, children, onClose, w = 480 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(12,27,46,.5)", backdropFilter: "blur(4px)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
    <div className="si" onClick={e => e.stopPropagation()} style={{ background: T.card, borderRadius: 20, maxWidth: w, width: "100%", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(12,27,46,.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${T.gray100}` }}>
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: T.gray100, color: T.gray500, fontSize: 15 }}>✕</button>
      </div>
      <div style={{ padding: 22 }}>{children}</div>
    </div>
  </div>
);
const Mono = ({ size = 40 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, display: "flex", alignItems: "center", justifyContent: "center", color: T.pure, fontWeight: 800, fontSize: size * .42 }}>ح</div>
);
const fmt = (n) => `$${Number(n).toLocaleString()}`;

// ── AIRPORTS / CITIES ──
const AIRPORTS = [
  { c: "KRT", city: "الخرطوم" }, { c: "PZU", city: "بورتسودان" }, { c: "JED", city: "جدة" },
  { c: "MED", city: "المدينة" }, { c: "RUH", city: "الرياض" }, { c: "DXB", city: "دبي" },
  { c: "AUH", city: "أبوظبي" }, { c: "DOH", city: "الدوحة" }, { c: "CAI", city: "القاهرة" }, { c: "IST", city: "إسطنبول" },
];
const HOTEL_CITIES = ["مكة المكرمة", "المدينة المنورة", "جدة", "الرياض", "دبي", "أبوظبي", "الدوحة", "إسطنبول"];

// ── MARKETER TIERS (standard affiliate model) ──
const TIERS = [
  { key: "bronze", name: "برونزي", icon: "🥉", min: 0, max: 10, rate: 8, color: "#CD7F32" },
  { key: "silver", name: "فضي", icon: "🥈", min: 11, max: 30, rate: 10, color: "#9CA3AF" },
  { key: "gold", name: "ذهبي", icon: "🥇", min: 31, max: 60, rate: 13, color: T.gold },
  { key: "platinum", name: "بلاتيني", icon: "💎", min: 61, max: 9999, rate: 15, color: "#2563EB" },
];
const tierOf = (n) => TIERS.find(t => n >= t.min && n <= t.max) || TIERS[0];
const nextTier = (n) => TIERS.find(t => t.min > n);

// ── PARTNER ACCOUNTS ──
const PARTNERS = {
  "agent@hajiz.com": {
    type: "agent", name: "مكتب النيل للسفر", commission: 25, refCode: "NILE25",
    balance: 2150, pending: 640, lifetime: 8600, wallet: 3200,
    bookings: [
      { id: "HJZ-K7M2QA", customer: "أحمد الطيب", service: "طيران · الخرطوم→جدة", net: 301, sold: 325, profit: 24, status: "paid", date: "15 يوليو", pay: "wallet" },
      { id: "HJZ-X3B9LC", customer: "سارة عثمان", service: "فندق هيلتون مكة · 4 ليالٍ", net: 630, sold: 720, profit: 90, status: "paid", date: "16 يوليو", pay: "bankak" },
      { id: "HJZ-P2N5TR", customer: "محمد الفاتح", service: "طيران · بورتسودان→دبي", net: 379, sold: 410, profit: 31, status: "issued", date: "اليوم", pay: "wallet" },
    ],
    deposits: [
      { amount: 2000, date: "1 يوليو", ref: "DEP-8841", status: "confirmed" },
      { amount: 1500, date: "20 يونيو", ref: "DEP-7723", status: "confirmed" },
    ],
    clients: [
      { id: "C1", name: "AHMED ALTAYEB", phone: "+249 912 345 678", passport: "P0482913", trips: 4 },
      { id: "C2", name: "SARA OSMAN", phone: "+249 923 456 789", passport: "P0771122", trips: 2 },
      { id: "C3", name: "MOHAMED ELFATIH", phone: "+971 50 123 4567", passport: "P0559384", trips: 6 },
    ],
  },
  "marketer@hajiz.com": {
    type: "marketer", name: "خالد الإعلامي", refCode: "KHALED10",
    balance: 1820, pending: 380, lifetime: 15200,
    monthlyBookings: 47, clicks: 3420, conversions: 62, rate: 1.8,
    trend: [12, 19, 15, 28, 22, 35, 47],
    referrals: [
      { id: "HJZ-A1C2D3", service: "طيران · الخرطوم→القاهرة", amount: 265, comm: 27, status: "paid", date: "أمس", platform: "instagram" },
      { id: "HJZ-E4F5G6", service: "فندق موفنبيك جدة", amount: 540, comm: 54, status: "pending", date: "اليوم", platform: "tiktok" },
      { id: "HJZ-H7J8K9", service: "طيران · دبي→الخرطوم", amount: 380, comm: 38, status: "paid", date: "قبل يومين", platform: "instagram" },
    ],
    challenges: [
      { title: "احجز 5 عملاء هذا الأسبوع", reward: 50, progress: 3, target: 5 },
      { title: "10 حجوزات فنادق هذا الشهر", reward: 80, progress: 6, target: 10 },
    ],
  },
};

// ═══════════════════════ AGENT BOOKING ENGINE (OTA standard) ═══════════════════════
// one/round/multi + filters + sort · Net/Selling/Commission pricing layer
const CABINS = { economy: "اقتصادية", business: "رجال أعمال", first: "أولى" };
const AIRLINES_A = [
  { code: "SV", name: "🟢 السعودية" }, { code: "J4", name: "🔵 بدر" }, { code: "ET", name: "🟡 الإثيوبية" },
  { code: "FZ", name: "🟠 فلاي دبي" }, { code: "QR", name: "🟣 القطرية" }, { code: "MS", name: "⚪ مصر للطيران" },
];
const TIME_SLOTS_A = [["all", "الكل"], ["dawn", "🌙 00-06"], ["morning", "🌅 06-12"], ["noon", "☀️ 12-18"], ["night", "🌆 18-24"]];
const inSlotA = (h, s) => s === "all" || (s === "dawn" && h < 6) || (s === "morning" && h >= 6 && h < 12) || (s === "noon" && h >= 12 && h < 18) || (s === "night" && h >= 18);

const buildFlightOffers = (mode, nSeg) => {
  const R = mode === "multi" ? 0.92 * nSeg : (mode === "round" ? 1.85 : 1);
  const mk = (i, al, dep, durMin, stops, market, stopCity) => {
    const dh = +dep.split(":")[0];
    const am = dh * 60 + +dep.split(":")[1] + durMin;
    const arr = `${String(Math.floor(am / 60) % 24).padStart(2, "0")}:${String(am % 60).padStart(2, "0")}`;
    const m = Math.round(market * R);
    return { id: i, air: al, dep, arr, durMin, depHour: dh, stops, stopCity, market: m, net: Math.round(m * 0.926) };
  };
  return [
    mk(0, AIRLINES_A[0], "08:30", 105, 0, 325),
    mk(1, AIRLINES_A[1], "13:00", 110, 0, 290),
    mk(2, AIRLINES_A[3], "06:15", 130, 0, 305),
    mk(3, AIRLINES_A[4], "16:45", 285, 1, 275, "الدوحة"),
    mk(4, AIRLINES_A[2], "02:40", 320, 1, 256, "أديس أبابا"),
    mk(5, AIRLINES_A[5], "20:10", 265, 1, 268, "القاهرة"),
  ];
};
const HOTEL_OFFERS_A = [
  { id: 1, name: "فندق هيلتون مكة", stars: 5, board: "مع إفطار", boardCode: "BB", market: 180, net: 158, cancel: "free", amenities: ["wifi", "pool", "gym"] },
  { id: 2, name: "موفنبيك أنجم", stars: 4, board: "غرفة فقط", boardCode: "RO", market: 120, net: 105, cancel: "free", amenities: ["wifi", "parking"] },
  { id: 3, name: "دار التوحيد إنتركونتيننتال", stars: 5, board: "مع إفطار", boardCode: "BB", market: 260, net: 228, cancel: "nonref", amenities: ["wifi", "pool", "spa", "gym"] },
  { id: 4, name: "سويس أوتيل المقام", stars: 5, board: "نصف إقامة", boardCode: "HB", market: 210, net: 184, cancel: "free", amenities: ["wifi", "gym", "spa"] },
  { id: 5, name: "فندق النخبة", stars: 3, board: "غرفة فقط", boardCode: "RO", market: 75, net: 66, cancel: "free", amenities: ["wifi"] },
];
const AMEN_A = { wifi: "واي فاي", pool: "مسبح", gym: "صالة رياضية", spa: "سبا", parking: "موقف", breakfast: "إفطار" };

const AgentBooking = ({ agent, onComplete, wallet, setWallet, clients, setClients }) => {
  const [svc, setSvc] = useState("flight");
  const [phase, setPhase] = useState("search");
  const [tripType, setTripType] = useState("round");
  const [fromA, setFromA] = useState(AIRPORTS[0]);
  const [toA, setToA] = useState(AIRPORTS[2]);
  const [dep, setDep] = useState("");
  const [ret, setRet] = useState("");
  const [segments, setSegments] = useState([{ from: AIRPORTS[0], to: AIRPORTS[2], date: "" }, { from: AIRPORTS[2], to: AIRPORTS[5], date: "" }]);
  const [pax, setPax] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabin, setCabin] = useState("economy");
  // hotel search
  const [dest, setDest] = useState("مكة المكرمة");
  const [ci, setCi] = useState("");
  const [co, setCo] = useState("");
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  // filters + sort
  const [sortBy, setSortBy] = useState("recommended");
  const [flt, setFlt] = useState({ stops: "all", airlines: new Set(), slot: "all", maxNet: 800 });
  const [hFlt, setHFlt] = useState({ minStars: 0, maxNet: 400, board: "all", freeCancel: false });
  const [showFilters, setShowFilters] = useState(false);
  // selection
  const [selected, setSelected] = useState(null);
  const [sellPrice, setSellPrice] = useState(0);
  const [paxName, setPaxName] = useState("");
  const [paxPhone, setPaxPhone] = useState("");
  const [paxPassport, setPaxPassport] = useState("");
  const [saveClient, setSaveClient] = useState(true);
  const [pickedClient, setPickedClient] = useState(null);
  const [payMethod, setPayMethod] = useState("wallet");

  const setSeg = (i, patch) => setSegments(s => s.map((x, y) => y === i ? { ...x, ...patch } : x));
  const nSeg = tripType === "multi" ? segments.length : (tripType === "round" ? 2 : 1);

  const flightOffers = useMemo(() => buildFlightOffers(tripType, nSeg), [tripType, nSeg]);
  const bestFlight = useMemo(() => ({
    cheap: Math.min(...flightOffers.map(o => o.net)),
    fast: Math.min(...flightOffers.map(o => o.durMin)),
    early: Math.min(...flightOffers.map(o => o.depHour)),
  }), [flightOffers]);
  const airlineMin = useMemo(() => { const m = {}; flightOffers.forEach(o => { m[o.air.code] = Math.min(m[o.air.code] ?? 9999, o.net); }); return m; }, [flightOffers]);

  const filteredFlights = useMemo(() => flightOffers.filter(o =>
    (flt.stops === "all" || o.stops === flt.stops) &&
    (flt.airlines.size === 0 || flt.airlines.has(o.air.code)) &&
    inSlotA(o.depHour, flt.slot) && o.net <= flt.maxNet
  ).sort((a, b) => sortBy === "cheapest" ? a.net - b.net : sortBy === "fastest" ? a.durMin - b.durMin : sortBy === "earliest" ? a.depHour - b.depHour : (a.net / bestFlight.cheap) * .6 + (a.durMin / bestFlight.fast) * .4 - ((b.net / bestFlight.cheap) * .6 + (b.durMin / bestFlight.fast) * .4)), [flightOffers, flt, sortBy, bestFlight]);

  const filteredHotels = useMemo(() => HOTEL_OFFERS_A.filter(h =>
    (hFlt.minStars === 0 || h.stars >= hFlt.minStars) && h.net <= hFlt.maxNet &&
    (hFlt.board === "all" || h.boardCode === hFlt.board) && (!hFlt.freeCancel || h.cancel === "free")
  ).sort((a, b) => sortBy === "price_low" ? a.net - b.net : sortBy === "price_high" ? b.net - a.net : sortBy === "stars" ? b.stars - a.stars : a.net - b.net), [hFlt, sortBy]);

  const fmtDur = (m) => `${Math.floor(m / 60)}س ${m % 60}د`;
  const flightFilterCount = (flt.stops !== "all" ? 1 : 0) + flt.airlines.size + (flt.slot !== "all" ? 1 : 0) + (flt.maxNet < 800 ? 1 : 0);
  const hotelFilterCount = (hFlt.minStars > 0 ? 1 : 0) + (hFlt.maxNet < 400 ? 1 : 0) + (hFlt.board !== "all" ? 1 : 0) + (hFlt.freeCancel ? 1 : 0);

  const pick = (o, isHotel) => { setSelected({ ...o, isHotel }); setSellPrice(o.market); setPhase("price"); };
  const confirmBooking = () => {
    const profit = sellPrice - selected.net;
    if (payMethod === "wallet") {
      if (wallet < selected.net) { alert("رصيد المحفظة غير كافٍ — اشحن أولاً"); return; }
      setWallet(wallet - selected.net);
    }
    // Save new client for future fast-fill
    if (saveClient && !pickedClient && paxName.trim() && setClients) {
      setClients([{ id: `C${Date.now()}`, name: paxName.trim(), phone: paxPhone, passport: paxPassport, trips: 1 }, ...clients]);
    } else if (pickedClient && setClients) {
      setClients(clients.map(x => x.id === pickedClient ? { ...x, trips: x.trips + 1 } : x));
    }
    onComplete({
      id: `HJZ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      customer: paxName,
      service: selected.isHotel ? `فندق · ${selected.name}` : (tripType === "multi" ? `طيران · ${segments.length} مقاطع` : `طيران · ${fromA.city}→${toA.city}`),
      net: selected.net, sold: sellPrice, profit, status: payMethod === "wallet" ? "issued" : "review",
      date: "الآن", pay: payMethod,
    });
    setPhase("done");
  };

  const selectStyle = { width: "100%", padding: "12px 14px", border: `1.5px solid ${T.gray200}`, borderRadius: 11, fontSize: 14, background: T.bg2, color: T.text };
  const lblStyle = { fontSize: 12, fontWeight: 700, color: T.gray600, display: "block", marginBottom: 6 };

  // ── SEARCH ──
  if (phase === "search") return (
    <div className="fu">
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>حجز جديد لعميل</h1>
      <p style={{ fontSize: 13, color: T.gray400, marginBottom: 18 }}>محرك بحث كامل — عمولتك محسوبة تلقائياً في كل عرض</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["flight", "✈️ طيران"], ["hotel", "🏨 فنادق"]].map(([k, l]) => (
          <button key={k} onClick={() => { setSvc(k); setSelected(null); }} style={{ padding: "10px 22px", borderRadius: 11, fontSize: 14, fontWeight: 700, background: svc === k ? T.navy : T.gray100, color: svc === k ? T.pure : T.gray500 }}>{l}</button>
        ))}
      </div>
      <Card style={{ padding: 22 }}>
        {svc === "flight" ? (
          <>
            {/* Trip type */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {[["round", "ذهاب وعودة"], ["oneway", "ذهاب فقط"], ["multi", "مدن متعددة"]].map(([t, l]) => (
                <button key={t} onClick={() => setTripType(t)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: tripType === t ? "rgba(184,134,47,.12)" : T.gray100, color: tripType === t ? T.goldDark : T.gray500, border: `1px solid ${tripType === t ? "rgba(184,134,47,.35)" : "transparent"}` }}>{l}</button>
              ))}
            </div>
            {tripType !== "multi" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "end", marginBottom: 12 }}>
                  <div><label style={lblStyle}>من</label>
                    <select value={fromA.c} onChange={e => setFromA(AIRPORTS.find(a => a.c === e.target.value))} style={selectStyle}>{AIRPORTS.map(a => <option key={a.c} value={a.c}>{a.city} ({a.c})</option>)}</select></div>
                  <button onClick={() => { const t = fromA; setFromA(toA); setToA(t); }} style={{ width: 40, height: 44, borderRadius: 11, background: "rgba(184,134,47,.1)", border: `1.5px solid rgba(184,134,47,.3)`, color: T.goldDark, fontSize: 16 }}>⇄</button>
                  <div><label style={lblStyle}>إلى</label>
                    <select value={toA.c} onChange={e => setToA(AIRPORTS.find(a => a.c === e.target.value))} style={selectStyle}>{AIRPORTS.map(a => <option key={a.c} value={a.c}>{a.city} ({a.c})</option>)}</select></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: tripType === "round" ? "1fr 1fr" : "1fr", gap: 12 }}>
                  <Field label="تاريخ الذهاب" type="date" value={dep} onChange={e => setDep(e.target.value)} />
                  {tripType === "round" && <Field label="تاريخ العودة" type="date" value={ret} onChange={e => setRet(e.target.value)} />}
                </div>
              </>
            ) : (
              <>
                {segments.map((s, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr auto", gap: 10, alignItems: "end", marginBottom: 10 }}>
                    <span className="num" style={{ fontSize: 11, fontWeight: 700, color: T.goldDark, background: "rgba(184,134,47,.1)", borderRadius: 8, padding: "10px 10px", marginBottom: 1 }}>{i + 1}</span>
                    <div><label style={lblStyle}>من</label><select value={s.from?.c} onChange={e => setSeg(i, { from: AIRPORTS.find(a => a.c === e.target.value) })} style={selectStyle}>{AIRPORTS.map(a => <option key={a.c} value={a.c}>{a.city}</option>)}</select></div>
                    <div><label style={lblStyle}>إلى</label><select value={s.to?.c} onChange={e => setSeg(i, { to: AIRPORTS.find(a => a.c === e.target.value) })} style={selectStyle}>{AIRPORTS.map(a => <option key={a.c} value={a.c}>{a.city}</option>)}</select></div>
                    <Field label="التاريخ" type="date" value={s.date} onChange={e => setSeg(i, { date: e.target.value })} />
                    {segments.length > 2 ? <button onClick={() => setSegments(segments.filter((_, y) => y !== i))} style={{ width: 40, height: 44, borderRadius: 11, background: T.redBg, color: T.red, fontSize: 16, marginBottom: 1 }}>×</button> : <span />}
                  </div>
                ))}
                {segments.length < 5 && <button onClick={() => setSegments([...segments, { from: segments[segments.length - 1].to, to: AIRPORTS[0], date: "" }])} style={{ padding: "10px 18px", borderRadius: 11, background: "transparent", border: `1.5px dashed rgba(184,134,47,.4)`, color: T.goldDark, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>+ إضافة رحلة</button>}
              </>
            )}
            {/* Pax + cabin */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr", gap: 10, marginTop: 12 }}>
              <div><label style={lblStyle}>بالغون</label><select value={pax.adults} onChange={e => setPax({ ...pax, adults: +e.target.value })} style={selectStyle}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label style={lblStyle}>أطفال</label><select value={pax.children} onChange={e => setPax({ ...pax, children: +e.target.value })} style={selectStyle}>{[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label style={lblStyle}>رضّع</label><select value={pax.infants} onChange={e => setPax({ ...pax, infants: +e.target.value })} style={selectStyle}>{[0, 1, 2].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label style={lblStyle}>الدرجة</label><select value={cabin} onChange={e => setCabin(e.target.value)} style={selectStyle}>{Object.entries(CABINS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <Btn size="lg" onClick={() => { setPhase("results"); setShowFilters(false); }} disabled={tripType === "multi" ? !segments.every(s => s.date) : !dep || (tripType === "round" && !ret)} style={{ marginTop: 16 }}>🔍 بحث عن رحلات</Btn>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div><label style={lblStyle}>الوجهة</label><select value={dest} onChange={e => setDest(e.target.value)} style={selectStyle}>{HOTEL_CITIES.map(ci => <option key={ci} value={ci}>{ci}</option>)}</select></div>
              <Field label="الدخول" type="date" value={ci} onChange={e => setCi(e.target.value)} />
              <Field label="الخروج" type="date" value={co} onChange={e => setCo(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={lblStyle}>الغرف</label><select value={rooms} onChange={e => setRooms(+e.target.value)} style={selectStyle}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} غرفة</option>)}</select></div>
              <div><label style={lblStyle}>الضيوف</label><select value={guests} onChange={e => setGuests(+e.target.value)} style={selectStyle}>{[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} ضيف</option>)}</select></div>
            </div>
            <Btn size="lg" onClick={() => { setPhase("results"); setShowFilters(false); }} disabled={!ci || !co} style={{ marginTop: 16 }}>🔍 بحث عن فنادق</Btn>
          </>
        )}
      </Card>
    </div>
  );

  // ── RESULTS ──
  if (phase === "results") return (
    <div className="fu">
      <button onClick={() => setPhase("search")} style={{ color: T.gold, fontSize: 14, fontWeight: 700, marginBottom: 14, background: "none" }}>← تعديل البحث</button>
      <div style={{ background: T.blueBg, border: `1px solid ${T.blue}22`, borderRadius: 12, padding: "11px 16px", marginBottom: 16, fontSize: 12, color: T.blue, lineHeight: 1.6 }}>
        💡 <strong>صافي</strong> = تكلفتك · <strong>سوق</strong> = سعر العميل العادي · <strong>ربحك</strong> = الفرق المضمون. ترفع سعر بيعك لاحقاً لربح أكبر.
      </div>

      {/* Sort tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
        {(svc === "flight"
          ? [["recommended", "الأنسب", ""], ["cheapest", "الأرخص", fmt(bestFlight.cheap)], ["fastest", "الأسرع", fmtDur(bestFlight.fast)], ["earliest", "الأبكر", `${String(bestFlight.early).padStart(2, "0")}:00`]]
          : [["recommended", "الأنسب", ""], ["price_low", "الأرخص", ""], ["price_high", "الأعلى", ""], ["stars", "النجوم", ""]]
        ).map(([k, l, v]) => (
          <button key={k} onClick={() => setSortBy(k)} style={{ padding: "9px 6px", borderRadius: 12, textAlign: "center", border: `1.5px solid ${sortBy === k ? T.gold : T.gray200}`, background: sortBy === k ? "rgba(184,134,47,.08)" : T.card }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: sortBy === k ? T.goldDark : T.gray600 }}>{l}</div>
            {v && <div className="num" style={{ fontSize: 10, color: T.gray400, direction: "ltr" }}>{v}</div>}
          </button>
        ))}
      </div>

      {/* Collapsible filters */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setShowFilters(!showFilters)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", background: T.card, border: `1.5px solid ${showFilters ? T.gold : T.gray200}`, borderRadius: showFilters ? "12px 12px 0 0" : 12, fontSize: 13, fontWeight: 700, color: T.text }}>
          <span>⚙️ تصفية {(svc === "flight" ? flightFilterCount : hotelFilterCount) > 0 && <span className="num" style={{ background: T.gold, color: T.ink, fontSize: 11, padding: "2px 8px", borderRadius: 20, marginRight: 6 }}>{svc === "flight" ? flightFilterCount : hotelFilterCount}</span>}</span>
          <span style={{ fontSize: 12, color: T.gray400 }}>{(svc === "flight" ? filteredFlights : filteredHotels).length} نتيجة {showFilters ? "▲" : "▼"}</span>
        </button>
        {showFilters && (
          <div style={{ background: T.card, border: `1.5px solid ${T.gold}`, borderTop: "none", borderRadius: "0 0 12px 12px", padding: 18 }}>
            {svc === "flight" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>التوقفات</div>
                  {[["all", "الكل"], [0, "مباشر"], [1, "توقف واحد"]].map(([v, l]) => <button key={String(v)} onClick={() => setFlt({ ...flt, stops: v })} style={{ display: "block", width: "100%", textAlign: "right", padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 4, background: flt.stops === v ? "rgba(184,134,47,.1)" : "transparent", color: flt.stops === v ? T.goldDark : T.gray500, border: `1px solid ${flt.stops === v ? "rgba(184,134,47,.3)" : T.gray100}` }}>{l}</button>)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>وقت المغادرة</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>{TIME_SLOTS_A.map(([v, l]) => <button key={v} onClick={() => setFlt({ ...flt, slot: v })} style={{ padding: "7px 4px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${flt.slot === v ? T.gold : T.gray200}`, background: flt.slot === v ? "rgba(184,134,47,.1)" : "transparent", color: flt.slot === v ? T.goldDark : T.gray500 }}>{l}</button>)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>شركات الطيران</div>
                  {AIRLINES_A.filter(a => airlineMin[a.code] !== undefined).map(a => <label key={a.code} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: "pointer", fontSize: 12 }}><input type="checkbox" checked={flt.airlines.has(a.code)} onChange={() => { const s = new Set(flt.airlines); s.has(a.code) ? s.delete(a.code) : s.add(a.code); setFlt({ ...flt, airlines: s }); }} style={{ accentColor: T.gold }} /><span style={{ flex: 1 }}>{a.name}</span><span className="num" style={{ fontSize: 10, color: T.gray400, direction: "ltr" }}>{fmt(airlineMin[a.code])}</span></label>)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>أقصى صافي: <span className="num" style={{ color: T.goldDark }}>{fmt(flt.maxNet)}</span></div>
                  <input type="range" min={100} max={800} step={25} value={flt.maxNet} onChange={e => setFlt({ ...flt, maxNet: +e.target.value })} style={{ width: "100%", accentColor: T.gold }} />
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 18 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>النجوم</div>
                  <div style={{ display: "flex", gap: 6 }}>{[0, 3, 4, 5].map(s => <button key={s} onClick={() => setHFlt({ ...hFlt, minStars: s })} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, border: `1.5px solid ${hFlt.minStars === s ? T.gold : T.gray200}`, background: hFlt.minStars === s ? "rgba(184,134,47,.1)" : "transparent", color: hFlt.minStars === s ? T.goldDark : T.gray500 }}>{s === 0 ? "الكل" : `${s}★`}</button>)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>الوجبات</div>
                  <select value={hFlt.board} onChange={e => setHFlt({ ...hFlt, board: e.target.value })} style={{ ...selectStyle, padding: "8px 12px" }}><option value="all">الكل</option><option value="RO">غرفة فقط</option><option value="BB">مع إفطار</option><option value="HB">نصف إقامة</option></select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>أقصى صافي/ليلة: <span className="num" style={{ color: T.goldDark }}>{fmt(hFlt.maxNet)}</span></div>
                  <input type="range" min={50} max={400} step={10} value={hFlt.maxNet} onChange={e => setHFlt({ ...hFlt, maxNet: +e.target.value })} style={{ width: "100%", accentColor: T.gold }} />
                  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, cursor: "pointer", fontSize: 12 }}><input type="checkbox" checked={hFlt.freeCancel} onChange={() => setHFlt({ ...hFlt, freeCancel: !hFlt.freeCancel })} style={{ accentColor: T.gold }} />إلغاء مجاني فقط</label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results list */}
      {svc === "flight" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFlights.length === 0 ? <Card style={{ padding: 40, textAlign: "center", color: T.gray400 }}>لا رحلات بهذه الفلاتر</Card> : filteredFlights.map(o => {
            const profit = o.market - o.net;
            return (
              <Card key={o.id} hover style={{ padding: 18 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{o.air.name}</div>
                    <div className="num" style={{ fontSize: 13, color: T.gray500, marginTop: 4 }}>{o.dep} → {o.arr} · {fmtDur(o.durMin)}</div>
                    <div style={{ marginTop: 5 }}><Badge c={tripType === "multi" ? "blue" : o.stops === 0 ? "green" : "amber"}>{tripType === "multi" ? `${nSeg} مقاطع` : o.stops === 0 ? "مباشر" : `توقف · ${o.stopCity}`}</Badge></div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 12, color: T.gray400, textDecoration: "line-through", direction: "ltr" }}>{fmt(o.market)}</div><div style={{ fontSize: 9, color: T.gray400 }}>سوق</div></div>
                    <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 19, fontWeight: 800, color: T.text, direction: "ltr" }}>{fmt(o.net)}</div><div style={{ fontSize: 9, color: T.gray400 }}>صافي</div></div>
                    <div style={{ textAlign: "center", background: T.greenBg, borderRadius: 9, padding: "7px 11px" }}><div className="num" style={{ fontSize: 16, fontWeight: 800, color: T.green, direction: "ltr" }}>+{fmt(profit)}</div><div style={{ fontSize: 9, color: T.green }}>ربحك</div></div>
                    <Btn onClick={() => pick(o, false)}>اختيار</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredHotels.length === 0 ? <Card style={{ padding: 40, textAlign: "center", color: T.gray400 }}>لا فنادق بهذه الفلاتر</Card> : filteredHotels.map(o => {
            const profit = o.market - o.net;
            return (
              <Card key={o.id} hover style={{ padding: 18 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{o.name} <span style={{ color: T.gold }}>{"★".repeat(o.stars)}</span></div>
                    <div style={{ fontSize: 13, color: T.gray500, marginTop: 4 }}>{o.board} · للّيلة</div>
                    <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                      <Badge c={o.board === "غرفة فقط" ? "gray" : "green"}>{o.board}</Badge>
                      {o.cancel === "free" ? <Badge c="green">إلغاء مجاني</Badge> : <Badge c="red">غير قابل للاسترداد</Badge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 12, color: T.gray400, textDecoration: "line-through", direction: "ltr" }}>{fmt(o.market)}</div><div style={{ fontSize: 9, color: T.gray400 }}>سوق</div></div>
                    <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 19, fontWeight: 800, color: T.text, direction: "ltr" }}>{fmt(o.net)}</div><div style={{ fontSize: 9, color: T.gray400 }}>صافي</div></div>
                    <div style={{ textAlign: "center", background: T.greenBg, borderRadius: 9, padding: "7px 11px" }}><div className="num" style={{ fontSize: 16, fontWeight: 800, color: T.green, direction: "ltr" }}>+{fmt(profit)}</div><div style={{ fontSize: 9, color: T.green }}>ربحك</div></div>
                    <Btn onClick={() => pick(o, true)}>اختيار</Btn>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── PRICE (set selling price) ──
  if (phase === "price" && selected) {
    const profit = sellPrice - selected.net;
    const validPrice = sellPrice >= selected.net;
    return (
      <div className="fu">
        <button onClick={() => setPhase("results")} style={{ color: T.gold, fontSize: 14, fontWeight: 700, marginBottom: 16, background: "none" }}>← رجوع للنتائج</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>حدّد سعر البيع لعميلك</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
          <Card style={{ padding: 24 }}>
            <Field label="السعر الذي ستبيع به لعميلك" type="number" value={sellPrice} onChange={e => setSellPrice(+e.target.value)} dir="ltr" note={validPrice ? "" : "⚠️ لا يمكن البيع تحت صافي التكلفة"} />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[selected.net, selected.market, Math.round(selected.market * 1.05)].map((p, x) => (
                <button key={x} onClick={() => setSellPrice(p)} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, fontSize: 12, fontWeight: 700, border: `1.5px solid ${sellPrice === p ? T.gold : T.gray200}`, background: sellPrice === p ? "rgba(184,134,47,.1)" : "transparent", color: sellPrice === p ? T.goldDark : T.gray500 }}>
                  {x === 0 ? "التكلفة" : x === 1 ? "سعر السوق" : "سوق +5%"}<br /><span className="num">{fmt(p)}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: "14px 16px", background: validPrice ? T.greenBg : T.redBg, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: validPrice ? T.green : T.red }}>ربحك من هذا الحجز</span>
              <span className="num" style={{ fontSize: 24, fontWeight: 800, color: validPrice ? T.green : T.red, direction: "ltr" }}>{fmt(profit)}</span>
            </div>
            <Btn full size="lg" onClick={() => setPhase("pax")} disabled={!validPrice} style={{ marginTop: 18 }}>متابعة لبيانات المسافر →</Btn>
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>ملخص</div>
            <div style={{ fontSize: 13, color: T.gray600, lineHeight: 2.2 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>الخدمة</span><strong style={{ color: T.text }}>{selected.isHotel ? "فندق" : "طيران"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>صافي التكلفة</span><strong className="num" style={{ color: T.text, direction: "ltr" }}>{fmt(selected.net)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>سعر بيعك</span><strong className="num" style={{ color: T.text, direction: "ltr" }}>{fmt(sellPrice)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${T.gray100}`, paddingTop: 8, marginTop: 4 }}><span style={{ color: T.green }}>ربحك</span><strong className="num" style={{ color: T.green, direction: "ltr" }}>{fmt(profit)}</strong></div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── PAX + PAYMENT ──
  if (phase === "pax" && selected) {
    const profit = sellPrice - selected.net;
    const canPay = paxName.trim().length > 2 && paxPhone.length > 6 && (payMethod === "bankak" || wallet >= selected.net);
    return (
      <div className="fu">
        <button onClick={() => setPhase("price")} style={{ color: T.gold, fontSize: 14, fontWeight: 700, marginBottom: 16, background: "none" }}>← رجوع</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 18 }}>بيانات المسافر والدفع</h1>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <Card style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>👤 بيانات المسافر</div>
              {/* Saved clients — fast fill */}
              {clients && clients.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, marginBottom: 8 }}>عملاؤك المحفوظون — اختر للتعبئة الفورية</div>
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {clients.map(cl => (
                      <button key={cl.id} onClick={() => {
                        if (pickedClient === cl.id) { setPickedClient(null); setPaxName(""); setPaxPhone(""); setPaxPassport(""); }
                        else { setPickedClient(cl.id); setPaxName(cl.name); setPaxPhone(cl.phone); setPaxPassport(cl.passport); }
                      }} style={{ flexShrink: 0, textAlign: "right", padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${pickedClient === cl.id ? T.gold : T.gray200}`, background: pickedClient === cl.id ? "rgba(184,134,47,.08)" : T.bg2, minWidth: 150 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{cl.name.split(" ")[0]}</span>
                          {pickedClient === cl.id && <span style={{ color: T.gold, fontSize: 13 }}>✓</span>}
                        </div>
                        <div className="num" style={{ fontSize: 10, color: T.gray400, direction: "ltr", marginTop: 2 }}>{cl.passport} · {cl.trips} رحلات</div>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", color: T.gray400, fontSize: 11 }}>
                    <div style={{ flex: 1, height: 1, background: T.gray200 }} /><span>أو أدخل عميلاً جديداً</span><div style={{ flex: 1, height: 1, background: T.gray200 }} />
                  </div>
                </div>
              )}
              <Field label="الاسم الكامل (كما في الجواز)" value={paxName} onChange={e => { setPaxName(e.target.value.toUpperCase()); setPickedClient(null); }} placeholder="AHMED ALTAYEB" dir="ltr" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="رقم الهاتف (واتساب)" value={paxPhone} onChange={e => setPaxPhone(e.target.value)} placeholder="+249 9xxxxxxxx" dir="ltr" />
                <Field label="رقم الجواز" value={paxPassport} onChange={e => setPaxPassport(e.target.value.toUpperCase())} placeholder="P0123456" dir="ltr" />
              </div>
              {!pickedClient && paxName.trim() && (
                <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", padding: "10px 12px", background: T.surface2, borderRadius: 10, marginTop: 4 }}>
                  <div onClick={() => setSaveClient(!saveClient)} style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${saveClient ? T.gold : T.gray300}`, background: saveClient ? T.gold : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{saveClient && <span style={{ color: T.ink, fontSize: 12 }}>✓</span>}</div>
                  <span style={{ fontSize: 12, color: T.gray600 }}>💾 حفظ هذا العميل للحجوزات القادمة</span>
                </label>
              )}
            </Card>
            <Card style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>💳 طريقة الدفع</div>
              <button onClick={() => setPayMethod("wallet")} style={{ width: "100%", textAlign: "right", padding: 16, borderRadius: 12, marginBottom: 10, border: `2px solid ${payMethod === "wallet" ? T.gold : T.gray200}`, background: payMethod === "wallet" ? "rgba(184,134,47,.06)" : T.bg2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontSize: 14, fontWeight: 800 }}>💰 رصيد المحفظة</div><div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>خصم فوري · تأكيد وتذكرة لحظية</div></div>
                  <div style={{ textAlign: "left" }}><div className="num" style={{ fontSize: 15, fontWeight: 800, color: wallet >= selected.net ? T.green : T.red, direction: "ltr" }}>{fmt(wallet)}</div><div style={{ fontSize: 10, color: T.gray400 }}>رصيدك</div></div>
                </div>
                {wallet < selected.net && <div style={{ fontSize: 11, color: T.red, marginTop: 8 }}>⚠️ الرصيد لا يكفي — اشحن المحفظة أو ادفع ببنكك</div>}
              </button>
              <button onClick={() => setPayMethod("bankak")} style={{ width: "100%", textAlign: "right", padding: 16, borderRadius: 12, border: `2px solid ${payMethod === "bankak" ? T.gold : T.gray200}`, background: payMethod === "bankak" ? "rgba(184,134,47,.06)" : T.bg2 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>🏦 بنكك</div>
                <div style={{ fontSize: 12, color: T.gray400, marginTop: 2 }}>تحويل + رفع إيصال · مراجعة خلال 30 دقيقة</div>
              </button>
            </Card>
          </div>
          <Card style={{ padding: 20, position: "sticky", top: 80 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>ملخص الحجز</div>
            <div style={{ fontSize: 13, color: T.gray600, lineHeight: 2.1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>صافي التكلفة</span><strong className="num" style={{ color: T.text, direction: "ltr" }}>{fmt(selected.net)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>سعر البيع</span><strong className="num" style={{ color: T.text, direction: "ltr" }}>{fmt(sellPrice)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between", color: T.green, borderTop: `1px solid ${T.gray100}`, paddingTop: 8, marginTop: 4 }}><span>ربحك</span><strong className="num" style={{ direction: "ltr" }}>{fmt(profit)}</strong></div>
            </div>
            <div style={{ background: T.navy, color: T.pure, borderRadius: 12, padding: 14, marginTop: 14 }}>
              <div style={{ fontSize: 12, opacity: .8 }}>المبلغ المستحق عليك الآن</div>
              <div className="num" style={{ fontSize: 26, fontWeight: 800, color: T.gold, direction: "ltr" }}>{fmt(selected.net)}</div>
            </div>
            <Btn full size="lg" onClick={confirmBooking} disabled={!canPay} style={{ marginTop: 14 }}>{payMethod === "wallet" ? "تأكيد الحجز فوراً" : "متابعة دفع بنكك"}</Btn>
          </Card>
        </div>
      </div>
    );
  }

  // ── DONE ──
  if (phase === "done" && selected) {
    const profit = sellPrice - selected.net;
    return (
      <div className="fu" style={{ maxWidth: 500, margin: "0 auto", textAlign: "center", paddingTop: 20 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.greenBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 20px" }}>{payMethod === "wallet" ? "✅" : "⏳"}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>{payMethod === "wallet" ? "تم الحجز بنجاح!" : "بانتظار تأكيد الدفع"}</h1>
        <p style={{ fontSize: 14, color: T.gray500, marginBottom: 22, lineHeight: 1.7 }}>{payMethod === "wallet" ? "خُصم المبلغ من محفظتك — تصل التذكرة لعميلك خلال دقائق" : "أكمل تحويل بنكك ليتم إصدار التذكرة خلال 30 دقيقة"}</p>
        <Card style={{ padding: 20, textAlign: "right", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: T.gray500 }}>العميل</span><strong>{paxName}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}><span style={{ color: T.gray500 }}>سعر البيع</span><strong className="num" style={{ direction: "ltr" }}>{fmt(sellPrice)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, borderTop: `1px solid ${T.gray100}`, marginTop: 4 }}><span style={{ color: T.green }}>ربحك</span><strong className="num" style={{ color: T.green, direction: "ltr" }}>+{fmt(profit)}</strong></div>
        </Card>
        <Btn full size="lg" onClick={() => { setPhase("search"); setSelected(null); setPaxName(""); setPaxPhone(""); }}>حجز جديد</Btn>
      </div>
    );
  }
  return null;
};

// ═══════════════════════ MAIN APP ═══════════════════════
export default function HajizPartner() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [toast, setToast] = useState("");
  const [wallet, setWallet] = useState(0);
  const [myBookings, setMyBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [topUp, setTopUp] = useState(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const login = () => {
    const acc = PARTNERS[email.trim().toLowerCase()];
    if (!acc || pass.length < 4) { setErr("بيانات الدخول غير صحيحة"); return; }
    setErr(""); setUser(acc); setWallet(acc.wallet || 0);
    setMyBookings(acc.bookings || acc.referrals || []);
    setClients(acc.clients || []);
  };
  const copyRef = () => showToast("تم نسخ الرابط ✓");

  if (!user) return (
    <>
      <GS />
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: `radial-gradient(900px 500px at 80% -10%, #EAF0F8, transparent 60%), ${T.bg}` }}>
        <div className="fu" style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Mono size={60} /></div>
            <h1 style={{ fontSize: 25, fontWeight: 800, margin: "16px 0 6px" }}>بوابة شركاء <span style={{ color: T.gold }}>حاجز</span></h1>
            <p style={{ color: T.gray400, fontSize: 13 }}>للوكلاء والمسوّقين</p>
          </div>
          <Card style={{ padding: 28 }}>
            <Field label="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} dir="ltr" />
            <Field label="كلمة المرور" type="password" value={pass} onChange={e => setPass(e.target.value)} dir="ltr" />
            {err && <p style={{ fontSize: 12, color: T.red, marginBottom: 12 }}>{err}</p>}
            <Btn full size="lg" onClick={login}>تسجيل الدخول</Btn>
            <div style={{ marginTop: 16, padding: 12, background: T.bg2, border: `1px solid ${T.gray100}`, borderRadius: 10, fontSize: 11, color: T.gray400, lineHeight: 1.9 }}>
              <div style={{ fontWeight: 700, color: T.gray600, marginBottom: 4 }}>حسابات تجريبية (كلمة المرور: demo):</div>
              <div className="num" style={{ direction: "ltr", textAlign: "left" }}>🏢 agent@hajiz.com</div>
              <div className="num" style={{ direction: "ltr", textAlign: "left" }}>📢 marketer@hajiz.com</div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );

  const isAgent = user.type === "agent";
  const refLink = `hajiz.com/?ref=${user.refCode}`;
  const NAV = isAgent
    ? [{ id: "overview", label: "نظرة عامة", icon: "📊" }, { id: "book", label: "حجز جديد", icon: "➕" }, { id: "bookings", label: "حجوزاتي", icon: "🎫" }, { id: "clients", label: "عملائي", icon: "👥" }, { id: "wallet", label: "المحفظة", icon: "💰" }, { id: "earnings", label: "الأرباح", icon: "💵" }]
    : [{ id: "overview", label: "لوحة الأداء", icon: "📊" }, { id: "tier", label: "مستواي والعمولة", icon: "🏆" }, { id: "links", label: "روابط وأدوات", icon: "🔗" }, { id: "kit", label: "المواد الترويجية", icon: "🎨" }, { id: "earnings", label: "الأرباح والتحديات", icon: "💵" }];

  const mkTier = !isAgent ? tierOf(user.monthlyBookings) : null;
  const mkNext = !isAgent ? nextTier(user.monthlyBookings) : null;

  return (
    <>
      <GS />
      <div style={{ minHeight: "100vh" }}>
        <header style={{ background: T.card, borderBottom: `1px solid ${T.gray100}`, padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Mono size={38} />
            <div><div style={{ fontWeight: 800, fontSize: 15 }}>بوابة الشركاء</div><div style={{ fontSize: 11, color: T.gray400 }}>{user.name}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isAgent
              ? <Badge c="blue">🏢 وكيل · عمولة {user.commission}%</Badge>
              : <Badge c="amber">{mkTier.icon} {mkTier.name} · {mkTier.rate}%</Badge>}
            <Btn size="sm" v="ghost" onClick={() => { setUser(null); setEmail(""); setPass(""); setTab("overview"); }}>خروج</Btn>
          </div>
        </header>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 60px", display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "start" }}>
          <Card style={{ padding: 10, position: "sticky", top: 80 }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "right", padding: "12px 14px", borderRadius: 11, fontSize: 14, fontWeight: 700, marginBottom: 3, background: tab === n.id ? "rgba(184,134,47,.10)" : "transparent", color: tab === n.id ? T.goldDark : T.gray600, border: tab === n.id ? "1px solid rgba(184,134,47,.28)" : "1px solid transparent" }}>
                <span style={{ fontSize: 17 }}>{n.icon}</span>{n.label}
              </button>
            ))}
          </Card>

          <div>
            {/* ═══ OVERVIEW ═══ */}
            {tab === "overview" && (
              <div className="fu">
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 18 }}>أهلاً {user.name.split(" ")[0]} 👋</h1>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
                  <Stat icon="💵" label="رصيد قابل للسحب" value={fmt(user.balance)} tone="green" />
                  <Stat icon="⏳" label="قيد التحصيل" value={fmt(user.pending)} tone="amber" />
                  <Stat icon="🏆" label="إجمالي الأرباح" value={fmt(user.lifetime)} tone="gold" />
                  {isAgent
                    ? <Stat icon="💰" label="رصيد المحفظة" value={fmt(wallet)} tone="blue" />
                    : <Stat icon="🎯" label="حجوزات الشهر" value={user.monthlyBookings} tone="blue" />}
                </div>

                {isAgent && (
                  <Card style={{ padding: 20, marginBottom: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", background: `linear-gradient(135deg,${T.navy},${T.navyMid})`, color: T.pure }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 800 }}>ابدأ حجزاً جديداً لعميلك</div>
                      <div style={{ fontSize: 12, opacity: .8, marginTop: 4 }}>عمولتك محسوبة في كل عرض · دفع فوري من المحفظة</div>
                    </div>
                    <Btn onClick={() => setTab("book")}>➕ حجز جديد</Btn>
                  </Card>
                )}

                {!isAgent && (
                  <>
                    <Card style={{ padding: 22, marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>📈 أرباح آخر 7 أيام</div>
                        <Badge c="green">↑ نمو {user.rate}%</Badge>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
                        {user.trend.map((v, x) => {
                          const max = Math.max(...user.trend);
                          return (
                            <div key={x} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                              <div style={{ width: "100%", height: `${(v / max) * 100}px`, background: x === user.trend.length - 1 ? `linear-gradient(180deg,${T.gold},${T.goldDark})` : T.gray200, borderRadius: "6px 6px 0 0", transition: "all .3s" }} />
                              <span className="num" style={{ fontSize: 10, color: T.gray400 }}>{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                      <Card style={{ padding: 18, textAlign: "center" }}><div className="num" style={{ fontSize: 26, fontWeight: 800, color: T.blue }}>{user.clicks.toLocaleString()}</div><div style={{ fontSize: 12, color: T.gray400 }}>نقرة</div></Card>
                      <Card style={{ padding: 18, textAlign: "center" }}><div className="num" style={{ fontSize: 26, fontWeight: 800, color: T.green }}>{user.conversions}</div><div style={{ fontSize: 12, color: T.gray400 }}>تحويل</div></Card>
                      <Card style={{ padding: 18, textAlign: "center" }}><div className="num" style={{ fontSize: 26, fontWeight: 800, color: T.gold }}>{user.rate}%</div><div style={{ fontSize: 12, color: T.gray400 }}>معدل التحويل</div></Card>
                    </div>
                  </>
                )}

                <Card style={{ padding: 20, marginTop: 16, background: `linear-gradient(135deg,${T.navy},${T.navyMid})`, color: T.pure }}>
                  <div style={{ fontSize: 13, opacity: .8, marginBottom: 6 }}>🔗 رابط الإحالة الخاص بك</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <code className="num" style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,.1)", padding: "12px 14px", borderRadius: 10, fontSize: 14, color: T.goldLight, direction: "ltr" }}>{refLink}</code>
                    <Btn size="sm" onClick={copyRef}>📋 نسخ</Btn>
                  </div>
                </Card>
              </div>
            )}

            {/* ═══ AGENT: BOOK ═══ */}
            {tab === "book" && isAgent && (
              <AgentBooking agent={user} wallet={wallet} setWallet={setWallet} clients={clients} setClients={setClients}
                onComplete={(bk) => { if (bk) { setMyBookings([bk, ...myBookings]); showToast(bk.pay === "wallet" ? "تم الحجز وخصم المبلغ من المحفظة ✓" : "بانتظار دفع بنكك"); } }} />
            )}

            {/* ═══ AGENT: MY BOOKINGS ═══ */}
            {tab === "bookings" && isAgent && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800 }}>حجوزاتي</h1>
                  <Btn size="sm" onClick={() => setTab("book")}>➕ حجز جديد</Btn>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {myBookings.map(b => (
                    <Card key={b.id} style={{ padding: 16 }}>
                      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 170 }}>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{b.service}</div>
                          <div style={{ fontSize: 12, color: T.gray400 }}>{b.customer} · <span className="num">{b.id}</span> · {b.date}</div>
                        </div>
                        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 12, color: T.gray400, direction: "ltr" }}>{fmt(b.net)}</div><div style={{ fontSize: 9, color: T.gray400 }}>تكلفة</div></div>
                          <div style={{ textAlign: "center" }}><div className="num" style={{ fontSize: 13, fontWeight: 700, color: T.text, direction: "ltr" }}>{fmt(b.sold)}</div><div style={{ fontSize: 9, color: T.gray400 }}>بيع</div></div>
                          <div style={{ textAlign: "center", background: T.greenBg, borderRadius: 8, padding: "6px 10px" }}><div className="num" style={{ fontSize: 15, fontWeight: 800, color: T.green, direction: "ltr" }}>+{fmt(b.profit)}</div><div style={{ fontSize: 9, color: T.green }}>ربح</div></div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                            <Badge c={b.status === "paid" || b.status === "issued" ? "green" : b.status === "review" ? "amber" : "gray"}>{b.status === "paid" ? "مدفوع" : b.status === "issued" ? "صدرت التذكرة" : b.status === "review" ? "مراجعة بنكك" : b.status}</Badge>
                            <span style={{ fontSize: 10, color: T.gray400 }}>{b.pay === "wallet" ? "💰 محفظة" : "🏦 بنكك"}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ AGENT: WALLET ═══ */}
            {tab === "clients" && isAgent && (
              <div className="fu">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800 }}>عملائي</h1>
                  <Btn size="sm" onClick={() => setTab("book")}>➕ حجز لعميل</Btn>
                </div>
                <p style={{ fontSize: 13, color: T.gray400, marginBottom: 18 }}>بيانات عملائك المحفوظة — تُعبّأ فوراً عند الحجز</p>
                {clients.length === 0 ? (
                  <Card style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 42, marginBottom: 12 }}>👥</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>لا عملاء محفوظون بعد</div>
                    <p style={{ fontSize: 13, color: T.gray400, marginBottom: 18 }}>احفظ عملاءك تلقائياً عند إتمام أول حجز</p>
                    <Btn onClick={() => setTab("book")}>ابدأ حجزاً</Btn>
                  </Card>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {clients.sort((a, b) => b.trips - a.trips).map(cl => (
                      <Card key={cl.id} style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ width: 46, height: 46, borderRadius: "50%", background: `linear-gradient(135deg,${T.gold},${T.goldDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: T.pure, fontWeight: 800, flexShrink: 0 }}>{cl.name.charAt(0)}</div>
                        <div style={{ flex: 1, minWidth: 160 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, direction: "ltr", textAlign: "right" }}>{cl.name}</div>
                          <div className="num" style={{ fontSize: 12, color: T.gray400, direction: "ltr", textAlign: "right" }}>{cl.phone} · جواز {cl.passport}</div>
                        </div>
                        <div style={{ textAlign: "center", minWidth: 60 }}>
                          <div className="num" style={{ fontSize: 18, fontWeight: 800, color: T.gold }}>{cl.trips}</div>
                          <div style={{ fontSize: 10, color: T.gray400 }}>رحلات</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn size="sm" onClick={() => setTab("book")}>حجز جديد</Btn>
                          <button onClick={() => setClients(clients.filter(x => x.id !== cl.id))} style={{ width: 34, height: 34, borderRadius: 9, background: T.redBg, color: T.red, fontSize: 15 }}>×</button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "wallet" && isAgent && (
              <div className="fu">
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>محفظة الوكيل</h1>
                <Card style={{ padding: 26, marginBottom: 16, background: `linear-gradient(135deg,${T.navy},${T.navyMid})`, color: T.pure }}>
                  <div style={{ fontSize: 13, opacity: .8 }}>الرصيد المتاح للحجز</div>
                  <div className="num" style={{ fontSize: 38, fontWeight: 800, color: T.gold, margin: "6px 0" }}>{fmt(wallet)}</div>
                  <div style={{ fontSize: 12, opacity: .7, marginBottom: 16 }}>يُخصم منه تلقائياً عند كل حجز — تأكيد فوري بلا انتظار</div>
                  <Btn v="primary" onClick={() => setTopUp({ amount: "" })}>+ شحن الرصيد</Btn>
                </Card>
                <Card style={{ padding: 16, marginBottom: 16, background: T.blueBg, border: `1px solid ${T.blue}22` }}>
                  <div style={{ fontSize: 12, color: T.blue, lineHeight: 1.8 }}>
                    <strong>كيف تعمل المحفظة؟</strong> أودِع مبلغاً عبر بنكك → يُضاف لرصيدك بعد التأكيد → احجز لعملائك فوراً بخصم مباشر. الميزة: تأكيد لحظي بلا مراجعة كل مرة، وأسعار مضمونة.
                  </div>
                </Card>
                <Card style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>سجل الإيداعات</h3>
                  {user.deposits.map((d, x) => (
                    <div key={x} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: x < user.deposits.length - 1 ? `1px solid ${T.gray100}` : "none" }}>
                      <div><div style={{ fontSize: 13, fontWeight: 700 }}>إيداع رصيد</div><div className="num" style={{ fontSize: 11, color: T.gray400 }}>{d.ref} · {d.date}</div></div>
                      <div style={{ textAlign: "left" }}><div className="num" style={{ fontSize: 15, fontWeight: 800, color: T.green, direction: "ltr" }}>+{fmt(d.amount)}</div><Badge c="green">مؤكد</Badge></div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* ═══ MARKETER: TIER ═══ */}
            {tab === "tier" && !isAgent && (
              <div className="fu">
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>مستواك ونظام العمولة</h1>
                <Card style={{ padding: 26, marginBottom: 16, textAlign: "center", background: `linear-gradient(135deg,${mkTier.color}, ${mkTier.color}CC)`, color: T.pure }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>{mkTier.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>المستوى {mkTier.name}</div>
                  <div style={{ fontSize: 15, opacity: .9, marginTop: 4 }}>عمولتك الحالية <span className="num" style={{ fontWeight: 800 }}>{mkTier.rate}%</span> على كل حجز</div>
                </Card>
                {mkNext && (
                  <Card style={{ padding: 22, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.gray600 }}>التقدّم للمستوى {mkNext.name} {mkNext.icon}</span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 800, color: T.gold }}>{user.monthlyBookings}/{mkNext.min}</span>
                    </div>
                    <div style={{ height: 12, background: T.gray100, borderRadius: 20, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min((user.monthlyBookings / mkNext.min) * 100, 100)}%`, height: "100%", background: `linear-gradient(90deg,${T.gold},${T.goldDark})`, borderRadius: 20, transition: "width .5s" }} />
                    </div>
                    <p style={{ fontSize: 13, color: T.gray500, marginTop: 12, textAlign: "center" }}>
                      باقي <strong style={{ color: T.gold }}>{mkNext.min - user.monthlyBookings} حجوزات</strong> لترقية عمولتك إلى <strong style={{ color: T.gold }}>{mkNext.rate}%</strong> على كل حجزاتك القادمة 🚀
                    </p>
                  </Card>
                )}
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>كل المستويات</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {TIERS.map(t => (
                    <Card key={t.key} style={{ padding: 16, display: "flex", alignItems: "center", gap: 14, border: t.key === mkTier.key ? `2px solid ${T.gold}` : `1px solid ${T.gray100}` }}>
                      <div style={{ fontSize: 30 }}>{t.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800 }}>{t.name} {t.key === mkTier.key && <Badge c="gold">مستواك</Badge>}</div>
                        <div className="num" style={{ fontSize: 12, color: T.gray400 }}>{t.min}{t.max < 9999 ? `-${t.max}` : "+"} حجز/شهر</div>
                      </div>
                      <div className="num" style={{ fontSize: 22, fontWeight: 800, color: t.color }}>{t.rate}%</div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ MARKETER: LINKS + QR ═══ */}
            {tab === "links" && !isAgent && (
              <div className="fu">
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>روابط الإحالة الذكية</h1>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[["الصفحة الرئيسية", refLink, "🏠"], ["عروض الطيران", `${refLink}&s=flights`, "✈️"], ["عروض الفنادق", `${refLink}&s=hotels`, "🏨"], ["وجهة جدة", `${refLink}&d=jed`, "📍"]].map(([l, url, ic], x) => (
                    <Card key={x} style={{ padding: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: T.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{ic}</div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{l}</div>
                        <code className="num" style={{ fontSize: 11, color: T.gray400, direction: "ltr" }}>{url}</code>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Btn size="sm" v="outline" onClick={copyRef}>📋 نسخ</Btn>
                        <Btn size="sm" v="ghost" onClick={() => showToast("تم تحميل رمز QR ✓")}>⬛ QR</Btn>
                      </div>
                    </Card>
                  ))}
                </div>
                <Card style={{ padding: 20, marginTop: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>📊 أداء المنصات</div>
                  {[["instagram", "إنستغرام", 68, T.red], ["tiktok", "تيك توك", 24, T.navy], ["whatsapp", "واتساب", 8, T.green]].map(([k, l, pct, col]) => (
                    <div key={k} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}><span style={{ fontWeight: 700 }}>{l}</span><span className="num" style={{ color: T.gray500 }}>{pct}%</span></div>
                      <div style={{ height: 8, background: T.gray100, borderRadius: 20, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 20 }} /></div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* ═══ MARKETER: CREATIVE KIT ═══ */}
            {tab === "kit" && !isAgent && (
              <div className="fu">
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>المواد الترويجية</h1>
                <p style={{ fontSize: 13, color: T.gray400, marginBottom: 18 }}>صور ونصوص جاهزة بهوية حاجز — حمّل وشارك مباشرة</p>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>🎨 التصاميم الجاهزة</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
                  {[["بوست إنستغرام", "1080×1080"], ["ستوري", "1080×1920"], ["بانر", "1200×628"], ["واتساب", "800×800"]].map(([m, dim], x) => (
                    <Card key={x} hover style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => showToast("جاري التحميل...")}>
                      <div style={{ aspectRatio: "1", background: `linear-gradient(135deg,${T.navy},${T.navyMid})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: T.pure, position: "relative" }}>
                        <Mono size={36} />
                        <span style={{ fontSize: 12, fontWeight: 700, marginTop: 10 }}>{m}</span>
                        <span className="num" style={{ fontSize: 10, opacity: .6, marginTop: 2 }}>{dim}</span>
                        <div style={{ position: "absolute", bottom: 10, fontSize: 18 }}>⬇️</div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>✍️ نصوص تسويقية جاهزة</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    "احجز رحلتك من السودان بأسعار شفافة ودفع محلي عبر بنكك 🇸🇩✈️ رابط الحجز في البايو",
                    "طيران + فنادق بأفضل الأسعار للمسافرين السودانيين — تأكيد فوري ودعم عربي 24/7 🏨",
                    "خصم خاص لمتابعيني على حجوزات حاجز! استخدم رابطي واحجز الآن 🎫",
                  ].map((txt, x) => (
                    <Card key={x} style={{ padding: 14, display: "flex", gap: 12, alignItems: "center" }}>
                      <p style={{ flex: 1, fontSize: 13, color: T.gray600, lineHeight: 1.7 }}>{txt}</p>
                      <Btn size="sm" v="outline" onClick={() => showToast("تم النسخ ✓")}>نسخ</Btn>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ EARNINGS (both) ═══ */}
            {tab === "earnings" && (
              <div className="fu">
                <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>الأرباح {!isAgent && "والتحديات"}</h1>
                <Card style={{ padding: 26, marginBottom: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: T.gray400 }}>رصيد قابل للسحب</div>
                  <div className="num" style={{ fontSize: 40, fontWeight: 800, color: T.green, margin: "8px 0" }}>{fmt(user.balance)}</div>
                  <Btn size="lg" onClick={() => showToast("تم إرسال طلب السحب — يُحوّل خلال " + (isAgent ? "3 أيام" : "أسبوع"))} disabled={user.balance < (isAgent ? 100 : 50)}>طلب سحب الأرباح</Btn>
                  <p style={{ fontSize: 11, color: T.gray400, marginTop: 10 }}>الحد الأدنى {isAgent ? "$100" : "$50"} · عبر بنكك أو تحويل بنكي</p>
                </Card>

                {!isAgent && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>🎯 التحديات النشطة</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                      {user.challenges.map((ch, x) => (
                        <Card key={x} style={{ padding: 18 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{ch.title}</div>
                            <Badge c="green">+{fmt(ch.reward)}</Badge>
                          </div>
                          <div style={{ height: 10, background: T.gray100, borderRadius: 20, overflow: "hidden" }}>
                            <div style={{ width: `${(ch.progress / ch.target) * 100}%`, height: "100%", background: `linear-gradient(90deg,${T.green},#0B8A5F)`, borderRadius: 20 }} />
                          </div>
                          <div style={{ fontSize: 12, color: T.gray500, marginTop: 8, textAlign: "center" }}>
                            <span className="num">{ch.progress}/{ch.target}</span> — باقي <strong style={{ color: T.green }}>{ch.target - ch.progress}</strong> لتحصل على <strong style={{ color: T.green }}>{fmt(ch.reward)}</strong>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                <Card style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>سجل المدفوعات</h3>
                  {[["سحب أرباح يونيو", isAgent ? "$1,240" : "$680", "5 يوليو"], ["سحب أرباح مايو", isAgent ? "$980" : "$420", "3 يونيو"]].map(([t, a, d], x) => (
                    <div key={x} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: x < 1 ? `1px solid ${T.gray100}` : "none" }}>
                      <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 11, color: T.gray400 }}>{d}</div></div>
                      <div style={{ textAlign: "left" }}><div className="num" style={{ fontSize: 15, fontWeight: 800, color: T.text, direction: "ltr" }}>{a}</div><Badge c="green">مكتمل</Badge></div>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {topUp && (
        <Modal title="شحن رصيد المحفظة" onClose={() => setTopUp(null)} w={420}>
          <Field label="المبلغ (دولار)" type="number" value={topUp.amount} onChange={e => setTopUp({ amount: e.target.value })} dir="ltr" placeholder="1000" note="يُضاف للرصيد بعد تأكيد تحويل بنكك" />
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[500, 1000, 2000, 5000].map(a => (
              <button key={a} onClick={() => setTopUp({ amount: a })} style={{ flex: 1, padding: "10px 4px", borderRadius: 9, fontSize: 13, fontWeight: 700, border: `1.5px solid ${+topUp.amount === a ? T.gold : T.gray200}`, background: +topUp.amount === a ? "rgba(184,134,47,.1)" : "transparent", color: +topUp.amount === a ? T.goldDark : T.gray500 }} className="num">${a}</button>
            ))}
          </div>
          <div style={{ background: T.amberBg, borderRadius: 10, padding: 12, fontSize: 12, color: T.amber, lineHeight: 1.7, marginBottom: 16 }}>
            حوّل المبلغ لحساب حاجز — بنكك، ثم ارفع الإيصال. يُضاف للرصيد خلال 30 دقيقة بعد المراجعة.
          </div>
          <Btn full size="lg" onClick={() => { if (+topUp.amount >= 100) { showToast("تم استلام طلب الشحن — أكمل تحويل بنكك"); setTopUp(null); } }}>متابعة الدفع عبر بنكك</Btn>
        </Modal>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 3000, background: T.navy, color: T.pure, padding: "12px 22px", borderRadius: 13, fontSize: 13, fontWeight: 700, animation: "toastIn .3s ease", boxShadow: "0 8px 24px rgba(12,27,46,.2)" }}>{toast}</div>
      )}
    </>
  );
}
