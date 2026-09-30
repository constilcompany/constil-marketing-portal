// ============================================================
// handlers/subscriptions/start-trial.ts - POST /start-trial
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidUUID } from "../../_lib/validation.ts";
import { getStripe } from "../../_lib/stripe.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function startTrialHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId, userEmail } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { package_id, success_url, cancel_url } = body;
  if (!package_id || !isValidUUID(package_id)) {
    return json({ error: "Invalid package_id" }, 400);
  }

  const { data: pkg } = await serviceClient
    .from("credit_packages")
    .select("*")
    .eq("id", package_id)
    .eq("is_active", true)
    .single();

  if (!pkg) return json({ error: "Invalid or inactive package" }, 400);
  if (!pkg.trial_enabled || !pkg.trial_days) {
    return json({ error: "Trial not available for this package" }, 400);
  }

  // Já usou trial deste pacote?
  const { data: existingTrial } = await serviceClient
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("package_id", package_id)
    .eq("is_trial", true)
    .single();

  if (existingTrial) {
    return json(
      { error: "You have already used a trial for this package" },
      400,
    );
  }

  const stripe = getStripe();

  let customerId: string | undefined;
  if (userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;
  }

  const interval = pkg.billing_interval === "yearly" ? "year" : "month";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : userEmail ?? undefined,
    payment_method_collection: "always",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: pkg.name },
          unit_amount: Math.round(Number(pkg.price) * 100),
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    mode: "subscription",
    subscription_data: {
      trial_period_days: pkg.trial_days,
      metadata: {
        user_id: userId,
        package_id: pkg.id,
        package_name: pkg.name,
        is_trial: "true",
      },
    },
    metadata: {
      user_id: userId,
      package_id: pkg.id,
      flow: "trial",
    },
    success_url:
      success_url ||
      `${req.headers.get("origin") || ""}/payment-success?session_id={CHECKOUT_SESSION_ID}&flow=trial`,
    cancel_url: cancel_url || `${req.headers.get("origin") || ""}/pricing`,
  });

  return json({
    checkout_url: session.url,
    session_id: session.id,
    trial_days: pkg.trial_days,
    package_name: pkg.name,
  });
}