// ============================================================
// handlers/credits/consume-credit.ts - POST /consume-credit
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";

const VALID_ACTIONS = ["invoice", "estimate", "ai_estimate"] as const;
type ActionType = (typeof VALID_ACTIONS)[number];

const BUCKET_MAP: Record<
  ActionType,
  { remaining: string; unlimited: string }
> = {
  invoice: {
    remaining: "invoice_remaining",
    unlimited: "invoice_unlimited",
  },
  estimate: {
    remaining: "estimate_remaining",
    unlimited: "estimate_unlimited",
  },
  ai_estimate: {
    remaining: "ai_estimate_remaining",
    unlimited: "ai_estimate_unlimited",
  },
};

export async function consumeCreditHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const action_type = sanitize(body.action_type, 50) as ActionType;
  const reference_id = body.reference_id ? sanitize(body.reference_id, 255) : null;

  if (!action_type) return json({ error: "Missing action_type" }, 400);
  if (!VALID_ACTIONS.includes(action_type)) {
    return json({ error: "Invalid action type" }, 400);
  }

  // --- Busca config da ação ---
  const { data: actionConfig } = await serviceClient
    .from("credit_action_config")
    .select("credit_cost, is_active")
    .eq("action_type", action_type)
    .single();

  if (!actionConfig) return json({ error: "Unknown action" }, 400);
  if (!actionConfig.is_active) return json({ error: "Action currently disabled" }, 403);

  const cost = actionConfig.credit_cost;
  const bucket = BUCKET_MAP[action_type];

  // --- Tenta wallet primeiro ---
  const { data: wallet } = await serviceClient
    .from("user_credit_wallets")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (wallet && bucket) {
    const isUnlimited = wallet[bucket.unlimited as keyof typeof wallet] as boolean;
    const remaining = wallet[bucket.remaining as keyof typeof wallet] as number;

    if (isUnlimited) {
      await serviceClient.from("credit_transactions").insert({
        user_id: userId,
        transaction_type: "consumption",
        credits_change: 0,
        amount_paid: 0,
        reference_id: reference_id || `${action_type}_unlimited`,
      });
      return json({
        success: true,
        credits_deducted: 0,
        remaining_credits: remaining,
        unlimited: true,
      });
    }

    if (remaining >= cost) {
      // 👈 update atômico via .eq no valor atual
      const { data: updated, error: updateError } = await serviceClient
        .from("user_credit_wallets")
        .update({ [bucket.remaining]: remaining - cost })
        .eq("user_id", userId)
        .eq(bucket.remaining, remaining)
        .select();

      if (updateError || !updated || updated.length === 0) {
        return json(
          { error: "Concurrent operation detected. Please try again." },
          409,
        );
      }

      await serviceClient.from("credit_transactions").insert({
        user_id: userId,
        transaction_type: "consumption",
        credits_change: -cost,
        amount_paid: 0,
        reference_id: reference_id || null,
      });

      return json({
        success: true,
        credits_deducted: cost,
        remaining_credits: remaining - cost,
        bucket: action_type,
      });
    }
  }

  // --- Fallback para user_credits ---
  const { data: credits } = await serviceClient
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (!credits || credits.balance < cost) {
    return json(
      {
        error: "Insufficient credits. Please top up.",
        can_generate: false,
        required: cost,
        available: credits?.balance ?? 0,
      },
      402,
    );
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("user_credits")
    .update({ balance: credits.balance - cost })
    .eq("user_id", userId)
    .eq("balance", credits.balance)
    .select();

  if (updateError || !updated || updated.length === 0) {
    return json(
      { error: "Concurrent operation detected. Please try again." },
      409,
    );
  }

  await serviceClient.from("credit_transactions").insert({
    user_id: userId,
    transaction_type: "consumption",
    credits_change: -cost,
    amount_paid: 0,
    reference_id: reference_id || null,
  });

  return json({
    success: true,
    credits_deducted: cost,
    remaining_credits: credits.balance - cost,
    can_generate: credits.balance - cost >= cost,
  });
}