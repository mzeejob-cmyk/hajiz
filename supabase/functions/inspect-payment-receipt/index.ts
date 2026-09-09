import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

const MAX_REQUEST_BYTES = 2048;
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FILE = /^receipt-([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(jpg|png|pdf)$/i;
const MIME_BY_EXTENSION = new Map([["jpg", "image/jpeg"], ["png", "image/png"], ["pdf", "application/pdf"]]);
const allowedMime = new Map<string, (bytes: Uint8Array) => boolean>([
  ["image/jpeg", (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v, i) => b[i] === v)],
  ["application/pdf", (b) => b.length >= 5 && new TextDecoder().decode(b.slice(0, 5)) === "%PDF-"],
]);

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" } });
}

function detectMime(bytes: Uint8Array): string | null {
  for (const [mime, matches] of allowedMime) if (matches(bytes)) return mime;
  return null;
}

async function boundedJson(req: Request) {
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const bytes = Number(declared);
    if (!Number.isSafeInteger(bytes) || bytes < 0) return { error: "INVALID_RECEIPT_REQUEST", status: 400 };
    if (bytes > MAX_REQUEST_BYTES) return { error: "INPUT_TOO_LARGE", status: 413 };
  }
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    if (reader) while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BYTES) { try { await reader.cancel(); } catch { /* best effort */ } return { error: "INPUT_TOO_LARGE", status: 413 }; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch { return { error: "INVALID_RECEIPT_REQUEST", status: 400 }; } finally { reader?.releaseLock(); }
}

function validateRequest(value: unknown, userId: string) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== 2 || !Object.hasOwn(input, "paymentId") || !Object.hasOwn(input, "objectName") || typeof input.paymentId !== "string" || typeof input.objectName !== "string" || !UUID.test(input.paymentId) || input.objectName.length > 256) return null;
  const segments = input.objectName.split("/");
  if (segments.length !== 3 || segments[0] !== userId || segments[1] !== input.paymentId) return null;
  const match = FILE.exec(segments[2]);
  if (!match) return null;
  return { paymentId: input.paymentId, objectName: input.objectName, expectedMime: MIME_BY_EXTENSION.get(match[2].toLowerCase())! };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response(200, { ok: true });
  if (req.method !== "POST") return response(405, { error: "METHOD_NOT_ALLOWED" });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return response(401, { error: "AUTH_REQUIRED" });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return response(503, { error: "RECEIPT_REGISTRATION_REJECTED" });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
  const userId = claims?.claims?.sub;
  if (claimsError || typeof userId !== "string" || !UUID.test(userId)) return response(401, { error: "AUTH_REQUIRED" });

  const parsed = await boundedJson(req);
  if (parsed.error) return response(parsed.status!, { error: parsed.error });
  const input = validateRequest(parsed.value, userId);
  if (!input) return response(400, { error: "INVALID_RECEIPT_REQUEST" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: object, error: downloadError } = await admin.storage.from("receipts").download(input.objectName);
  if (downloadError || !object) return response(404, { error: "RECEIPT_NOT_FOUND" });
  if (object.size < 1 || object.size > MAX_RECEIPT_BYTES) return response(413, { error: "RECEIPT_TOO_LARGE" });

  let bytes: Uint8Array;
  try { bytes = new Uint8Array(await object.arrayBuffer()); }
  catch { return response(404, { error: "RECEIPT_NOT_FOUND" }); }
  const detectedMime = detectMime(bytes);
  if (!detectedMime || detectedMime !== input.expectedMime) return response(415, { error: "RECEIPT_UNSUPPORTED" });
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");

  const { error } = await admin.rpc("register_inspected_receipt", {
    p_payment_id: input.paymentId,
    p_object_name: input.objectName,
    p_byte_size: object.size,
    p_detected_mime: detectedMime,
    p_sha256: sha256,
    p_request_context: { boundary: "inspect-payment-receipt-v1" },
  });
  if (error) return response(409, { error: "RECEIPT_REGISTRATION_REJECTED" });
  return response(200, { accepted: true, detectedMime, sha256 });
});
