# Flight Node runtime

This provider-neutral Node entrypoint serves the built Vite application and the existing Flight HTTP Host from one origin. It is intended only for a non-production environment while the configured supplier remains synthetic.

## Runtime contract

- Node: 22 LTS or newer.
- Install: `npm ci`
- Build: `npm run build`
- Start: `npm start`
- Health: `GET /healthz` (process liveness only).
- HTTPS: terminated by the hosting provider or trusted reverse proxy.
- The browser and `/api/v1/flights/*` must share the same public origin.

| Name | Requirement | Boundary | Purpose | Safe default | Failure mode |
| --- | --- | --- | --- | --- | --- |
| `PORT` | Required in production-like hosting | Server | Listening port assigned by provider | `3000` only outside `NODE_ENV=production` | Startup fails |
| `HOST` | Optional | Server | Listening interface | `0.0.0.0` | Startup fails if invalid |
| `NODE_ENV` | Required by deployment policy | Server | Prevents synthetic suppliers in production | None | `production` refuses mock startup |
| `HAJIZ_FLIGHT_HOST_ENABLED` | Required | Server | Explicit Flight Host gate (`true`) | None | Startup fails closed |
| `HAJIZ_FLIGHT_SUPPLIER_MODE` | Required | Server | Explicitly selects the only supported non-production `mock` supplier | None | Startup fails closed |
| `HAJIZ_SUPABASE_URL` | Required | Server | Supabase server endpoint | None | Startup fails closed |
| `HAJIZ_SUPABASE_SECRET_KEY` | Required | Server | Server-only Supabase credential | None | Startup fails closed |
| `HAJIZ_SUPABASE_SERVICE_ROLE_KEY` | Optional legacy fallback | Server | Legacy server credential when the secret key is unavailable | None | Startup fails if neither credential exists |
| `HAJIZ_FLIGHT_TOKEN_SECRET` | Required | Server | Server-only signed Flight token secret (minimum 32 characters) | None | Startup fails closed |
| `HAJIZ_ALLOWED_ORIGINS` | Required | Server | Exact comma-separated CORS origins | None; wildcard rejected | Startup fails closed |

No server credential may use a `VITE_` prefix. Production supplier enablement is intentionally absent; `NODE_ENV=production` fails closed while `mock` is the only composition.

## Deployment smoke checklist

1. Confirm the deployment uses the expected non-production account and HTTPS hostname.
2. Confirm every required environment variable name is configured without logging values.
3. Confirm `GET /healthz`, `/`, a deep SPA link, and a built `/assets/*` file respond.
4. Confirm unknown `/api/v1/flights/*` paths return API JSON errors and never HTML.
5. Confirm Search, Reprice, and Checkout reach their existing handlers.
6. Confirm Booking Intent and Payment Initiation reject missing authentication at the API boundary.
7. Confirm graceful `SIGTERM` shutdown and inspect only sanitized structured logs.
