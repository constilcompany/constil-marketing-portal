// ============================================================
// _lib/rate-limit.ts - Rate limiting atômico via RPC
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ⚠️ REQUER função SQL `check_rate_limit` no banco:
 *
 * CREATE OR REPLACE FUNCTION check_rate_limit(
 *   p_identifier text,
 *   p_endpoint text,
 *   p_max integer,
 *   p_window_seconds integer
 * ) RETURNS boolean AS $$
 * DECLARE
 *   v_count integer;
 * BEGIN
 *   DELETE FROM rate_limits
 *   WHERE identifier = p_identifier
 *     AND endpoint = p_endpoint
 *     AND window_start < now() - (p_window_seconds || ' seconds')::interval;
 *
 *   INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
 *   VALUES (p_identifier, p_endpoint, 1, now())
 *   ON CONFLICT (identifier, endpoint)
 *   DO UPDATE SET request_count = rate_limits.request_count + 1
 *   RETURNING request_count INTO v_count;
 *
 *   RETURN v_count <= p_max;
 * END;
 * $$ LANGUAGE plpgsql;
 */
export async function checkRateLimit(
  serviceClient: SupabaseClient,
  identifier: string,
  endpoint: string,
  maxRequests = 60,
  windowSeconds = 60,
): Promise<boolean> {
  const { data, error } = await serviceClient.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_max: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error("Rate limit RPC error:", error);
    // Fail-open em caso de erro (ou fail-closed, decida)
    return true;
  }
  return data === true;
}

export async function cleanupRateLimits(serviceClient: SupabaseClient) {
  const cutoff = new Date(Date.now() - 300_000).toISOString();
  await serviceClient.from("rate_limits").delete().lt("window_start", cutoff);
}