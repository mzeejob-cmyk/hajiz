const PREPRODUCTION_AUTH_URL = "https://auth.pp.travelport.net/oauth/token"
const PREPRODUCTION_AIR_BASE_URL = "https://api.pp.travelport.net/11/air"

const requireFetch = (fetchImpl) => {
  if (typeof fetchImpl !== "function") throw new TypeError("a server fetch implementation is required")
}

export function createTravelportConfig(env = {}) {
  const credentials = {
    username: env.TRAVELPORT_USERNAME,
    password: env.TRAVELPORT_PASSWORD,
    clientId: env.TRAVELPORT_CLIENT_ID,
    clientSecret: env.TRAVELPORT_CLIENT_SECRET,
  }
  const configured = Object.values(credentials).every((value) => typeof value === "string" && value.length > 0)
  return Object.freeze({
    configured,
    credentials: configured ? Object.freeze(credentials) : undefined,
    accessGroup: env.TRAVELPORT_ACCESS_GROUP || undefined,
    authUrl: PREPRODUCTION_AUTH_URL,
    airBaseUrl: PREPRODUCTION_AIR_BASE_URL,
  })
}

export function createTravelportClient({ config, fetchImpl, now = () => Date.now() }) {
  requireFetch(fetchImpl)
  if (!config?.configured || !config.credentials) throw new Error("Travelport pre-production credentials are not configured")
  if (config.authUrl !== PREPRODUCTION_AUTH_URL || config.airBaseUrl !== PREPRODUCTION_AIR_BASE_URL) {
    throw new Error("only Travelport pre-production endpoints are allowed")
  }

  let cachedToken
  async function token() {
    if (cachedToken && cachedToken.expiresAt > now() + 60_000) return cachedToken.value
    const body = new URLSearchParams({
      grant_type: "password",
      username: config.credentials.username,
      password: config.credentials.password,
      client_id: config.credentials.clientId,
      client_secret: config.credentials.clientSecret,
    })
    const response = await fetchImpl(config.authUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })
    if (!response.ok) throw new Error(`Travelport authentication failed (${response.status})`)
    const payload = await response.json()
    if (typeof payload.access_token !== "string" || !payload.access_token) throw new Error("Travelport authentication returned no access token")
    const lifetimeSeconds = Number(payload.expires_in) || 86_400
    cachedToken = { value: payload.access_token, expiresAt: now() + lifetimeSeconds * 1000 }
    return cachedToken.value
  }

  async function post(path, payload, traceId) {
    if (!path.startsWith("/")) throw new TypeError("Travelport path must be relative")
    const headers = {
      authorization: `Bearer ${await token()}`,
      "content-type": "application/json",
      accept: "application/json",
      "Accept-Version": "11",
      "Content-Version": "11",
    }
    if (config.accessGroup) headers.XAUTH_TRAVELPORT_ACCESSGROUP = config.accessGroup
    if (traceId) headers.traceId = traceId
    const response = await fetchImpl(`${config.airBaseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(payload) })
    if (!response.ok) throw new Error(`Travelport request failed (${response.status})`)
    return response.json()
  }

  return Object.freeze({ post })
}

export const TRAVELPORT_PREPRODUCTION_ENDPOINTS = Object.freeze({
  auth: PREPRODUCTION_AUTH_URL,
  air: PREPRODUCTION_AIR_BASE_URL,
})
