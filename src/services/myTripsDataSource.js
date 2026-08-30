import { createClient } from "@supabase/supabase-js"
import { toMyTicketDetails, toMyTripsPresentation } from "../features/account/data/myTripsContract.js"

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
  const requireClient = async () => {
    if (!authenticatedClient) { const { url, anonKey } = stagingConfig(); authenticatedClient = createClient(url, anonKey) }
    const { data: authData, error: authError } = await authenticatedClient.auth.getUser()
    if (authError || !authData?.user) throw new Error("MY_TRIPS_AUTH_REQUIRED")
    return authenticatedClient
  }
  return Object.freeze({
    async load() {
      const client = await requireClient()
      const [bookingsResult, paymentsResult, ticketingResult] = await Promise.all([client.rpc("get_my_bookings"), client.rpc("get_my_payments"), client.rpc("get_my_flight_ticketing_v1")])
      if (bookingsResult.error || paymentsResult.error || ticketingResult.error) throw new Error("MY_TRIPS_READ_FAILED")
      return toMyTripsPresentation(bookingsResult.data, paymentsResult.data, ticketingResult.data)
    },
    async loadTicketDetails(bookingReference) {
      if (typeof bookingReference !== "string" || !/^HJZ-[A-Z0-9-]{4,40}$/.test(bookingReference)) throw new Error("MY_TRIPS_INVALID_BOOKING_REFERENCE")
      const client = await requireClient()
      const result = await client.rpc("get_my_flight_ticket_records_v1", { p_booking_ref: bookingReference })
      if (result.error) throw new Error("MY_TRIPS_TICKET_READ_FAILED")
      return toMyTicketDetails(result.data)
    },
  })
}

export const myTripsDataSource = createMyTripsDataSource()
