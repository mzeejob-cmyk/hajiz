import { supabase } from "./supabaseClient.js"

// إنشاء رقم حجز فريد
function genRef() {
  return "HJZ-" + Math.random().toString(36).substring(2, 8).toUpperCase()
}

// حفظ حجز جديد في قاعدة البيانات
export async function createBooking(booking, user) {
  // Get the real authenticated user from the current session (matches auth.uid())
  const { data: authData } = await supabase.auth.getUser();
  const realUser = authData?.user;
  if (!realUser) {
    return { ok: false, error: "يجب تسجيل الدخول أولاً" };
  }
  const ref = booking.ref || genRef();
  const { data, error } = await supabase.from("bookings").insert({
    ref,
    user_id: realUser.id,
    service_type: booking.serviceType || booking.type || "flight",
    title: booking.title || "",
    details: booking.details || {},
    net_cost: booking.netCost || booking.price || 0,
    sold_price: booking.price || 0,
    currency: booking.currency || "USD",
    status: "pending_payment",
    pay_method: "bankak",
    pax_name: booking.paxName || "",
    pax_phone: booking.paxPhone || "",
    pax_passport: booking.paxPassport || "",
  }).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, booking: data, ref };
}

// جلب حجوزات المستخدم الحالي (لـ "رحلاتي")
export async function getMyBookings(user) {
  if (!user?.id) return { ok: true, bookings: [] }
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, bookings: data }
}

// رفع إيصال بنكك إلى التخزين
export async function uploadReceipt(file, user, bookingRef) {
  // Get real authenticated user from session
  const { data: authData } = await supabase.auth.getUser();
  const realUser = authData?.user;
  if (!realUser || !file) {
    return { ok: false, error: "بيانات ناقصة" };
  }
  const ext = file.name.split(".").pop();
  const path = `${realUser.id}/${bookingRef}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, path };
}

// تسجيل دفعة بنكك (تدخل طابور المراجعة)
export async function createPayment(bookingId, payment) {
  const { data, error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    reference: payment.reference || "",
    amount: payment.amount || 0,
    currency: payment.currency || "SDG",
    receipt_url: payment.receiptPath || null,
    status: "awaiting",
  }).select().single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, payment: data }
}
