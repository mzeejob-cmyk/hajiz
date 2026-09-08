import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createPublicCatalogEdgeHandler, createPublicCatalogRead } from "../../../src/server/product/publicCatalogRead.js";

const url = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!url || !serviceKey) throw new Error("PUBLIC_CATALOG_CONFIGURATION_UNAVAILABLE");
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createPublicCatalogRead({ rpc: async (name, parameters) => { const result = await client.rpc(name, parameters); if (result.error) throw new Error("PUBLIC_CATALOG_RPC_FAILED"); return result.data; } });

Deno.serve(createPublicCatalogEdgeHandler({ service, corsHeaders }));
