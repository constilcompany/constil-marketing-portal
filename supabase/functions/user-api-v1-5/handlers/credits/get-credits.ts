// ============================================================
// handlers/credits/get-credits.ts - GET /credits
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function getCreditsHandler(
  ctx: HandlerContext,
): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[get-credits] DB error:", error.message);
    return safeError("Failed to fetch credits", 500);
  }

  return json({ credits: data?.balance ?? 0 });
}
