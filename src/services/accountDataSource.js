import { getAccountSessionClient } from "./myTripsDataSource.js"

export function createAccountDataSource({ getClient = getAccountSessionClient } = {}) {
  async function authenticated() {
    const client = getClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data?.user?.id) throw new Error("ACCOUNT_AUTH_REQUIRED")
    return { client, user: data.user }
  }
  return Object.freeze({
    async load() {
      const { client, user } = await authenticated()
      // RLS selects the authenticated owner's row; no owner supplied in URL or body.
      const { data, error } = await client.from("profiles").select("id,display_name,phone").single()
      if (error || data?.id !== user.id) throw new Error("ACCOUNT_READ_FAILED")
      const current = await client.auth.getUser()
      if (current.error || current.data?.user?.id !== user.id) throw new Error("ACCOUNT_SESSION_CHANGED")
      return { displayName: data.display_name ?? "", phone: data.phone ?? "", email: user.email ?? "" }
    },
    async saveProfile(input) {
      if (!input || Object.keys(input).length !== 2 || Object.keys(input).some(k => !["displayName", "phone"].includes(k))) throw new Error("ACCOUNT_FIELDS_INVALID")
      if (typeof input.displayName !== "string" || !input.displayName.trim() || input.displayName.trim().length > 80 || typeof input.phone !== "string" || input.phone.trim().length > 32) throw new Error("ACCOUNT_FIELDS_INVALID")
      const { client } = await authenticated()
      const result = await client.rpc("update_my_profile", { p_display_name: input.displayName.trim(), p_phone: input.phone.trim() })
      if (result.error) throw new Error("ACCOUNT_UPDATE_FAILED")
      return { saved: true }
    },
    async logout() {
      const { error } = await getClient().auth.signOut({ scope: "local" })
      if (error) throw new Error("ACCOUNT_LOGOUT_FAILED")
    },
    subscribe(onChange) {
      const { data } = getClient().auth.onAuthStateChange(() => { onChange() })
      return () => data.subscription.unsubscribe()
    },
  })
}
export const accountDataSource = createAccountDataSource()
