// ============================================================
// handlers/packages/get-packages.ts - GET /packages
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function getPackagesHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient } = ctx;

  const { data, error } = await serviceClient
    .from("credit_packages")
    .select(
      "id, name, credit_amount, price, billing_type, " +
        "billing_interval, template_tier, invoice_credits, estimate_credits, " +
        "ai_estimate_credits, invoice_unlimited, estimate_unlimited, " +
        "ai_estimate_unlimited, is_active, trial_enabled, trial_days, " +
        "trial_invoice_credits, trial_estimate_credits, trial_ai_estimate_credits, " +
        "duration_days, created_at, updated_at",
    )
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) {
    console.error("[get-packages] DB error:", error.message);
    return safeError("Failed to fetch packages", 500);
  }

  return json({
    packages: data || [],
    total: data?.length || 0,
  });
}