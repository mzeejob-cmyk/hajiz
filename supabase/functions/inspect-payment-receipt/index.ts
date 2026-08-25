import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedMime = new Map<string, (bytes: Uint8Array) => boolean>([
  ["image/jpeg", (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ["image/png", (b) => b.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((v, i) => b[i] === v)],
  ["application/pdf", (b) => b.length >= 5 && new TextDecoder().decode(b.slice(0, 5)) === "%PDF-"],
]);

function detectMime(bytes: Uint8Array): string | null {
  for (const [mime, matches] of allowedMime) if (matches(bytes)) return mime;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return new Response("Unauthorized", { status: 401 });

  const { paymentId, objectName } = await req.json();
  const expectedPrefix = `${userId}/${paymentId}/`;
  if (typeof paymentId !== "string" || typeof objectName !== "string" || !objectName.startsWith(expectedPrefix)) {
    return new Response("Invalid receipt path", { status: 400 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: object, error: downloadError } = await admin.storage.from("receipts").download(objectName);
  if (downloadError || !object) return new Response("Receipt object not found", { status: 404 });
  if (object.size < 1 || object.size > 10 * 1024 * 1024) return new Response("Invalid receipt size", { status: 413 });

  const bytes = new Uint8Array(await object.arrayBuffer());
  const detectedMime = detectMime(bytes);
  if (!detectedMime) return new Response("Unsupported receipt content", { status: 415 });
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, "0")).join("");

  const { error } = await admin.rpc("register_inspected_receipt", {
    p_payment_id: paymentId,
    p_object_name: objectName,
    p_byte_size: object.size,
    p_detected_mime: detectedMime,
    p_sha256: sha256,
    p_request_context: { boundary: "inspect-payment-receipt-v1" },
  });
  if (error) return new Response(error.message, { status: 409 });
  return Response.json({ accepted: true, detectedMime, sha256 });
});
