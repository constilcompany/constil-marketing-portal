// ============================================================
// handlers/credits/get-wallet.ts - GET /wallet
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

const EMPTY_WALLET = (userId: string) => ({
  user_id: userId,
  invoice_remaining: 0,
  estimate_remaining: 0,
  ai_estimate_remaining: 0,
  invoice_unlimited: false,
  estimate_unlimited: false,
  ai_estimate_unlimited: false,
});

export async function getWalletHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("user_credit_wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    // PGRST116 = nenhum registro encontrado → retorna wallet zerada
    if (error.code === "PGRST116") {
      return json({ wallet: EMPTY_WALLET(userId) });
    }
    console.error("[get-wallet] DB error:", error.message);
    return safeError("Failed to fetch wallet", 500);
  }

  return json({ wallet: data });
}