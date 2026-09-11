import { createClient } from "@supabase/supabase-js"
import { createSupabaseFlightBookingIntentStoreV1 } from "../bookings/flightBookingIntentStoreV1.js"
import { createFlightBookingIntentServiceV1 } from "../bookings/flightBookingIntentV1.js"
import { createCustomerFlightCheckoutServiceV1 } from "../checkout/customerFlightCheckoutV1.js"
import { createCustomerFlightBookingIntentHttpHandlerV1 } from "../http/customerFlightBookingIntentHttpV1.js"
import { createCustomerFlightCheckoutHttpHandlerV1 } from "../http/customerFlightCheckoutHttpV1.js"
import { createCustomerFlightPaymentInitiationHttpHandlerV1 } from "../http/customerFlightPaymentInitiationHttpV1.js"
import { createCustomerFlightRepriceHttpHandlerV1 } from "../http/customerFlightRepriceHttpV1.js"
import { createCustomerFlightSearchHttpHandlerV1 } from "../http/customerFlightSearchHttpV1.js"
import { createSupabaseFlightPaymentInitiationStoreV1 } from "../payments/flightPaymentInitiationStoreV1.js"
import { createFlightPaymentCommercialRevalidatorV1, createFlightPaymentInitiationServiceV1 } from "../payments/flightPaymentInitiationV1.js"
import { createCustomerFlightRepriceServiceV1 } from "../search/customerFlightRepriceV1.js"
import { createSupabaseFlightPricedSelectionStoreV1 } from "../search/flightPricedSelectionStoreV1.js"
import { createSupabaseFlightSelectionResolverV1 } from "../search/flightSelectionResolverV1.js"
import { createMultiSupplierFlightSearchOrchestrator } from "../suppliers/multiSupplierSearchOrchestrator.js"
import { createSupplierRegistry } from "../suppliers/supplierRegistry.js"
import { createBoundedInMemoryFlightAdmissionV1, createHajizFlightHttpHostV1, parseFlightAllowedOriginsV1 } from "./flightHttpHostV1.js"

export const FLIGHT_SERVER_COMPOSITION_VERSION = "flight-server-composition/v1"
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const required = (condition, code) => { if (!condition) throw new Error(code) }
const header = (headers, name) => headers instanceof Headers ? headers.get(name) : headers?.[name.toLowerCase()] ?? headers?.[name]

export function readFlightServerEnvironmentV1(env = process.env) {
  required(env?.HAJIZ_FLIGHT_HOST_ENABLED === "true", "FLIGHT_HOST_NOT_ENABLED")
  const supabaseUrl = env.HAJIZ_SUPABASE_URL
  let parsed
  try { parsed = new URL(supabaseUrl) } catch { throw new Error("HAJIZ_SUPABASE_URL_REQUIRED") }
  required(parsed.protocol === "https:" && parsed.origin === supabaseUrl, "HAJIZ_SUPABASE_URL_INVALID")
  const supabaseSecret = env.HAJIZ_SUPABASE_SECRET_KEY || env.HAJIZ_SUPABASE_SERVICE_ROLE_KEY
  required(typeof supabaseSecret === "string" && supabaseSecret.length >= 20, "HAJIZ_SUPABASE_SECRET_KEY_REQUIRED")
  required(typeof env.HAJIZ_FLIGHT_TOKEN_SECRET === "string" && env.HAJIZ_FLIGHT_TOKEN_SECRET.length >= 32, "HAJIZ_FLIGHT_TOKEN_SECRET_REQUIRED")
  const allowedOrigins = parseFlightAllowedOriginsV1(env.HAJIZ_ALLOWED_ORIGINS)
  return Object.freeze({ supabaseUrl, supabaseSecret, tokenSecret: env.HAJIZ_FLIGHT_TOKEN_SECRET, allowedOrigins })
}

export function createSupabaseFlightOwnerContextResolverV1({ client }) {
  if (!client?.auth?.getUser) throw new TypeError("server Supabase auth client is required")
  return async request => {
    const authorization = header(request?.headers, "authorization")
    if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) return null
    let result
    try { result = await client.auth.getUser(authorization.slice(7)) } catch { return null }
    const ownerId = result?.data?.user?.id
    if (result?.error || !uuid.test(ownerId)) return null
    return Object.freeze({ ownerId, source: "authenticated" })
  }
}

const serverClient = (factory, url, secret) => factory(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

export function createFlightDurabilityAdapterPairV1({ createClientImpl = createClient, supabaseUrl, supabaseSecret, clock = Date.now }) {
  if (typeof createClientImpl !== "function" || typeof supabaseUrl !== "string" || typeof supabaseSecret !== "string") throw new TypeError("secure durability probe configuration is required")
  const clientA = serverClient(createClientImpl, supabaseUrl, supabaseSecret)
  const clientB = serverClient(createClientImpl, supabaseUrl, supabaseSecret)
  required(clientA !== clientB, "DISTINCT_SUPABASE_CLIENTS_REQUIRED")
  return Object.freeze({
    clientA,
    clientB,
    resolverA: createSupabaseFlightSelectionResolverV1({ client: clientA, clock }),
    resolverB: createSupabaseFlightSelectionResolverV1({ client: clientB, clock }),
    pricedStoreA: createSupabaseFlightPricedSelectionStoreV1({ client: clientA, clock }),
    pricedStoreB: createSupabaseFlightPricedSelectionStoreV1({ client: clientB, clock }),
  })
}

export function createHajizFlightServerCompositionV1({
  env = process.env,
  createClientImpl = createClient,
  supplierAdapters,
  enabledProviderNames,
  defaultProviderName,
  supplierPolicy,
  pricingPolicy,
  fxSnapshotsByPair,
  rankingPolicy,
  pspRegistry = null,
  pspConfig = null,
  bankakConfig = null,
  admission,
  logger,
  clock = Date.now,
  requestTimeoutMs = 15_000,
} = {}) {
  const config = readFlightServerEnvironmentV1(env)
  if (!Array.isArray(supplierAdapters) || !Array.isArray(enabledProviderNames) || !supplierAdapters.length || !enabledProviderNames.length) throw new TypeError("explicit server supplier configuration is required")
  const client = serverClient(createClientImpl, config.supabaseUrl, config.supabaseSecret)
  const selectionResolver = createSupabaseFlightSelectionResolverV1({ client, clock })
  const pricedSelectionStore = createSupabaseFlightPricedSelectionStoreV1({ client, clock })
  const bookingIntentStore = createSupabaseFlightBookingIntentStoreV1({ client })
  const paymentStore = createSupabaseFlightPaymentInitiationStoreV1({ client })
  const supplierRegistry = createSupplierRegistry({ adapters: supplierAdapters, enabledProviderNames, defaultProviderName, env })
  const orchestrator = createMultiSupplierFlightSearchOrchestrator({ registry: supplierRegistry, policy: supplierPolicy, now: clock })
  const repriceService = createCustomerFlightRepriceServiceV1({ resolver: selectionResolver, pricedSelectionStore, supplierRegistry, pricingPolicy, fxSnapshotsByPair, tokenSecret: config.tokenSecret, clock })
  const checkoutService = createCustomerFlightCheckoutServiceV1({ repriceService, supplierRegistry, pricingPolicy, fxSnapshotsByPair, clock })
  const bookingIntentService = createFlightBookingIntentServiceV1({ checkoutService, repriceService, intentStore: bookingIntentStore, clock })
  const commercialRevalidator = createFlightPaymentCommercialRevalidatorV1({ supplierRegistry, pricingPolicy, fxSnapshotsByPair, clock })
  const paymentInitiationService = createFlightPaymentInitiationServiceV1({ intentStore: bookingIntentStore, paymentStore, commercialRevalidator, pspRegistry, pspConfig, bankakConfig, clock })
  const resolveOwnerContext = createSupabaseFlightOwnerContextResolverV1({ client })
  const handlers = Object.freeze({
    search: createCustomerFlightSearchHttpHandlerV1({ orchestrator, pricingPolicy, fxSnapshotsByPair, rankingPolicy, requestTimeoutMs: Math.min(requestTimeoutMs, orchestrator.policy.requestTimeoutMs), clock, selectionResolver }),
    reprice: createCustomerFlightRepriceHttpHandlerV1({ service: repriceService }),
    checkout: createCustomerFlightCheckoutHttpHandlerV1({ service: checkoutService }),
    bookingIntent: createCustomerFlightBookingIntentHttpHandlerV1({ service: bookingIntentService, resolveOwnerContext }),
    paymentInitiation: createCustomerFlightPaymentInitiationHttpHandlerV1({ service: paymentInitiationService, resolveOwnerContext }),
  })
  const host = createHajizFlightHttpHostV1({
    handlers,
    allowedOrigins: config.allowedOrigins,
    admission: admission ?? createBoundedInMemoryFlightAdmissionV1(),
    logger,
    clock,
    requestTimeoutMs,
  })
  return Object.freeze({
    contractVersion: FLIGHT_SERVER_COMPOSITION_VERSION,
    fetch: host.fetch,
    safeConfiguration: Object.freeze({ allowedOrigins: config.allowedOrigins, admission: host.admission, supplierProviders: Object.freeze([...enabledProviderNames]) }),
  })
}
