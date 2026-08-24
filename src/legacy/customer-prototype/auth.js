import { supabase } from "./supabaseClient.js"

// إنشاء حساب جديد — يحفظ في Supabase Auth + ينشئ profile تلقائياً
export async function signUpUser(email, password, profile = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile.fullName || "",
        phone: profile.phone || "",
        role: "customer",
      },
    },
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, user: data.user }
}

// تسجيل الدخول
export async function signInUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  return { ok: true, user: data.user }
}

// تسجيل الخروج
export async function signOutUser() {
  await supabase.auth.signOut()
}

// جلب الجلسة الحالية (لو المستخدم مسجّل مسبقاً)
export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data?.user || null
}
