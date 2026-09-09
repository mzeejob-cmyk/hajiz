import { getAccountSessionClient } from "./myTripsDataSource.js"

function safeUser(user) {
  if (!user || typeof user.id !== "string") return null
  return Object.freeze({ id: user.id, email: typeof user.email === "string" ? user.email : "" })
}

function validateCredentials(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).sort().join(",") !== "email,password") throw new Error("AUTH_INPUT_INVALID")
  const email = typeof input.email === "string" ? input.email.trim() : ""
  const password = input.password
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || !password || password.length > 1024) throw new Error("AUTH_INPUT_INVALID")
  return { email, password }
}

export function createAuthSessionDataSource({ getClient = getAccountSessionClient } = {}) {
  const client = () => getClient()
  return Object.freeze({
    async getCurrentUser() {
      try {
        const { data, error } = await client().auth.getUser()
        if (error) throw new Error("AUTH_SESSION_FAILED")
        return safeUser(data?.user)
      } catch {
        throw new Error("AUTH_SESSION_FAILED")
      }
    },
    async signIn(input) {
      const credentials = validateCredentials(input)
      try {
        const auth = client().auth
        const result = await auth.signInWithPassword(credentials)
        if (result.error || !result.data?.user) throw new Error("AUTH_SIGN_IN_FAILED")
        const verified = await auth.getUser()
        if (verified.error || !verified.data?.user) throw new Error("AUTH_SIGN_IN_FAILED")
        return safeUser(verified.data.user)
      } catch {
        throw new Error("AUTH_SIGN_IN_FAILED")
      }
    },
    subscribe(callback) {
      if (typeof callback !== "function") throw new Error("AUTH_SESSION_FAILED")
      try {
        const { data } = client().auth.onAuthStateChange((_event, session) => callback(safeUser(session?.user)))
        return () => data?.subscription?.unsubscribe()
      } catch {
        throw new Error("AUTH_SESSION_FAILED")
      }
    },
  })
}

export const authSessionDataSource = createAuthSessionDataSource()
