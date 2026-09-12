import { createReadStream } from "node:fs"
import { access, readFile, stat } from "node:fs/promises"
import { extname, resolve, sep } from "node:path"
import { Readable } from "node:stream"
import { FLIGHT_HTTP_HOST_PATHS } from "./flightHttpHostV1.js"

export const FLIGHT_NODE_APPLICATION_VERSION = "flight-node-application/v1"
export const FLIGHT_NODE_HEALTH_PATH = "/healthz"

const API_ROOT = "/api/v1/flights"
const STATIC_HEADERS = Object.freeze({
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
})
const TYPES = Object.freeze({
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
})

const response = (body, status, headers = {}) => new Response(body, { status, headers: { ...STATIC_HEADERS, ...headers } })
const methodAllowed = method => method === "GET" || method === "HEAD"

function safePathname(request) {
  const pathname = new URL(request.url).pathname
  try { return decodeURIComponent(pathname) } catch { return null }
}

function inside(root, pathname) {
  const candidate = resolve(root, `.${pathname}`)
  return candidate === root || candidate.startsWith(`${root}${sep}`) ? candidate : null
}

async function regularFile(path) {
  try { return (await stat(path)).isFile() } catch { return false }
}

function fileResponse(path, method, { immutable = false } = {}) {
  const headers = {
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "content-type": TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
  }
  if (method === "HEAD") return response(null, 200, headers)
  return response(Readable.toWeb(createReadStream(path)), 200, headers)
}

export async function assertFlightNodeDistV1(distDirectory) {
  if (typeof distDirectory !== "string" || !distDirectory) throw new TypeError("Flight Node dist directory is required")
  const root = resolve(distDirectory)
  await access(resolve(root, "index.html"))
  return root
}

export function createHajizFlightNodeApplicationV1({ flightFetch, distDirectory } = {}) {
  if (typeof flightFetch !== "function" || typeof distDirectory !== "string" || !distDirectory) throw new TypeError("trusted Node application dependencies are required")
  const root = resolve(distDirectory)
  const indexPath = resolve(root, "index.html")
  return Object.freeze({
    contractVersion: FLIGHT_NODE_APPLICATION_VERSION,
    async fetch(request) {
      const pathname = safePathname(request)
      if (pathname === null) return response("Not Found", 404, { "content-type": "text/plain; charset=utf-8" })
      if (pathname === FLIGHT_NODE_HEALTH_PATH) {
        if (!methodAllowed(request.method)) return response(null, 405, { allow: "GET, HEAD" })
        return response(request.method === "HEAD" ? null : JSON.stringify({ status: "ok" }), 200, { "cache-control": "no-store", "content-type": "application/json; charset=utf-8" })
      }
      if (pathname === API_ROOT || pathname.startsWith(`${API_ROOT}/`) || FLIGHT_HTTP_HOST_PATHS.includes(pathname)) return flightFetch(request)
      if (!methodAllowed(request.method)) return response(null, 405, { allow: "GET, HEAD" })
      const requested = inside(root, pathname === "/" ? "/index.html" : pathname)
      if (!requested) return response("Not Found", 404, { "content-type": "text/plain; charset=utf-8" })
      if (await regularFile(requested)) return fileResponse(requested, request.method, { immutable: pathname.startsWith("/assets/") })
      if (extname(pathname)) return response("Not Found", 404, { "content-type": "text/plain; charset=utf-8" })
      try {
        if (request.method === "HEAD") return fileResponse(indexPath, request.method)
        return response(await readFile(indexPath), 200, { "cache-control": "no-cache", "content-type": TYPES[".html"] })
      } catch {
        return response("Application unavailable", 503, { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" })
      }
    },
  })
}
