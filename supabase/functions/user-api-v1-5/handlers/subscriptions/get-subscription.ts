// ============================================================
// handlers/subscriptions/get-subscription.ts - GET /subscription
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function getSubscriptionHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("subscriptions")
    .select("*, credit_packages(*)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("[get-subscription] DB error:", error.message);
    return safeError("Failed to fetch subscription", 500);
  }

  // Calcula dias restantes de trial
  if (data && data.is_trial && data.trial_end_at) {
    const now = new Date();
    const end = new Date(data.trial_end_at);
    const daysLeft = Math.max(
      0,
      Math.ceil((end.getTime() - now.getTime()) / 86400000),
    );
    (data as any).trial_days_remaining = daysLeft;
  }

  return json({ subscription: data || null });
}