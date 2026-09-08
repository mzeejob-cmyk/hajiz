import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import {
  createProductP2EdgeHandler,
  createProductP2StagingComposition,
  HAJIZ_STAGING_PROJECT_REF,
  HAJIZ_STAGING_SUPABASE_URL,
} from "../../../src/server/product/productP2StagingComposition.js";

const handler = createProductP2EdgeHandler({
  corsHeaders,
  getComposition() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url !== HAJIZ_STAGING_SUPABASE_URL || !anonKey || !serviceKey) {
      throw new Error("P2_STAGING_COMPOSITION_UNAVAILABLE");
  }

  const userClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return createProductP2StagingComposition({
      environment: "staging",
      projectRef: HAJIZ_STAGING_PROJECT_REF,
      supabaseUrl: url,
      userClient,
      serviceClient,
    });
  },
});

Deno.serve(handler);
