// ============================================================
// handlers/payments/validate-coupon.ts - POST /validate-coupon
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sanitize, isValidUUID } from "../../_lib/validation.ts";
import { calculatePricing } from "../../_lib/stripe.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function validateCouponHandler(ctx: HandlerContext): Promise<Response> {
  const { req, serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const coupon_code = sanitize(body.coupon_code, 50);
  const package_id = body.package_id;

  if (!coupon_code) return json({ error: "Missing coupon_code" }, 400);
  if (package_id && !isValidUUID(package_id)) {
    return json({ error: "Invalid package_id" }, 400);
  }

  const { data: coupon } = await serviceClient
    .from("coupons")
    .select("*, profiles!coupons_influencer_id_fkey(full_name)")
    .eq("code", coupon_code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!coupon) return json({ valid: false, error: "Invalid coupon code" });
  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return json({ valid: false, error: "Coupon usage limit reached" });
  }
  if (coupon.expiry_date && new Date(coupon.expiry_date) <= new Date()) {
    return json({ valid: false, error: "Coupon has expired" });
  }

  const result: any = {
    valid: true,
    discount_percent: Number(coupon.discount_percent),
    influencer_name: (coupon as any).profiles?.full_name || null,
  };

  if (package_id) {
    const { data: pkg } = await serviceClient
      .from("credit_packages")
      .select("price, name")
      .eq("id", package_id)
      .single();

    if (pkg) {
      const { originalPrice, discountAmount, finalPrice } = calculatePricing(
        pkg.price,
        Number(coupon.discount_percent),
      );
      result.price_preview = {
        original_price: originalPrice,
        discount_amount: discountAmount,
        final_price: finalPrice,
        package_name: pkg.name,
      };
    }
  }

  return json(result);
}