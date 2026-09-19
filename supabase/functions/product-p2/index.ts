import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import {
  createProductP2Composition,
  createProductP2EdgeHandler,
} from "../../../src/server/product/productP2StagingComposition.js";
import {
  getSupabaseProjectForEnvironment,
  validateSupabaseProjectBoundary,
} from "../../../src/services/contracts/supabaseProjectBoundary.js";

const handler = createProductP2EdgeHandler({
  corsHeaders,
  getComposition() {
    const environment = Deno.env.get("HAJIZ_APP_ENV");
    const reviewedUrl = Deno.env.get("HAJIZ_SUPABASE_URL");
    const runtimeUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!environment || !reviewedUrl || runtimeUrl !== reviewedUrl || !anonKey || !serviceKey) {
      throw new Error("P2_COMPOSITION_UNAVAILABLE");
    }

    const expected = getSupabaseProjectForEnvironment(environment);
    const boundary = validateSupabaseProjectBoundary({
      environment,
      projectRef: expected.projectRef,
      supabaseUrl: reviewedUrl,
    });

    const userClient = createClient(boundary.origin, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const serviceClient = createClient(boundary.origin, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return createProductP2Composition({
      environment,
      projectRef: boundary.projectRef,
      supabaseUrl: boundary.origin,
      userClient,
      serviceClient,
    });
  },
});

Deno.serve(handler);
