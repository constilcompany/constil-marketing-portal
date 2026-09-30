// ============================================================
// handlers/subscriptions/verify-trial.ts - POST /verify-trial
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { getStripe } from "../../_lib/stripe.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function verifyTrialHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId } = ctx; 
  if (!userId) return safeError("Unauthorized", 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { session_id } = body;
  if (!session_id || typeof session_id !== "string") {
    return json({ error: "Missing session_id" }, 400);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["subscription"],
  });

  if (session.status !== "complete") {
    return json({ status: "incomplete", message: "Checkout not completed" });
  }

  const meta = session.metadata || {};
  const sessionUserId = meta.user_id;
  const packageId = meta.package_id;

  if (!sessionUserId || !packageId) return json({ error: "Invalid session" }, 400);
  if (sessionUserId !== userId) return safeError("Unauthorized", 403);

  // Já processado?
  const { data: existingSub } = await serviceClient
    .from("subscriptions")
    .select("id")
    .eq("user_id", sessionUserId)
    .eq("package_id", packageId)
    .eq("is_trial", true)
    .single();

  if (existingSub) {
    return json({
      status: "already_processed",
      message: "Trial already activated",
    });
  }

  const { data: pkg } = await serviceClient
    .from("credit_packages")
    .select("*")
    .eq("id", packageId)
    .single();

  if (!pkg) return safeError("Package not found", 404);

  // Desativa subs antigas
  await serviceClient
    .from("subscriptions")
    .update({ is_active: false, status: "replaced" })
    .eq("user_id", sessionUserId)
    .eq("is_active", true);

  const now = new Date();
  const trialEnd = new Date(now.getTime() + (pkg.trial_days || 7) * 86400000);

  const stripeSubscription =
    typeof session.subscription === "object" ? session.subscription : null;
  const stripeSubId =
    stripeSubscription?.id || (session.subscription as string) || null;

  await serviceClient.from("subscriptions").insert({
    user_id: sessionUserId,
    package_id: pkg.id,
    billing_type: pkg.billing_interval || "monthly",
    template_tier: pkg.template_tier,
    is_active: true,
    is_trial: true,
    status: "trial",
    stripe_subscription_id: stripeSubId,
    trial_start_at: now.toISOString(),
    trial_end_at: trialEnd.toISOString(),
    start_date: now.toISOString(),
    expiry_date: trialEnd.toISOString(),
  });

  const trialInvoice = pkg.trial_invoice_credits ?? 0;
  const trialEstimate = pkg.trial_estimate_credits ?? 0;
  const trialAiEstimate = pkg.trial_ai_estimate_credits ?? 0;

  const { data: wallet } = await serviceClient
    .from("user_credit_wallets")
    .select("*")
    .eq("user_id", sessionUserId)
    .single();

  if (wallet) {
    await serviceClient
      .from("user_credit_wallets")
      .update({
        invoice_remaining: wallet.invoice_remaining + trialInvoice,
        estimate_remaining: wallet.estimate_remaining + trialEstimate,
        ai_estimate_remaining: wallet.ai_estimate_remaining + trialAiEstimate,
      })
      .eq("user_id", sessionUserId);
  } else {
    await serviceClient.from("user_credit_wallets").insert({
      user_id: sessionUserId,
      invoice_remaining: trialInvoice,
      estimate_remaining: trialEstimate,
      ai_estimate_remaining: trialAiEstimate,
      invoice_unlimited: false,
      estimate_unlimited: false,
      ai_estimate_unlimited: false,
    });
  }

  return json({
    status: "trial_activated",
    trial_end: trialEnd.toISOString(),
    trial_days: pkg.trial_days,
    package_name: pkg.name,
  });
}