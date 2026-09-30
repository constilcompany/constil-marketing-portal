// ============================================================
// handlers/payments/create-checkout.ts
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidUUID, sanitize } from "../../_lib/validation.ts";
import { getStripe, resolveDiscount, calculatePricing } from "../../_lib/stripe.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function createCheckoutHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId, userEmail } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { package_id, billing_type = "one_time", coupon_code, success_url, cancel_url } = body;
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

  const sanitizedCoupon = coupon_code ? sanitize(coupon_code, 50) : undefined;
  const { discountPercent, couponId, couponCodeResolved, influencerId, managerId } =
    await resolveDiscount(serviceClient, userId, sanitizedCoupon);

  const { originalPrice, discountAmount, finalPrice } = calculatePricing(
    pkg.price,
    discountPercent,
  );

  const stripe = getStripe();

  let customerId: string | undefined;
  if (userEmail) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length > 0) customerId = customers.data[0].id;
  }

  const metadata = {
    user_id: userId,
    package_id: pkg.id,
    package_name: pkg.name,
    coupon_id: couponId || "",
    coupon_code: couponCodeResolved || "",
    influencer_id: influencerId || "",
    manager_id: managerId || "",
    original_price: String(originalPrice),
    discount_percent: String(discountPercent),
    discount_amount: String(discountAmount),
    final_price: String(finalPrice),
    billing_type,
  };

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : userEmail ?? undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: pkg.name,
            description:
              discountPercent > 0
                ? `Original: $${originalPrice.toFixed(2)} | Discount: ${discountPercent}% (-$${discountAmount.toFixed(2)})`
                : undefined,
          },
          unit_amount: Math.round(finalPrice * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url:
      success_url ||
      `${req.headers.get("origin") || ""}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      cancel_url || `${req.headers.get("origin") || ""}/checkout?package_id=${pkg.id}`,
    metadata,
  });

  await serviceClient.from("payment_transactions").insert({
    user_id: userId,
    package_id: pkg.id,
    amount: finalPrice,
    original_price: originalPrice,
    discount_amount: discountAmount,
    coupon_code: couponCodeResolved,
    coupon_id: couponId,
    influencer_id: influencerId,
    manager_id: managerId,
    currency: "usd",
    billing_type,
    stripe_payment_intent_id: session.id,
    status: "pending",
    payment_mode: "stripe",
    metadata,
  });

  return json({
    checkout_url: session.url,
    session_id: session.id,
    original_price: originalPrice,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    final_price: finalPrice,
  });
}