// ============================================================
// handlers/credits/credit-config.ts - GET /credit-config
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function creditConfigHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("credit_action_config")
    .select("action_type, credit_cost, is_active")
    .eq("is_active", true);

  if (error) {
    console.error("[credit-config] DB error:", error.message);
    return safeError("Failed to fetch config", 500);
  }

  return json({ config: data });
}