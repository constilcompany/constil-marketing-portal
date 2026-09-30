// ============================================================
// handlers/subscriptions/start-free.ts - POST /start-free
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { getClientIP } from "../../_lib/auth/supabase.ts";
import { checkRateLimit } from "../../_lib/rate-limit.ts";
import { RATE_LIMITS } from "../../_lib/config.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function startFreeHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  try {
    const clientIP = getClientIP(req);
    const allowed = await checkRateLimit(
      serviceClient,
      `${clientIP}:${userId}`,
      "start-free",
      RATE_LIMITS["start-free"].max,
      RATE_LIMITS["start-free"].window,
    );
    if (!allowed) {
      return safeError("Too many attempts. Please try again later.", 429);
    }

    // 1. Busca pacote free
    const { data: freePackage, error: pkgError } = await serviceClient
      .from("credit_packages")
      .select("*")
      .eq("is_free", true)
      .eq("is_active", true)
      .single();

    if (pkgError || !freePackage) {
      return json(
        { error: "Free plan not available. Please contact support." },
        404,
      );
    }

    // 2. Histórico de free plans
    const { data: freeHistory, error: historyError } = await serviceClient
      .from("subscriptions")
      .select("id, status, created_at, expiry_date")
      .eq("user_id", userId)
      .eq("is_free", true)
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error("Error checking free history:", historyError);
      return safeError("Failed to check eligibility", 500);
    }

    if (freeHistory && freeHistory.length > 0) {
      const hasActiveFree = freeHistory.some((s: any) => s.status === "active");
      if (hasActiveFree) {
        return json(
          {
            error: "You already have an active free plan",
            subscription_id: freeHistory[0].id,
          },
          400,
        );
      }
      return json(
        {
          error: "Free plan already used. This is a one-time offer.",
          used_at: freeHistory[0].created_at,
          message: "Consider our paid plans for continued service.",
        },
        400,
      );
    }

    // 3. Verifica plano pago ativo
    const { data: existingPaid } = await serviceClient
      .from("subscriptions")
      .select("id, package_id, credit_packages!inner(name)")
      .eq("user_id", userId)
      .eq("is_free", false)
      .eq("is_active", true)
      .maybeSingle();

    if (existingPaid) {
      return json(
        {
          error: "You have an active paid plan. Free plan is not available.",
          suggestion: "Cancel your paid plan first to switch to free",
          current_plan: (existingPaid as any).credit_packages?.name || "Unknown",
        },
        400,
      );
    }

    // 4. Cria subscription free
    const now = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await serviceClient
      .from("subscriptions")
      .update({ is_active: false, status: "replaced" })
      .eq("user_id", userId)
      .eq("is_active", true);

    const { data: subscription, error: subError } = await serviceClient
      .from("subscriptions")
      .insert({
        user_id: userId,
        package_id: freePackage.id,
        billing_type: "free",
        template_tier: freePackage.template_tier || "basic",
        is_active: true,
        is_free: true,
        is_trial: false,
        status: "active",
        start_date: now.toISOString(),
        expiry_date: expiryDate.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("Error creating free subscription:", subError);
      return safeError("Failed to activate free plan", 500);
    }

    // 5. Atualiza wallet
    const { data: existingWallet } = await serviceClient
      .from("user_credit_wallets")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existingWallet) {
      await serviceClient
        .from("user_credit_wallets")
        .update({
          invoice_remaining:
            existingWallet.invoice_remaining + (freePackage.invoice_credits || 0),
          estimate_remaining:
            existingWallet.estimate_remaining + (freePackage.estimate_credits || 0),
          ai_estimate_remaining:
            existingWallet.ai_estimate_remaining +
            (freePackage.ai_estimate_credits || 0),
        })
        .eq("user_id", userId);
    } else {
      await serviceClient.from("user_credit_wallets").insert({
        user_id: userId,
        invoice_remaining: freePackage.invoice_credits || 0,
        estimate_remaining: freePackage.estimate_credits || 0,
        ai_estimate_remaining: freePackage.ai_estimate_credits || 0,
        invoice_unlimited: false,
        estimate_unlimited: false,
        ai_estimate_unlimited: false,
      });
    }

    // 6. Atualiza saldo geral
    const totalCredits =
      (freePackage.invoice_credits || 0) +
      (freePackage.estimate_credits || 0) +
      (freePackage.ai_estimate_credits || 0);

    if (totalCredits > 0) {
      const { data: currentCredits } = await serviceClient
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();

      await serviceClient.from("user_credits").upsert(
        {
          user_id: userId,
          balance: (currentCredits?.balance || 0) + totalCredits,
          updated_at: now.toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    // 7. Logs
    await serviceClient.from("credit_transactions").insert({
      user_id: userId,
      package_id: freePackage.id,
      transaction_type: "free_plan_activation",
      credits_change: totalCredits,
      amount_paid: 0,
      discount_applied: 0,
    });

    await serviceClient.from("audit_logs").insert({
      user_id: userId,
      action: "free_plan_activated",
      ip_address: clientIP,
      user_agent: req.headers.get("user-agent") || "",
      metadata: {
        package_id: freePackage.id,
        package_name: freePackage.name,
        credits: totalCredits,
      },
    });

    return json({
      success: true,
      message: "Free plan activated successfully! 🎉",
      subscription: {
        id: subscription.id,
        package_name: freePackage.name,
        template_tier: freePackage.template_tier,
        expiry_date: subscription.expiry_date,
      },
      credits: {
        total: totalCredits,
        invoice: freePackage.invoice_credits || 0,
        estimate: freePackage.estimate_credits || 0,
        ai_estimate: freePackage.ai_estimate_credits || 0,
      },
    });
  } catch (error: any) {
    console.error("[start-free] Error:", error.message);
    return safeError("Failed to activate free plan", 500);
  }
}