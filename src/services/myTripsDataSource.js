import { createClient } from "@supabase/supabase-js"
import { toMyTripsPresentation } from "../features/account/data/myTripsContract.js"

export const HAJIZ_STAGING_PROJECT_REF = "pdnuswmljownjzjzpoop"

function stagingConfig(env = import.meta.env) {
  const url = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error("MY_TRIPS_AUTH_NOT_CONFIGURED")
  const parsed = new URL(url)
  if (parsed.protocol !== "https:" || parsed.hostname !== `${HAJIZ_STAGING_PROJECT_REF}.supabase.co`) throw new Error("MY_TRIPS_STAGING_ONLY")
  return { url: parsed.origin, anonKey }
}

export function createMyTripsDataSource({ client } = {}) {
  let authenticatedClient = client
  return Object.freeze({ async load() {
    if (!authenticatedClient) { const { url, anonKey } = stagingConfig(); authenticatedClient = createClient(url, anonKey) }
    const { data: authData, error: authError } = await authenticatedClient.auth.getUser()
    if (authError || !authData?.user) throw new Error("MY_TRIPS_AUTH_REQUIRED")
    const [bookingsResult, paymentsResult] = await Promise.all([authenticatedClient.rpc("get_my_bookings"), authenticatedClient.rpc("get_my_payments")])
    if (bookingsResult.error || paymentsResult.error) throw new Error("MY_TRIPS_READ_FAILED")
    return toMyTripsPresentation(bookingsResult.data, paymentsResult.data)
  } })
}

export const myTripsDataSource = createMyTripsDataSource()
