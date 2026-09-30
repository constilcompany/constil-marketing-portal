// ============================================================
// handlers/subscriptions/template-access.ts - GET /template-access
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

const TIER_ACCESS: Record<string, string[]> = {
  basic: ["basic"],
  professional: ["basic", "professional"],
  enterprise: ["basic", "professional", "enterprise"],
};

export async function templateAccessHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data: sub } = await serviceClient
    .from("subscriptions")
    .select("template_tier")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  const tier = sub?.template_tier || "basic";

  return json({
    tier,
    templates: TIER_ACCESS[tier] || ["basic"],
  });
}