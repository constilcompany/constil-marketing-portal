// ============================================================
// handlers/subscriptions/check-free-eligibility.ts
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function checkFreeEligibilityHandler(
  ctx: HandlerContext,
): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  try {
    const { data: freeHistory } = await serviceClient
      .from("subscriptions")
      .select("id, status, created_at, expiry_date")
      .eq("user_id", userId)
      .eq("is_free", true)
      .order("created_at", { ascending: false });

    const hasActiveFree =
      freeHistory?.some((s: any) => s.status === "active") || false;
    const hasUsedFreeBefore = !!freeHistory && freeHistory.length > 0;

    const { data: existingPaid } = await serviceClient
      .from("subscriptions")
      .select("id, package_id, credit_packages!inner(name)")
      .eq("user_id", userId)
      .eq("is_free", false)
      .eq("is_active", true)
      .maybeSingle();

    const hasPaidPlan = !!existingPaid;
    const eligible = !hasActiveFree && !hasPaidPlan && !hasUsedFreeBefore;

    return json({
      eligible,
      has_active_free: hasActiveFree,
      has_active_paid: hasPaidPlan,
      used_free_before: hasUsedFreeBefore,
      can_activate: eligible,
      message: eligible
        ? "You are eligible for the free plan"
        : hasActiveFree
          ? "You already have an active free plan"
          : hasPaidPlan
            ? "You have an active paid plan. Free plan is not available."
            : "You have already used the free plan.",
      current_status: {
        free_plan:
          freeHistory && freeHistory.length > 0
            ? {
                id: freeHistory[0].id,
                status: freeHistory[0].status,
                activated_at: freeHistory[0].created_at,
                expires_at: freeHistory[0].expiry_date,
              }
            : null,
        paid_plan: existingPaid
          ? {
              id: existingPaid.id,
              package_name: (existingPaid as any).credit_packages?.name || "Unknown",
            }
          : null,
        used_free_before: hasUsedFreeBefore,
      },
    });
  } catch (error: any) {
    console.error("[check-free] Error:", error.message);
    return safeError("Failed to check eligibility", 500);
  }
}